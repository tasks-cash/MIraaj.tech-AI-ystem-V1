import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Worker, type Job } from "bullmq";
import { createHash, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { createLogger } from "@miraaj/shared-logging";
import {
  CAMPAIGN_PAYMENT_DISCLOSURES,
  isRtlLanguage,
  type CampaignPlatform,
  type CreativeReviewReasonCode,
  type CreativeRightsStatus,
} from "@miraaj/shared-types";
import { loadEnvironment } from "../../../environment.js";
import { AiInternalClientService } from "../ai-internal-client.service.js";
import { transitionStatus } from "../analysis/atomic-transition.js";
import {
  AssetRightsRecordModel,
  CreativeAssetModel,
  CreativeAssetVariantModel,
  CreativeGenerationAttemptModel,
  CreativeGenerationJobModel,
  CreativeProvenanceManifestModel,
  CreativeRenderSpecificationModel,
} from "../models/creative.schema.js";
import { CreativeBudgetService } from "./creative-budget.service.js";
import { CreativeQualityService } from "./creative-quality.service.js";
import {
  CreativeSourceEligibilityService,
  type CreativeBriefRef,
} from "./creative-source-eligibility.service.js";
import { CreativeStorageService } from "./creative-storage.service.js";
import { CreativeUsageService } from "./creative-usage.service.js";
import { CreativeValidationService } from "./creative-validation.service.js";
import {
  buildCreativeProviderPrompt,
  defaultDimensionsForAssetType,
} from "./prompt-builder.js";
import {
  CreativeQueueService,
  type BuildCreativeJobPayload,
} from "../queue/creative-queue.service.js";
import { IMAGE_ASSET_TYPES, VIDEO_ASSET_TYPES } from "./creative-job.service.js";

interface ProviderGenerationResult {
  objectKey?: string;
  mimeType?: string;
  rightsStatus: CreativeRightsStatus;
  ownershipType: "platform_synthetic" | "provider_generated" | "unknown";
  rightsConfidence: number;
  providerState: "disabled" | "mock" | "openai" | "runway";
  providerJobId?: string;
  ocrText?: string | null;
  assetStatus: "awaiting_review" | "provider_pending" | "provider_unavailable" | "failed";
  usage?: {
    provider: string;
    model?: string | null;
    providerJobId?: string | null;
    usageUnavailable?: boolean;
    costUnknown?: boolean;
    providerReportedCost?: number | null;
  };
}

@Injectable()
export class CreativeWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly environment = loadEnvironment();
  private readonly logger = createLogger({
    service: "miraaj-api",
    environment: this.environment.APP_ENV,
    level: this.environment.LOG_LEVEL,
  });
  private worker?: Worker<BuildCreativeJobPayload>;
  private reconcileTimer?: NodeJS.Timeout;

  constructor(
    @Inject(CreativeQueueService)
    private readonly queueService: CreativeQueueService,
    @Inject(AiInternalClientService)
    private readonly aiClient: AiInternalClientService,
    @Inject(CreativeSourceEligibilityService)
    private readonly eligibility: CreativeSourceEligibilityService,
    @Inject(CreativeValidationService)
    private readonly validation: CreativeValidationService,
    @Inject(CreativeQualityService)
    private readonly quality: CreativeQualityService,
    @Inject(CreativeStorageService)
    private readonly storage: CreativeStorageService,
    @Inject(CreativeBudgetService)
    private readonly budget: CreativeBudgetService,
    @Inject(CreativeUsageService)
    private readonly usage: CreativeUsageService,
  ) {}

  onModuleInit(): void {
    const connection = { url: this.environment.REDIS_URL };
    this.worker = new Worker(
      this.environment.AI_CREATIVE_QUEUE_NAME,
      async (job) => this.process(job),
      {
        connection,
        concurrency: this.environment.AI_CREATIVE_WORKER_CONCURRENCY,
      },
    );
    this.worker.on("failed", (job, error) => {
      this.logger.error(
        {
          event: "ai.creative.job.failed",
          creativeJobId: job?.data?.creativeJobId,
          safeError: error.message,
        },
        "Creative worker job failed",
      );
    });
    this.reconcileTimer = setInterval(
      () => {
        void this.reconcileStaleJobs();
        void this.reconcilePendingProviderAssets();
      },
      this.environment.AI_CREATIVE_RECONCILE_INTERVAL_SECONDS * 1_000,
    );
    void this.reconcilePendingProviderAssets();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.reconcileTimer) {
      clearInterval(this.reconcileTimer);
    }
    await this.worker?.close();
  }

  private async process(job: Job<BuildCreativeJobPayload>): Promise<void> {
    const started = Date.now();
    const creativeJobId = job.data.creativeJobId;
    const jobRecord = await CreativeGenerationJobModel.findOne({ creativeJobId });
    if (!jobRecord || jobRecord.status === "cancelled") {
      return;
    }

    const activated = await transitionStatus(
      CreativeGenerationJobModel,
      { creativeJobId },
      "queued",
      {
        status: "active",
        currentStage: "loading_source",
        startedAt: new Date(),
        lastHeartbeatAt: new Date(),
      },
    );
    if (!activated) {
      return;
    }

    const attemptId = randomUUID();
    const attemptNumber = (jobRecord.attempts ?? 0) + 1;
    const workerId = `creative-worker-${process.pid}`;
    await CreativeGenerationJobModel.updateOne(
      { creativeJobId },
      { attempts: attemptNumber, lastHeartbeatAt: new Date() },
    );

    try {
      await this.setStage(creativeJobId, "loading_source", 10);
      const source = await this.eligibility.loadAndValidate({
        campaignPackageId: jobRecord.campaignPackageId,
        campaignPackageRevision: jobRecord.campaignPackageRevision,
        selectedBriefIds: jobRecord.selectedBriefIds ?? [],
        allowOverride: jobRecord.allowOverride,
      });

      await this.setStage(creativeJobId, "validating_briefs", 20);
      const sourceChecksum = createHash("sha256")
        .update(
          JSON.stringify({
            packageId: source.campaignPackage.campaignPackageId,
            revision: source.campaignPackage.currentRevision,
            briefs: source.briefs.map((brief) => brief.briefId),
          }),
        )
        .digest("hex");

      await CreativeGenerationAttemptModel.create({
        attemptId,
        creativeJobId,
        attemptNumber,
        workerId,
        stages: [],
        sourceSnapshotChecksum: sourceChecksum,
        generationFingerprint: jobRecord.generationFingerprint,
        imageProviderConfiguration: {
          provider: jobRecord.imageProviderPreference,
        },
        videoProviderConfiguration: {
          provider: jobRecord.videoProviderPreference,
        },
        renderConfiguration: {
          provider: jobRecord.renderProviderPreference,
        },
        brandProfileVersion: jobRecord.brandProfileVersion ?? null,
        platformPolicyVersion: jobRecord.platformPolicyVersion ?? null,
        compliancePolicyVersion: jobRecord.compliancePolicyVersion ?? null,
        immutable: true,
      });

      const imageProvider = jobRecord.imageProviderPreference ?? "disabled";
      const videoProvider = jobRecord.videoProviderPreference ?? "disabled";
      const assetTypes = jobRecord.selectedAssetTypes ?? [];
      const platforms =
        jobRecord.selectedPlatforms ?? source.campaignPackage.selectedPlatforms;
      const languages =
        jobRecord.targetLanguages?.length > 0
          ? jobRecord.targetLanguages
          : source.campaignPackage.targetLanguages;

      const needsImage = assetTypes.some((type) => IMAGE_ASSET_TYPES.has(type));
      const needsVideo = assetTypes.some((type) => VIDEO_ASSET_TYPES.has(type));
      const imageDisabled = needsImage && imageProvider === "disabled";
      const videoDisabled = needsVideo && videoProvider === "disabled";
      const providerUnavailable = imageDisabled || videoDisabled;

      if (
        (needsImage && imageProvider === "openai") ||
        (needsVideo && videoProvider === "runway")
      ) {
        await this.budget.assertWithinConcurrencyLimits({
          needsImage,
          needsVideo,
          imageProvider,
          videoProvider,
        });
        await this.budget.assertCostBudget();
      }

      await this.setStage(creativeJobId, "generating", 40);

      const involvesPayment =
        source.campaignPackage.reviewReasonCodes.includes("payment_service") ||
        source.reviewReasonCodes.includes("payment_campaign");
      const isMedicalOrLegal =
        source.reviewReasonCodes.includes("medical_campaign") ||
        source.reviewReasonCodes.includes("legal_campaign") ||
        source.campaignPackage.reviewReasonCodes.includes("regulated_domain");

      const paymentDisclosure =
        (source.campaignPackage.requiredDisclosures?.en as string | undefined) ??
        CAMPAIGN_PAYMENT_DISCLOSURES.en;

      const createdAssetIds: string[] = [];
      const allReasonCodes = new Set<CreativeReviewReasonCode>([
        ...(jobRecord.reviewReasonCodes ?? []),
        ...source.reviewReasonCodes,
      ]);
      let hasPendingProvider = false;

      for (const brief of source.briefs) {
        for (const assetType of assetTypes) {
          const isImage = IMAGE_ASSET_TYPES.has(assetType);
          const isVideo = VIDEO_ASSET_TYPES.has(assetType);
          const providerForType = isVideo ? videoProvider : imageProvider;
          const disabledForType =
            (isImage && imageDisabled) || (isVideo && videoDisabled);

          for (const platform of platforms.length > 0
            ? platforms
            : (["facebook"] as CampaignPlatform[])) {
            for (const language of languages.length > 0 ? languages : ["en"]) {
              if (
                createdAssetIds.length >=
                this.environment.CREATIVE_MAX_TOTAL_ASSETS_PER_JOB
              ) {
                break;
              }

              const assetId = randomUUID();
              const rightsRecordId = randomUUID();
              const provenanceManifestId = randomUUID();
              const locale =
                jobRecord.targetLocales?.find((item) =>
                  item.startsWith(language),
                ) ?? language;
              const expectedText =
                brief.expectedText ?? brief.textOverlay ?? null;
              let ocrText: string | null = null;
              let objectKey: string | undefined;
              let mimeType: string | undefined;
              let providerState = providerForType;
              let rightsStatus: CreativeRightsStatus = "unknown";
              let ownershipType:
                | "platform_synthetic"
                | "provider_generated"
                | "unknown" = "unknown";
              let rightsConfidence = 0;
              let providerJobId: string | undefined;
              let assetStatus:
                | "awaiting_review"
                | "provider_pending"
                | "provider_unavailable"
                | "failed" = disabledForType
                ? "provider_unavailable"
                : "awaiting_review";
              let usageRecord: ProviderGenerationResult["usage"];

              if (disabledForType) {
                providerState = "disabled";
                allReasonCodes.add(
                  isVideo ? "generated_video" : "generated_image",
                );
              } else if (providerForType === "mock") {
                const mockResult = await this.generateWithMock({
                  creativeJobId,
                  assetId,
                  brief,
                  assetType,
                  platform,
                  language,
                  isVideo,
                  expectedText,
                });
                objectKey = mockResult.objectKey;
                mimeType = mockResult.mimeType;
                rightsStatus = mockResult.rightsStatus;
                ownershipType = mockResult.ownershipType;
                rightsConfidence = mockResult.rightsConfidence;
                providerState = mockResult.providerState;
                ocrText = mockResult.ocrText ?? null;
                assetStatus = mockResult.assetStatus;
              } else if (providerForType === "openai" && isImage) {
                const live = await this.generateWithOpenAi({
                  creativeJobId,
                  attemptId,
                  assetId,
                  brief,
                  assetType,
                  language,
                });
                objectKey = live.objectKey;
                mimeType = live.mimeType;
                rightsStatus = live.rightsStatus;
                ownershipType = live.ownershipType;
                rightsConfidence = live.rightsConfidence;
                providerState = live.providerState;
                providerJobId = live.providerJobId;
                assetStatus = live.assetStatus;
                usageRecord = live.usage;
                allReasonCodes.add("generated_image");
                if (assetStatus === "provider_pending") {
                  hasPendingProvider = true;
                }
              } else if (providerForType === "runway" && isVideo) {
                const live = await this.generateWithRunway({
                  creativeJobId,
                  attemptId,
                  assetId,
                  brief,
                  assetType,
                  language,
                });
                objectKey = live.objectKey;
                mimeType = live.mimeType;
                rightsStatus = live.rightsStatus;
                ownershipType = live.ownershipType;
                rightsConfidence = live.rightsConfidence;
                providerState = live.providerState;
                providerJobId = live.providerJobId;
                assetStatus = live.assetStatus;
                usageRecord = live.usage;
                allReasonCodes.add("generated_video");
                if (assetStatus === "provider_pending") {
                  hasPendingProvider = true;
                }
              }

              const validation = this.validation.validate({
                brandName: "Miraaj.tech",
                textOverlay: brief.textOverlay ?? null,
                expectedText,
                ocrText,
                disclosureText: brief.disclosureText ?? null,
                involvesPayment,
                paymentDisclosureRequired: involvesPayment
                  ? paymentDisclosure
                  : null,
                isMedicalOrLegal,
                rightsStatus,
                likenessDetected: false,
              });
              for (const code of validation.reasonCodes) {
                allReasonCodes.add(code);
              }
              if (disabledForType) {
                allReasonCodes.add("manual_review_requested");
              }

              const scored = this.quality.score({
                sourceBriefQualityScore: 0.8,
                providerOutputQualityScore: disabledForType ? 0 : 0.75,
                technicalQualityScore: disabledForType ? 0 : 0.8,
                validation,
                isRtl: isRtlLanguage(language),
                hasSubtitles: isVideo,
                rightsConfidence,
              });

              await AssetRightsRecordModel.create({
                rightsRecordId,
                assetId,
                status: rightsStatus,
                ownershipType,
                likenessAuthorized: false,
                musicAuthorized: false,
                logoAuthorized: true,
                confidence: rightsConfidence,
                notes: disabledForType
                  ? "Provider disabled — rights unknown until reviewed."
                  : ownershipType === "platform_synthetic"
                    ? "Local synthetic mock asset owned by Miraaj.tech."
                    : ownershipType === "provider_generated"
                      ? "Provider-generated asset — commercial-use review required."
                      : "Rights unknown until human review.",
                correlationId: jobRecord.correlationId,
              });

              await CreativeProvenanceManifestModel.create({
                provenanceManifestId,
                assetId,
                creativeJobId,
                creativeAttemptId: attemptId,
                campaignPackageId: source.campaignPackage.campaignPackageId,
                briefId: brief.briefId,
                provider: providerState,
                model: isVideo
                  ? this.environment.AI_VIDEO_MODEL
                  : this.environment.AI_IMAGE_MODEL,
                brandProfileVersion: jobRecord.brandProfileVersion ?? null,
                sourceChecksum,
                generationFingerprint: jobRecord.generationFingerprint,
                steps: [
                  { stage: "generate", provider: providerState },
                  { stage: "validate", codes: validation.reasonCodes },
                ],
                immutable: true,
              });

              await CreativeAssetModel.create({
                assetId,
                creativeJobId,
                creativeAttemptId: attemptId,
                campaignPackageId: source.campaignPackage.campaignPackageId,
                campaignPackageRevision: source.campaignPackage.currentRevision,
                briefId: brief.briefId,
                briefType: brief.briefType,
                assetType,
                status: assetStatus,
                currentRevision: 1,
                platform,
                language,
                locale,
                direction: isRtlLanguage(language) ? "rtl" : "ltr",
                ...(objectKey ? { objectKey, bucket: this.storage.bucket } : {}),
                ...(mimeType ? { mimeType } : {}),
                ...(providerJobId ? { providerJobId } : {}),
                provider: providerState,
                providerState,
                textOverlay: brief.textOverlay ?? null,
                expectedText,
                ocrText,
                disclosureText:
                  brief.disclosureText ??
                  (involvesPayment ? paymentDisclosure : null),
                qualityBreakdown: scored.breakdown,
                penalties: scored.penalties,
                overallQualityScore: scored.breakdown.overallQualityScore,
                rightsRecordId,
                provenanceManifestId,
                requiresReview: true,
                reviewReasonCodes: [...validation.reasonCodes],
                reviewStatus: "pending",
                warnings: validation.errorCodes,
                correlationId: jobRecord.correlationId,
                createdBy: jobRecord.requestedBy,
                ...(usageRecord
                  ? {
                      usageMetadata: {
                        provider: usageRecord.provider,
                        model: usageRecord.model ?? null,
                        providerJobId: usageRecord.providerJobId ?? null,
                        usageUnavailable: Boolean(usageRecord.usageUnavailable),
                        costUnknown:
                          usageRecord.costUnknown !== false &&
                          typeof usageRecord.providerReportedCost !== "number",
                        ...(typeof usageRecord.providerReportedCost === "number"
                          ? {
                              providerReportedCost:
                                usageRecord.providerReportedCost,
                            }
                          : {}),
                        recordedAt: new Date().toISOString(),
                      },
                    }
                  : {}),
              });

              if (usageRecord) {
                await this.usage.recordAttemptUsage(attemptId, usageRecord);
              }

              if (
                !disabledForType &&
                assetStatus === "awaiting_review" &&
                this.environment.AI_RENDER_PROVIDER === "local"
              ) {
                await this.setStage(creativeJobId, "rendering_variants", 70);
                const renderSpecs =
                  await CreativeRenderSpecificationModel.find({
                    platform,
                    status: "active",
                  })
                    .limit(this.environment.CREATIVE_MAX_VARIANTS_PER_BRIEF)
                    .lean();
                for (const spec of renderSpecs) {
                  const variantId = randomUUID();
                  let variantKey: string | undefined;
                  if (objectKey) {
                    variantKey = this.storage.buildVariantObjectKey(
                      assetId,
                      variantId,
                      isVideo ? "mp4" : "png",
                    );
                    await this.storage.putBinaryObject({
                      objectKey: variantKey,
                      body: Buffer.from(
                        `miraaj-creative-variant:${variantId}`,
                      ),
                      contentType: mimeType ?? "application/octet-stream",
                    });
                    if (expectedText) {
                      await this.aiClient.postCreativeRenderTextOverlay({
                        assetId,
                        variantId,
                        text: expectedText,
                      });
                    }
                    if (isVideo) {
                      await this.aiClient.postCreativeRenderSubtitles({
                        assetId,
                        variantId,
                        language,
                      });
                    }
                  }
                  await CreativeAssetVariantModel.create({
                    variantId,
                    assetId,
                    creativeJobId,
                    platform,
                    renderSpecId: spec.renderSpecId,
                    renderSpecVersion: spec.version,
                    aspectRatio: spec.aspectRatio,
                    width: spec.width,
                    height: spec.height,
                    language,
                    locale,
                    direction: isRtlLanguage(language) ? "rtl" : "ltr",
                    ...(variantKey
                      ? { objectKey: variantKey, bucket: this.storage.bucket }
                      : {}),
                    mimeType: mimeType ?? null,
                    textOverlayApplied: Boolean(expectedText),
                    subtitlesApplied: isVideo,
                    status: "awaiting_review",
                  });
                }
              }

              createdAssetIds.push(assetId);
            }
          }
        }
      }

      await this.setStage(creativeJobId, "scoring", 90);

      const finalStatus = hasPendingProvider
        ? "provider_pending"
        : providerUnavailable
          ? "provider_unavailable"
          : "awaiting_review";

      await CreativeGenerationJobModel.updateOne(
        { creativeJobId },
        {
          status: finalStatus,
          currentStage: finalStatus,
          progress: hasPendingProvider ? 60 : 100,
          assetIds: createdAssetIds,
          requiresReview: true,
          reviewReasonCodes: [...allReasonCodes],
          ...(hasPendingProvider ? {} : { completedAt: new Date() }),
          lastHeartbeatAt: new Date(),
          ...(providerUnavailable
            ? {
                errorCode: "CREATIVE_PROVIDER_DISABLED",
                safeError:
                  "One or more creative providers are disabled; asset stubs require review.",
              }
            : {}),
        },
      );

      await CreativeGenerationAttemptModel.updateOne(
        { attemptId },
        {
          completedAt: new Date(),
          timing: { durationMs: Date.now() - started },
          warnings: providerUnavailable
            ? ["provider_disabled_stubs_created"]
            : hasPendingProvider
              ? ["provider_pending_poll"]
              : [],
        },
      );

      this.logger.info(
        {
          event: "ai.creative.job.completed",
          creativeJobId,
          assetCount: createdAssetIds.length,
          status: finalStatus,
        },
        "Creative job finished",
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Creative job failed.";
      const code =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        typeof (error).code === "string"
          ? (error as { code: string }).code
          : "CREATIVE_PROVIDER_JOB_FAILED";

      await this.failJob(creativeJobId, code, message);
      if ((jobRecord.attempts ?? 0) + 1 >= (jobRecord.maxAttempts ?? 3)) {
        await this.queueService.moveToDeadLetter({
          creativeJobId,
          errorCode: "CREATIVE_PROVIDER_JOB_FAILED",
          message,
        });
        await CreativeGenerationJobModel.updateOne(
          { creativeJobId },
          { status: "dead_letter", currentStage: "dead_letter" },
        );
      }
      throw error;
    }
  }

  private async generateWithMock(input: {
    creativeJobId: string;
    assetId: string;
    brief: CreativeBriefRef;
    assetType: string;
    platform: string;
    language: string;
    isVideo: boolean;
    expectedText: string | null;
  }): Promise<ProviderGenerationResult> {
    await this.setStage(input.creativeJobId, "provider_pending", 50);
    try {
      if (input.isVideo) {
        await this.aiClient.postCreativeGenerateVideo({
          creativeJobId: input.creativeJobId,
          assetId: input.assetId,
          briefId: input.brief.briefId,
          assetType: input.assetType,
          platform: input.platform,
          language: input.language,
        });
      } else {
        await this.aiClient.postCreativeGenerateImage({
          creativeJobId: input.creativeJobId,
          assetId: input.assetId,
          briefId: input.brief.briefId,
          assetType: input.assetType,
          platform: input.platform,
          language: input.language,
        });
      }
      await this.aiClient.postCreativeValidateMedia({
        assetId: input.assetId,
        assetType: input.assetType,
      });
      const ocrResult = await this.aiClient.postCreativeOcrCheck({
        assetId: input.assetId,
        expectedText: input.expectedText ?? "",
      });
      const ocrText =
        typeof ocrResult.ocrText === "string"
          ? ocrResult.ocrText
          : input.expectedText;
      const extension = input.isVideo ? "mp4" : "png";
      const objectKey = this.storage.buildAssetObjectKey(
        input.assetId,
        extension,
      );
      const mimeType = input.isVideo ? "video/mp4" : "image/png";
      const synthetic = Buffer.from(
        `miraaj-creative-mock:${input.assetId}:${input.assetType}`,
      );
      await this.storage.putBinaryObject({
        objectKey,
        body: synthetic,
        contentType: mimeType,
      });
      return {
        objectKey,
        mimeType,
        rightsStatus: "verified",
        ownershipType: "platform_synthetic",
        rightsConfidence: 0.95,
        providerState: "mock",
        ocrText,
        assetStatus: "awaiting_review",
      };
    } catch (error: unknown) {
      this.logger.warn(
        {
          event: "ai.creative.provider.mock_failed",
          assetId: input.assetId,
          safeError: error instanceof Error ? error.message : "unknown",
        },
        "Mock creative provider call failed; continuing with stub",
      );
      return {
        rightsStatus: "unknown",
        ownershipType: "unknown",
        rightsConfidence: 0,
        providerState: "mock",
        assetStatus: "awaiting_review",
      };
    }
  }

  private async generateWithOpenAi(input: {
    creativeJobId: string;
    attemptId: string;
    assetId: string;
    brief: CreativeBriefRef;
    assetType: string;
    language: string;
  }): Promise<ProviderGenerationResult> {
    await this.setStage(input.creativeJobId, "provider_pending", 50);
    const { prompt, negativePrompt } = buildCreativeProviderPrompt(input.brief);
    const dims = defaultDimensionsForAssetType(input.assetType);

    this.logger.info(
      {
        event: "ai.provider.job.submitted",
        provider: "openai",
        creativeJobId: input.creativeJobId,
        assetId: input.assetId,
        assetType: input.assetType,
      },
      "OpenAI image generation submitted",
    );

    const response = await this.aiClient.postCreativeGenerateImage({
      prompt,
      negativePrompt,
      assetType: input.assetType,
      width: dims.width,
      height: dims.height,
      language: input.language,
      jobId: input.creativeJobId,
      briefId: input.brief.briefId,
      conceptTitle: input.brief.conceptTitle ?? null,
      visualNarrative: input.brief.visualNarrative ?? null,
      requiredElements: input.brief.requiredElements ?? [],
      prohibitedElements: input.brief.prohibitedElements ?? [],
      brandPlacement: "Miraaj.tech",
    });

    if (response.accepted === false) {
      throw Object.assign(new Error("OpenAI image provider failed."), {
        code: "CREATIVE_PROVIDER_JOB_FAILED",
      });
    }

    const data = (response.data ?? response) as Record<string, unknown>;
    const usage = this.extractUsage(data, "openai");
    this.budget.assertJobCostLimit(usage.providerReportedCost);
    await this.usage.recordAttemptUsage(input.attemptId, usage);

    const status = typeof data.status === "string" ? data.status : "completed";
    const providerJobId =
      typeof data.providerJobId === "string" ? data.providerJobId : undefined;
    const media = (data.media ?? null) as Record<string, unknown> | null;
    const contentBase64 =
      typeof media?.contentBase64 === "string" ? media.contentBase64 : null;

    if (contentBase64) {
      const bytes = Buffer.from(contentBase64, "base64");
      const mimeType =
        typeof media?.mimeType === "string" ? media.mimeType : "image/png";
      const extension = mimeType.includes("jpeg") ? "jpg" : "png";
      const objectKey = this.storage.buildAssetObjectKey(
        input.assetId,
        extension,
      );
      await this.storage.putBinaryObject({
        objectKey,
        body: bytes,
        contentType: mimeType,
      });
      this.logger.info(
        {
          event: "ai.provider.job.completed",
          provider: "openai",
          creativeJobId: input.creativeJobId,
          assetId: input.assetId,
          byteLength: bytes.byteLength,
        },
        "OpenAI image stored privately",
      );
      return {
        objectKey,
        mimeType,
        rightsStatus: "review_required",
        ownershipType: "provider_generated",
        rightsConfidence: 0.4,
        providerState: "openai",
        ...(providerJobId ? { providerJobId } : {}),
        assetStatus: "awaiting_review",
        usage,
      };
    }

    if (status === "provider_pending" && providerJobId) {
      this.logger.info(
        {
          event: "ai.provider.job.pending",
          provider: "openai",
          creativeJobId: input.creativeJobId,
          assetId: input.assetId,
        },
        "OpenAI image awaiting retrieve",
      );
      return {
        rightsStatus: "review_required",
        ownershipType: "provider_generated",
        rightsConfidence: 0.3,
        providerState: "openai",
        providerJobId,
        assetStatus: "provider_pending",
        usage,
      };
    }

    throw Object.assign(new Error("OpenAI image output missing."), {
      code: "CREATIVE_PROVIDER_JOB_FAILED",
    });
  }

  private async generateWithRunway(input: {
    creativeJobId: string;
    attemptId: string;
    assetId: string;
    brief: CreativeBriefRef;
    assetType: string;
    language: string;
  }): Promise<ProviderGenerationResult> {
    await this.setStage(input.creativeJobId, "provider_pending", 50);
    const { prompt, negativePrompt } = buildCreativeProviderPrompt(input.brief);
    const dims = defaultDimensionsForAssetType(input.assetType);

    this.logger.info(
      {
        event: "ai.provider.job.submitted",
        provider: "runway",
        creativeJobId: input.creativeJobId,
        assetId: input.assetId,
        assetType: input.assetType,
      },
      "Runway video generation submitted",
    );

    const response = await this.aiClient.postCreativeGenerateVideo({
      prompt,
      negativePrompt,
      assetType: input.assetType,
      width: Math.min(dims.width, 1280),
      height: Math.min(dims.height, 1280),
      durationSeconds: 4,
      language: input.language,
      jobId: input.creativeJobId,
      briefId: input.brief.briefId,
    });

    if (response.accepted === false) {
      throw Object.assign(new Error("Runway video provider failed."), {
        code: "CREATIVE_PROVIDER_JOB_FAILED",
      });
    }

    const data = (response.data ?? response) as Record<string, unknown>;
    let usage = this.extractUsage(data, "runway");
    this.budget.assertJobCostLimit(usage.providerReportedCost);
    await this.usage.recordAttemptUsage(input.attemptId, usage);

    let status = typeof data.status === "string" ? data.status : "completed";
    const providerJobId =
      typeof data.providerJobId === "string" ? data.providerJobId : undefined;
    let media = (data.media ?? null) as Record<string, unknown> | null;

    if (status === "provider_pending" && providerJobId) {
      const polled = await this.pollProviderJob({
        creativeJobId: input.creativeJobId,
        providerJobId,
        providerType: "runway",
      });
      status = polled.status;
      media = polled.media;
      if (polled.usage) {
        usage = polled.usage;
        await this.usage.recordAttemptUsage(input.attemptId, usage);
      }
      if (status === "provider_pending") {
        return {
          rightsStatus: "review_required",
          ownershipType: "provider_generated",
          rightsConfidence: 0.3,
          providerState: "runway",
          providerJobId,
          assetStatus: "provider_pending",
          usage,
        };
      }
    }

    const contentBase64 =
      typeof media?.contentBase64 === "string" ? media.contentBase64 : null;
    if (contentBase64) {
      await this.setStage(input.creativeJobId, "retrieving", 65);
      const bytes = Buffer.from(contentBase64, "base64");
      const mimeType =
        typeof media?.mimeType === "string" ? media.mimeType : "video/mp4";
      const objectKey = this.storage.buildAssetObjectKey(input.assetId, "mp4");
      await this.storage.putBinaryObject({
        objectKey,
        body: bytes,
        contentType: mimeType,
      });
      this.logger.info(
        {
          event: "ai.provider.job.completed",
          provider: "runway",
          creativeJobId: input.creativeJobId,
          assetId: input.assetId,
          byteLength: bytes.byteLength,
        },
        "Runway video stored privately",
      );
      return {
        objectKey,
        mimeType,
        rightsStatus: "review_required",
        ownershipType: "provider_generated",
        rightsConfidence: 0.4,
        providerState: "runway",
        ...(providerJobId ? { providerJobId } : {}),
        assetStatus: "awaiting_review",
        usage,
      };
    }

    if (status === "failed" || status === "cancelled") {
      throw Object.assign(new Error("Runway video provider job failed."), {
        code: "CREATIVE_PROVIDER_JOB_FAILED",
      });
    }

    throw Object.assign(new Error("Runway video output missing."), {
      code: "CREATIVE_PROVIDER_JOB_FAILED",
    });
  }

  private async pollProviderJob(input: {
    creativeJobId: string;
    providerJobId: string;
    providerType: "runway" | "openai";
  }): Promise<{
    status: string;
    media: Record<string, unknown> | null;
    usage?: ProviderGenerationResult["usage"];
  }> {
    const maxAttempts = this.environment.AI_VIDEO_PROVIDER_MAX_POLL_ATTEMPTS;
    const intervalSeconds =
      this.environment.AI_VIDEO_PROVIDER_POLL_INTERVAL_SECONDS;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      await CreativeGenerationJobModel.updateOne(
        { creativeJobId: input.creativeJobId },
        { lastHeartbeatAt: new Date(), status: "provider_pending" },
      );

      const response = await this.aiClient.getCreativeProviderJobStatus(
        input.providerJobId,
        input.providerType,
      );
      const data = (response.data ?? response) as Record<string, unknown>;
      const status = typeof data.status === "string" ? data.status : "provider_pending";
      const media = (data.media ?? null) as Record<string, unknown> | null;
      const usage = this.extractUsage(data, input.providerType);

      this.logger.info(
        {
          event: "ai.provider.job.poll",
          provider: input.providerType,
          creativeJobId: input.creativeJobId,
          pollAttempt: attempt + 1,
          status,
        },
        "Provider job poll",
      );

      if (status === "completed" || status === "failed" || status === "cancelled") {
        return { status, media, usage };
      }

      if (typeof media?.contentBase64 === "string") {
        return { status: "completed", media, usage };
      }

      if (attempt < maxAttempts - 1) {
        await delay(intervalSeconds * 1_000);
      }
    }

    return { status: "provider_pending", media: null };
  }

  /**
   * Resume async provider jobs after worker restart: poll assets that still
   * have providerJobId + provider_pending and finalize when media is ready.
   */
  private async reconcilePendingProviderAssets(): Promise<void> {
    const pending = await CreativeAssetModel.find({
      status: "provider_pending",
      providerJobId: { $exists: true, $nin: [null, ""] },
      providerState: { $in: ["runway", "openai"] },
    })
      .limit(20)
      .lean();

    for (const asset of pending) {
      const providerJobId = asset.providerJobId as string;
      const providerType =
        asset.providerState === "openai" ? "openai" : "runway";
      try {
        const response = await this.aiClient.getCreativeProviderJobStatus(
          providerJobId,
          providerType,
        );
        const data = (response.data ?? response) as Record<string, unknown>;
        const status =
          typeof data.status === "string" ? data.status : "provider_pending";
        const media = (data.media ?? null) as Record<string, unknown> | null;
        const contentBase64 =
          typeof media?.contentBase64 === "string"
            ? media.contentBase64
            : null;

        if (contentBase64) {
          const isVideo = providerType === "runway";
          const bytes = Buffer.from(contentBase64, "base64");
          const mimeType =
            typeof media?.mimeType === "string"
              ? media.mimeType
              : isVideo
                ? "video/mp4"
                : "image/png";
          const objectKey = this.storage.buildAssetObjectKey(
            asset.assetId,
            isVideo ? "mp4" : "png",
          );
          await this.storage.putBinaryObject({
            objectKey,
            body: bytes,
            contentType: mimeType,
          });
          await CreativeAssetModel.updateOne(
            { assetId: asset.assetId },
            {
              status: "awaiting_review",
              objectKey,
              bucket: this.storage.bucket,
              mimeType,
              requiresReview: true,
            },
          );
          await CreativeGenerationJobModel.updateOne(
            {
              creativeJobId: asset.creativeJobId,
              status: "provider_pending",
            },
            {
              status: "awaiting_review",
              currentStage: "awaiting_review",
              progress: 100,
              completedAt: new Date(),
              lastHeartbeatAt: new Date(),
            },
          );
          this.logger.info(
            {
              event: "ai.provider.job.reconciled",
              provider: providerType,
              assetId: asset.assetId,
            },
            "Pending provider asset reconciled",
          );
        } else if (status === "failed" || status === "cancelled") {
          await CreativeAssetModel.updateOne(
            { assetId: asset.assetId },
            { status: "failed", requiresReview: true },
          );
        } else {
          await CreativeGenerationJobModel.updateOne(
            { creativeJobId: asset.creativeJobId },
            { lastHeartbeatAt: new Date() },
          );
        }
      } catch (error: unknown) {
        this.logger.warn(
          {
            event: "ai.provider.job.reconcile_failed",
            assetId: asset.assetId,
            safeError: error instanceof Error ? error.message : "unknown",
          },
          "Failed to reconcile pending provider asset",
        );
      }
    }
  }

  private extractUsage(
    data: Record<string, unknown>,
    fallbackProvider: string,
  ): NonNullable<ProviderGenerationResult["usage"]> {
    const usage = (data.usage ?? null) as Record<string, unknown> | null;
    const providerReportedCost =
      typeof usage?.providerReportedCost === "number"
        ? usage.providerReportedCost
        : null;
    return {
      provider:
        typeof usage?.provider === "string"
          ? usage.provider
          : typeof data.provider === "string"
            ? data.provider
            : fallbackProvider,
      model:
        typeof usage?.model === "string"
          ? usage.model
          : typeof data.model === "string"
            ? data.model
            : null,
      providerJobId:
        typeof usage?.providerJobId === "string"
          ? usage.providerJobId
          : typeof data.providerJobId === "string"
            ? data.providerJobId
            : null,
      usageUnavailable: !usage,
      costUnknown:
        usage?.costUnknown !== false && providerReportedCost === null,
      providerReportedCost,
    };
  }

  private async setStage(
    creativeJobId: string,
    stage: string,
    progress: number,
  ): Promise<void> {
    await CreativeGenerationJobModel.updateOne(
      { creativeJobId },
      {
        status: stage,
        currentStage: stage,
        progress,
        lastHeartbeatAt: new Date(),
      },
    );
  }

  private async failJob(
    creativeJobId: string,
    errorCode: string,
    safeError: string,
  ): Promise<void> {
    await CreativeGenerationJobModel.updateOne(
      { creativeJobId },
      {
        status: "failed",
        currentStage: "failed",
        errorCode,
        safeError,
        failedAt: new Date(),
        lastHeartbeatAt: new Date(),
      },
    );
  }

  private async reconcileStaleJobs(): Promise<void> {
    const cutoff = new Date(
      Date.now() - this.environment.AI_CREATIVE_STALE_SECONDS * 1_000,
    );
    const stale = await CreativeGenerationJobModel.find({
      status: {
        $in: [
          "active",
          "loading_source",
          "validating_briefs",
          "generating",
          "provider_pending",
          "retrieving",
          "validating_media",
          "normalizing",
          "rendering_variants",
          "validating_text",
          "scoring",
        ],
      },
      lastHeartbeatAt: { $lt: cutoff },
    }).lean();

    for (const job of stale) {
      // Keep provider_pending jobs alive while assets still poll.
      if (job.status === "provider_pending") {
        const pendingAssets = await CreativeAssetModel.countDocuments({
          creativeJobId: job.creativeJobId,
          status: "provider_pending",
        });
        if (pendingAssets > 0) {
          await CreativeGenerationJobModel.updateOne(
            { creativeJobId: job.creativeJobId },
            { lastHeartbeatAt: new Date() },
          );
          continue;
        }
      }

      await CreativeGenerationJobModel.updateOne(
        { creativeJobId: job.creativeJobId },
        {
          status: "queued",
          currentStage: "queued",
          queuedAt: new Date(),
          lastHeartbeatAt: new Date(),
        },
      );
      try {
        await this.queueService.enqueueBuildCreativeJob(
          {
            creativeJobId: job.creativeJobId,
            campaignPackageId: job.campaignPackageId,
          },
          { uniqueJobId: true },
        );
        this.logger.warn(
          {
            event: "ai.creative.job.stale_requeued",
            creativeJobId: job.creativeJobId,
          },
          "Stale creative job requeued",
        );
      } catch (error: unknown) {
        this.logger.error(
          {
            event: "ai.creative.job.stale_requeue_failed",
            creativeJobId: job.creativeJobId,
            safeError: error instanceof Error ? error.message : "unknown",
          },
          "Failed to requeue stale creative job",
        );
      }
    }
  }
}
