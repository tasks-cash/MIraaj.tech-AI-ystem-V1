import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import { createLogger } from "@miraaj/shared-logging";
import {
  CAMPAIGN_PLATFORMS,
  CREATIVE_ASSET_TYPES,
  getLanguageDefinition,
  type CampaignPlatform,
  type CreativeAssetType,
  type CreativeGenerationJobStatus,
  type CreativeImageProvider,
  type CreativeVideoProvider,
} from "@miraaj/shared-types";
import { loadEnvironment } from "../../../environment.js";
import { InfrastructureService } from "../../../infrastructure.service.js";
import {
  CreativeGenerationJobModel,
  type CreativeGenerationJobDocument,
} from "../models/creative.schema.js";
import { CreativeSourceEligibilityService } from "./creative-source-eligibility.service.js";
import { CreativeSeedService } from "./creative-seed.service.js";
import { CreativeQueueService } from "../queue/creative-queue.service.js";

const TERMINAL_NON_REUSABLE_STATUSES = new Set<CreativeGenerationJobStatus>([
  "failed",
  "cancelled",
  "dead_letter",
]);

const IMAGE_ASSET_TYPES = new Set<string>([
  "image_post",
  "square_image",
  "portrait_image",
  "landscape_image",
  "story_frame",
  "carousel_slide",
  "carousel_cover",
  "thumbnail",
  "banner",
  "infographic",
  "product_mockup",
  "interface_mockup",
  "video_thumbnail",
  "poster_frame",
  "preview_image",
]);

const VIDEO_ASSET_TYPES = new Set<string>([
  "short_video",
  "vertical_video",
  "landscape_video",
  "square_video",
  "reel",
  "short",
  "story_video",
  "explainer_video",
  "product_demo_video",
  "animated_graphic",
  "motion_graphic",
  "preview_video",
]);

export interface CreateCreativeJobInput {
  campaignPackageId: string;
  campaignPackageRevision?: number;
  selectedBriefIds?: string[];
  selectedAssetTypes: CreativeAssetType[];
  selectedPlatforms?: CampaignPlatform[];
  targetLanguages?: string[];
  targetLocales?: string[];
  imageProviderPreference?: CreativeImageProvider;
  videoProviderPreference?: CreativeVideoProvider;
  allowOverride?: boolean;
  manualReviewRequested?: boolean;
  forceRegeneration?: boolean;
  idempotencyKey?: string;
  correlationId?: string;
  requestId?: string;
  requestedBy: string;
}

/**
 * Creates and manages creative generation jobs. NestJS owns source eligibility,
 * provider bounds, and queueing — media bytes are only produced later by the
 * worker (or left as stubs when providers are disabled).
 */
@Injectable()
export class CreativeJobService {
  private readonly environment = loadEnvironment();
  private readonly logger = createLogger({
    service: "miraaj-api",
    environment: this.environment.APP_ENV,
    level: this.environment.LOG_LEVEL,
  });

  constructor(
    @Inject(InfrastructureService)
    private readonly infrastructure: InfrastructureService,
    @Inject(CreativeSourceEligibilityService)
    private readonly eligibility: CreativeSourceEligibilityService,
    @Inject(CreativeSeedService)
    private readonly creativeSeed: CreativeSeedService,
    @Inject(CreativeQueueService)
    private readonly queue: CreativeQueueService,
  ) {}

