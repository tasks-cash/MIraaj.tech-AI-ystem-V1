import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Worker, type Job } from "bullmq";
import { createHash, randomUUID } from "node:crypto";
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
import { CreativeQualityService } from "./creative-quality.service.js";
import { CreativeSourceEligibilityService } from "./creative-source-eligibility.service.js";
import { CreativeStorageService } from "./creative-storage.service.js";
import { CreativeValidationService } from "./creative-validation.service.js";
import {
  CreativeQueueService,
  type BuildCreativeJobPayload,
} from "../queue/creative-queue.service.js";
import { IMAGE_ASSET_TYPES, VIDEO_ASSET_TYPES } from "./creative-job.service.js";

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
      () => void this.reconcileStaleJobs(),
      this.environment.AI_CREATIVE_RECONCILE_INTERVAL_SECONDS * 1_000,
    );
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
      const assetTypes = (jobRecord.selectedAssetTypes ??
        []);
      const platforms = (jobRecord.selectedPlatforms ??
        source.campaignPackage.selectedPlatforms);
      const languages =
        jobRecord.targetLanguages?.length > 0
          ? jobRecord.targetLanguages
          : source.campaignPackage.targetLanguages;

      const needsImage = assetTypes.some((type) => IMAGE_ASSET_TYPES.has(type));
      const needsVideo = assetTypes.some((type) => VIDEO_ASSET_TYPES.has(type));
      const imageDisabled = needsImage && imageProvider === "disabled";
      const videoDisabled = needsVideo && videoProvider === "disabled";
      const providerUnavailable = imageDisabled || videoDisabled;

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

      for (const brief of source.briefs) {
        for (const assetType of assetTypes) {
          const isImage = IMAGE_ASSET_TYPES.has(assetType);
          const isVideo = VIDEO_ASSET_TYPES.has(assetType);
          const providerForType = isVideo ? videoProvider : imageProvider;
          const disabledForType =
            (isImage && imageDisabled) || (isVideo && videoDisabled);

          for (const platform of (platforms.length > 0
            ? platforms
            : (["facebook"] as CampaignPlatform[]))) {
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

              if (disabledForType) {
                providerState = "disabled";
                allReasonCodes.add(
                  isVideo ? "generated_video" : "generated_image",
                );
                // Do NOT invent media bytes when providers are disabled.
              } else if (providerForType === "mock") {
                await this.setStage(creativeJobId, "provider_pending", 50);
                try {
                  if (isVideo) {
                    await this.aiClient.postCreativeGenerateVideo({
                      creativeJobId,
                      assetId,
                      briefId: brief.briefId,
                      assetType,
                      platform,
                      language,
                    });
                  } else {
                    await this.aiClient.postCreativeGenerateImage({
                      creativeJobId,
                      assetId,
                      briefId: brief.briefId,
                      assetType,
                      platform,
                      language,
                    });
                  }
                  await this.aiClient.postCreativeValidateMedia({
                    assetId,
                    assetType,
                  });
                  const ocrResult = await this.aiClient.postCreativeOcrCheck({
                    assetId,
                    expectedText: expectedText ?? "",
                  });
                  ocrText =
                    typeof ocrResult.ocrText === "string"
                      ? ocrResult.ocrText
                      : expectedText;
                  // Local synthetic mock bytes owned by the platform.
                  const extension = isVideo ? "mp4" : "png";
                  objectKey = this.storage.buildAssetObjectKey(
                    assetId,
                    extension,
                  );
                  mimeType = isVideo ? "video/mp4" : "image/png";
                  const synthetic = Buffer.from(
                    `miraaj-creative-mock:${assetId}:${assetType}`,
                  );
                  await this.storage.putBinaryObject({
                    objectKey,
                    body: synthetic,
                    contentType: mimeType,
                  });
                  rightsStatus = "verified";
                  ownershipType = "platform_synthetic";
                  rightsConfidence = 0.95;
                  providerState = "mock";
                } catch (error: unknown) {
                  this.logger.warn(
                    {
                      event: "ai.creative.provider.mock_failed",
                      assetId,
                      safeError:
                        error instanceof Error ? error.message : "unknown",
                    },
                    "Mock creative provider call failed; continuing with stub",
                  );
                  rightsStatus = "unknown";
                  ownershipType = "unknown";
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

              const assetStatus = disabledForType
                ? "provider_unavailable"
                : "awaiting_review";

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
              });

              if (
                !disabledForType &&
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

      const finalStatus = providerUnavailable
        ? "provider_unavailable"
        : "awaiting_review";

      await CreativeGenerationJobModel.updateOne(
        { creativeJobId },
        {
          status: finalStatus,
          currentStage: finalStatus,
          progress: 100,
          assetIds: createdAssetIds,
          requiresReview: true,
          reviewReasonCodes: [...allReasonCodes],
          completedAt: new Date(),
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