  async createJob(input: CreateCreativeJobInput): Promise<Record<string, unknown>> {
    await this.assertCreateRateLimit();
    this.assertRequestShape(input);

    const source = await this.eligibility.loadAndValidate({
      campaignPackageId: input.campaignPackageId,
      ...(input.campaignPackageRevision !== undefined
        ? { campaignPackageRevision: input.campaignPackageRevision }
        : {}),
      ...(input.selectedBriefIds ? { selectedBriefIds: input.selectedBriefIds } : {}),
      ...(input.allowOverride !== undefined
        ? { allowOverride: input.allowOverride }
        : {}),
    });

    const modelPolicy = await this.creativeSeed.getActiveModelPolicyOrThrow();
    const briefCount = source.briefs.length;
    if (briefCount > this.environment.CREATIVE_MAX_BRIEFS_PER_JOB) {
      throw new BadRequestException({
        code: "CREATIVE_GENERATION_LIMIT_EXCEEDED",
        message: `A creative job may reference at most ${this.environment.CREATIVE_MAX_BRIEFS_PER_JOB} briefs.`,
      });
    }

    const platforms =
      input.selectedPlatforms && input.selectedPlatforms.length > 0
        ? input.selectedPlatforms
        : (source.campaignPackage.selectedPlatforms as CampaignPlatform[]);
    const languages =
      input.targetLanguages && input.targetLanguages.length > 0
        ? input.targetLanguages
        : source.campaignPackage.targetLanguages;
    const estimatedAssets =
      briefCount *
      input.selectedAssetTypes.length *
      Math.max(platforms.length, 1) *
      Math.min(
        Math.max(languages.length, 1),
        this.environment.CREATIVE_MAX_VARIANTS_PER_BRIEF,
      );
    if (estimatedAssets > this.environment.CREATIVE_MAX_TOTAL_ASSETS_PER_JOB) {
      throw new BadRequestException({
        code: "CREATIVE_GENERATION_LIMIT_EXCEEDED",
        message: `Estimated assets (${estimatedAssets}) exceed CREATIVE_MAX_TOTAL_ASSETS_PER_JOB.`,
      });
    }

    const imageProvider =
      input.imageProviderPreference ??
      (this.environment.AI_IMAGE_PROVIDER);
    const videoProvider =
      input.videoProviderPreference ??
      (this.environment.AI_VIDEO_PROVIDER);

    const needsImage = input.selectedAssetTypes.some((type) =>
      IMAGE_ASSET_TYPES.has(type),
    );
    const needsVideo = input.selectedAssetTypes.some((type) =>
      VIDEO_ASSET_TYPES.has(type),
    );
    if (needsImage && imageProvider === "disabled") {
      // Allowed: worker will create provider_unavailable stubs instead of failing create.
    }
    if (needsVideo && videoProvider === "disabled") {
      // Allowed: worker will create provider_unavailable stubs instead of failing create.
    }

    const briefIds = source.briefs.map((brief) => brief.briefId).sort();
    const generationFingerprint = createHash("sha256")
      .update(
        JSON.stringify({
          packageId: input.campaignPackageId,
          revision: source.campaignPackage.currentRevision,
          briefIds,
          assetTypes: [...input.selectedAssetTypes].sort(),
          platforms: [...platforms].sort(),
          languages: [...languages].sort(),
          providers: {
            image: imageProvider,
            video: videoProvider,
            render: this.environment.AI_RENDER_PROVIDER,
          },
        }),
      )
      .digest("hex");

    const existingJob = await CreativeGenerationJobModel.findOne({
      generationFingerprint,
      status: { $nin: [...TERMINAL_NON_REUSABLE_STATUSES] },
    }).lean();
    if (existingJob && !input.forceRegeneration) {
      return this.toJobResponse(existingJob, { reused: true });
    }

    const idempotencyKeyHash = input.idempotencyKey
      ? createHash("sha256").update(input.idempotencyKey).digest("hex")
      : undefined;
    if (idempotencyKeyHash) {
      const idempotentJob = await CreativeGenerationJobModel.findOne({
        idempotencyKeyHash,
      }).lean();
      if (idempotentJob) {
        return this.toJobResponse(idempotentJob, { reused: true });
      }
    }

    const creativeJobId = randomUUID();
    const correlationId = input.correlationId ?? randomUUID();
    const job = await CreativeGenerationJobModel.create({
      creativeJobId,
      campaignPackageId: input.campaignPackageId,
      campaignPackageRevision: source.campaignPackage.currentRevision,
      campaignBriefId: source.campaignPackage.campaignBriefId,
      campaignId: source.campaignPackage.campaignId,
      status: "queued",
      queueName: this.environment.AI_CREATIVE_QUEUE_NAME,
      requestedBy: input.requestedBy,
      ...(idempotencyKeyHash ? { idempotencyKeyHash } : {}),
      generationFingerprint,
      correlationId,
      requestId: input.requestId ?? randomUUID(),
      imageProviderPreference: imageProvider,
      videoProviderPreference: videoProvider,
      renderProviderPreference: this.environment.AI_RENDER_PROVIDER,
      selectedBriefIds: briefIds,
      selectedAssetTypes: input.selectedAssetTypes,
      selectedPlatforms: platforms,
      targetLanguages: languages,
      targetLocales:
        input.targetLocales ?? source.campaignPackage.targetLocales ?? [],
      brandProfileId: source.campaignPackage.brandProfileId,
      brandProfileVersion: source.campaignPackage.brandProfileVersion,
      platformPolicyVersion: source.campaignPackage.platformPolicyVersion,
      compliancePolicyVersion: source.campaignPackage.compliancePolicyVersion,
      forceRegeneration: Boolean(input.forceRegeneration),
      manualReviewRequested: Boolean(input.manualReviewRequested),
      allowOverride: Boolean(input.allowOverride),
      maxAttempts: this.environment.AI_CREATIVE_MAX_RETRIES + 1,
      requiresReview: true,
      reviewReasonCodes: [
        ...new Set([
          ...source.reviewReasonCodes,
          ...(input.manualReviewRequested
            ? (["manual_review_requested"] as const)
            : []),
          ...(needsImage ? (["generated_image"] as const) : []),
          ...(needsVideo ? (["generated_video"] as const) : []),
        ]),
      ],
      queuedAt: new Date(),
      // Pin model policy version metadata without mutating auto-approve (always false).
      renderSpecVersion: modelPolicy.version,
    });

    const bullJob = await this.queue.enqueueBuildCreativeJob({
      creativeJobId,
      campaignPackageId: input.campaignPackageId,
    });
    job.bullJobId = String(bullJob.id);
    await job.save();

    this.logger.info(
      {
        event: "ai.creative.job.queued",
        creativeJobId,
        campaignPackageId: input.campaignPackageId,
        imageProvider,
        videoProvider,
      },
      "Creative job queued",
    );

    return this.toJobResponse(job.toObject());
  }

  async listJobs(input?: {
    status?: string | undefined;
    limit?: number | undefined;
    offset?: number | undefined;
  }) {
    const limit = Math.min(input?.limit ?? 25, 100);
    const offset = input?.offset ?? 0;
    const filter = input?.status
      ? { status: input.status as CreativeGenerationJobStatus }
      : {};
    const [items, total] = await Promise.all([
      CreativeGenerationJobModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .lean(),
      CreativeGenerationJobModel.countDocuments(filter),
    ]);
    return {
      items: items.map((job) => this.toJobResponse(job)),
      total,
      limit,
      offset,
    };
  }

  async getJob(creativeJobId: string) {
    const job = await CreativeGenerationJobModel.findOne({ creativeJobId }).lean();
    if (!job) {
      throw new NotFoundException({
        code: "CREATIVE_JOB_NOT_RETRYABLE",
        message: "Creative job was not found.",
      });
    }
    return this.toJobResponse(job);
  }

  async retryJob(creativeJobId: string) {
    const job = await CreativeGenerationJobModel.findOne({ creativeJobId });
    if (!job) {
      throw new NotFoundException({
        code: "CREATIVE_JOB_NOT_RETRYABLE",
        message: "Creative job was not found.",
      });
    }
    if (!TERMINAL_NON_REUSABLE_STATUSES.has(job.status)) {
      throw new BadRequestException({
        code: "CREATIVE_JOB_NOT_RETRYABLE",
        message: "Creative job cannot be retried in its current state.",
      });
    }
    job.status = "queued";
    job.currentStage = "queued";
    job.errorCode = null;
    job.safeError = null;
    job.queuedAt = new Date();
    const bullJob = await this.queue.enqueueBuildCreativeJob(
      {
        creativeJobId: job.creativeJobId,
        campaignPackageId: job.campaignPackageId,
      },
      { uniqueJobId: true },
    );
    job.bullJobId = String(bullJob.id);
    await job.save();
    this.logger.info(
      { event: "ai.creative.job.retried", creativeJobId },
      "Creative job retried",
    );
    return this.toJobResponse(job.toObject());
  }

  async cancelJob(creativeJobId: string) {
    const job = await CreativeGenerationJobModel.findOne({ creativeJobId });
    if (!job) {
      throw new NotFoundException({
        code: "CREATIVE_JOB_NOT_RETRYABLE",
        message: "Creative job was not found.",
      });
    }
    if (job.status === "cancelled") {
      return this.toJobResponse(job.toObject());
    }
    if (
      ["completed", "failed", "dead_letter", "provider_unavailable"].includes(
        job.status,
      )
    ) {
      throw new BadRequestException({
        code: "CREATIVE_JOB_CANCELLED",
        message: "Creative job cannot be cancelled in its current state.",
      });
    }
    job.status = "cancelled";
    job.currentStage = "cancelled";
    job.cancelledAt = new Date();
    await job.save();
    this.logger.info(
      { event: "ai.creative.job.cancelled", creativeJobId },
      "Creative job cancelled",
    );
    return this.toJobResponse(job.toObject());
  }

  private assertRequestShape(input: CreateCreativeJobInput): void {
    if (!input.selectedAssetTypes || input.selectedAssetTypes.length === 0) {
      throw new BadRequestException({
        code: "CREATIVE_ASSET_TYPE_INVALID",
        message: "At least one asset type is required.",
      });
    }
    for (const assetType of input.selectedAssetTypes) {
      if (!(CREATIVE_ASSET_TYPES as readonly string[]).includes(assetType)) {
        throw new BadRequestException({
          code: "CREATIVE_ASSET_TYPE_INVALID",
          message: `Unsupported creative asset type: ${assetType}.`,
        });
      }
    }
    for (const platform of input.selectedPlatforms ?? []) {
      if (!(CAMPAIGN_PLATFORMS as readonly string[]).includes(platform)) {
        throw new BadRequestException({
          code: "CREATIVE_PLATFORM_UNSUPPORTED",
          message: `Unsupported creative platform: ${platform}.`,
        });
      }
    }
    for (const language of input.targetLanguages ?? []) {
      if (!getLanguageDefinition(language)) {
        throw new BadRequestException({
          code: "CREATIVE_LANGUAGE_UNSUPPORTED",
          message: `Unsupported creative language: ${language}.`,
        });
      }
    }
    for (const locale of input.targetLocales ?? []) {
      const languagePart = locale.split("-")[0] ?? locale;
      if (!getLanguageDefinition(locale) && !getLanguageDefinition(languagePart)) {
        throw new BadRequestException({
          code: "CREATIVE_LOCALE_INVALID",
          message: `Unsupported creative locale: ${locale}.`,
        });
      }
    }
  }

  private async assertCreateRateLimit(): Promise<void> {
    const redis = this.infrastructure.getRedis();
    const key = "ai:creative:create:global";
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, 60);
    }
    if (count > 30) {
      throw new HttpException(
        {
          code: "RATE_LIMITED",
          message: "Too many creative job creation requests.",
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private toJobResponse(
    job: CreativeGenerationJobDocument | Record<string, unknown>,
    extra?: { reused?: boolean },
  ) {
    const value = job as CreativeGenerationJobDocument;
    return {
      creativeJobId: value.creativeJobId,
      campaignPackageId: value.campaignPackageId,
      campaignPackageRevision: value.campaignPackageRevision,
      status: value.status,
      currentStage: value.currentStage,
      progress: value.progress ?? 0,
      generationFingerprint: value.generationFingerprint,
      assetIds: value.assetIds ?? [],
      reused: extra?.reused ?? false,
      attempts: value.attempts ?? 0,
      maxAttempts: value.maxAttempts ?? 3,
      errorCode: value.errorCode ?? null,
      safeError: value.safeError ?? null,
      requiresReview: value.requiresReview ?? true,
      reviewReasonCodes: value.reviewReasonCodes ?? [],
      imageProviderPreference: value.imageProviderPreference,
      videoProviderPreference: value.videoProviderPreference,
      createdAt:
        (value as unknown as { createdAt?: Date }).createdAt?.toISOString?.() ??
        null,
      updatedAt:
        (value as unknown as { updatedAt?: Date }).updatedAt?.toISOString?.() ??
        null,
    };
  }
}

export { IMAGE_ASSET_TYPES, VIDEO_ASSET_TYPES };
