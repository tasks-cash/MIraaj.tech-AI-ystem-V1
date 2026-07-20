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
  CAMPAIGN_OBJECTIVES,
  CAMPAIGN_PLATFORMS,
  CAMPAIGN_TYPES,
  CONTENT_FORMATS,
  FUNNEL_STAGES,
  getLanguageDefinition,
  isRegulatedBusinessType,
  type BusinessType,
  type CampaignJobStatus,
  type CampaignObjective,
  type CampaignPlatform,
  type CampaignType,
  type ContentFormat,
  type FunnelStage,
} from "@miraaj/shared-types";
import { loadEnvironment } from "../../../environment.js";
import { InfrastructureService } from "../../../infrastructure.service.js";
import { CampaignJobModel, type CampaignJobDocument } from "../models/campaign.schema.js";
import { CampaignSourceEligibilityService } from "./campaign-source-eligibility.service.js";
import { CampaignSeedService } from "./campaign-seed.service.js";
import { CampaignQueueService } from "../queue/campaign-queue.service.js";

const TERMINAL_NON_REUSABLE_STATUSES = new Set<CampaignJobStatus>([
  "failed",
  "cancelled",
  "dead_letter",
]);

export interface CreateCampaignJobInput {
  recommendationSetId: string;
  recommendationSetRevision?: number;
  selectedServiceIds: string[];
  campaignType: CampaignType;
  objective: CampaignObjective;
  funnelStage: FunnelStage;
  selectedPlatforms: CampaignPlatform[];
  selectedFormats?: ContentFormat[];
  targetCountries?: string[];
  targetLanguages: string[];
  targetLocales: string[];
  baseLanguage?: string;
  sourceLocale?: string;
  destinationType?: string;
  destinationReference?: string;
  offerDetails?: string;
  campaignName?: string;
  providerPreference?: string;
  translationProviderPreference?: string;
  allowCampaignOverride?: boolean;
  manualReviewRequested?: boolean;
  forceRegeneration?: boolean;
  idempotencyKey?: string;
  correlationId?: string;
  requestId?: string;
  requestedBy: string;
}

/**
 * Creates and manages campaign jobs. NestJS owns source eligibility, policy
 * limits, and queueing — the AI provider is only invoked later by the
 * worker, strictly within the brief this pipeline produces.
 */
@Injectable()
export class CampaignJobService {
  private readonly environment = loadEnvironment();
  private readonly logger = createLogger({
    service: "miraaj-api",
    environment: this.environment.APP_ENV,
    level: this.environment.LOG_LEVEL,
  });

  constructor(
    @Inject(InfrastructureService)
    private readonly infrastructure: InfrastructureService,
    @Inject(CampaignSourceEligibilityService)
    private readonly eligibility: CampaignSourceEligibilityService,
    @Inject(CampaignSeedService)
    private readonly campaignSeed: CampaignSeedService,
    @Inject(CampaignQueueService)
    private readonly queue: CampaignQueueService,
  ) {}

  async createJob(input: CreateCampaignJobInput): Promise<Record<string, unknown>> {
    await this.assertCreateRateLimit();
    this.assertRequestShape(input);

    const source = await this.eligibility.loadAndValidate({
      recommendationSetId: input.recommendationSetId,
      selectedServiceIds: input.selectedServiceIds,
      ...(input.recommendationSetRevision !== undefined
        ? { recommendationSetRevision: input.recommendationSetRevision }
        : {}),
      ...(input.allowCampaignOverride !== undefined
        ? { allowCampaignOverride: input.allowCampaignOverride }
        : {}),
    });

    const [campaignPolicy, brandProfile, platformPolicy, compliancePolicy] =
      await Promise.all([
        this.campaignSeed.getActiveCampaignPolicyOrThrow(),
        this.campaignSeed.getActiveBrandProfileOrThrow(),
        this.campaignSeed.getActivePlatformPolicyOrThrow(),
        this.campaignSeed.getActiveCompliancePolicyOrThrow(),
      ]);

    if (input.selectedServiceIds.length > campaignPolicy.maxServices) {
      throw new BadRequestException({
        code: "CAMPAIGN_TOO_MANY_SERVICES",
        message: `A campaign may reference at most ${campaignPolicy.maxServices} services.`,
      });
    }
    if (input.selectedPlatforms.length > campaignPolicy.maxPlatforms) {
      throw new BadRequestException({
        code: "CAMPAIGN_TOO_MANY_PLATFORMS",
        message: `A campaign may target at most ${campaignPolicy.maxPlatforms} platforms.`,
      });
    }
    if (input.targetLanguages.length > campaignPolicy.maxLanguages) {
      throw new BadRequestException({
        code: "CAMPAIGN_TOO_MANY_LANGUAGES",
        message: `A campaign may target at most ${campaignPolicy.maxLanguages} languages.`,
      });
    }

    const involvesPayment = source.selectedServices.some(
      (item) => item.isPaymentService,
    );
    const isRegulatedDomain =
      isRegulatedBusinessType(source.businessProfile.businessType.code as BusinessType) ||
      involvesPayment;

    const generationFingerprint = createHash("sha256")
      .update(
        JSON.stringify({
          recommendationSetId: input.recommendationSetId,
          objective: input.objective,
          campaignType: input.campaignType,
          selectedPlatforms: [...input.selectedPlatforms].sort(),
          targetLanguages: [...input.targetLanguages].sort(),
          selectedServiceIds: [...input.selectedServiceIds].sort(),
          brandProfileVersion: brandProfile.version,
          platformPolicyVersion: platformPolicy.version,
          compliancePolicyVersion: compliancePolicy.version,
        }),
      )
      .digest("hex");

    const existingJob = await CampaignJobModel.findOne({
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
      const idempotentJob = await CampaignJobModel.findOne({
        idempotencyKeyHash,
      }).lean();
      if (idempotentJob) {
        return this.toJobResponse(idempotentJob, { reused: true });
      }
    }

    const campaignJobId = randomUUID();
    const campaignId = randomUUID();
    const correlationId = input.correlationId ?? randomUUID();
    const job = await CampaignJobModel.create({
      campaignJobId,
      campaignId,
      recommendationSetId: input.recommendationSetId,
      recommendationSetRevision: source.recommendationSet.revision ?? 1,
      status: "queued",
      queueName: this.environment.AI_CAMPAIGN_QUEUE_NAME,
      requestedBy: input.requestedBy,
      ...(idempotencyKeyHash ? { idempotencyKeyHash } : {}),
      generationFingerprint,
      correlationId,
      requestId: input.requestId ?? randomUUID(),
      providerPreference: input.providerPreference ?? this.environment.AI_CAMPAIGN_PROVIDER,
      translationProviderPreference:
        input.translationProviderPreference ?? this.environment.AI_TRANSLATION_PROVIDER,
      brandProfileVersion: brandProfile.version,
      platformPolicyVersion: platformPolicy.version,
      compliancePolicyVersion: compliancePolicy.version,
      selectedServiceIds: input.selectedServiceIds,
      campaignType: input.campaignType,
      objective: input.objective,
      funnelStage: input.funnelStage,
      selectedPlatforms: input.selectedPlatforms,
      selectedFormats: input.selectedFormats ?? [],
      targetCountries: input.targetCountries ?? [],
      targetLanguages: input.targetLanguages,
      targetLocales: input.targetLocales,
      baseLanguage: input.baseLanguage ?? input.targetLanguages[0] ?? "en",
      sourceLocale: input.sourceLocale ?? input.targetLocales[0] ?? "en",
      ...(input.destinationType ? { destinationType: input.destinationType } : {}),
      ...(input.destinationReference
        ? { destinationReference: input.destinationReference }
        : {}),
      ...(input.offerDetails ? { offerDetails: input.offerDetails } : {}),
      ...(input.campaignName ? { campaignName: input.campaignName } : {}),
      forceRegeneration: Boolean(input.forceRegeneration),
      manualReviewRequested: Boolean(input.manualReviewRequested),
      allowCampaignOverride: Boolean(input.allowCampaignOverride),
      maxAttempts: this.environment.AI_CAMPAIGN_MAX_RETRIES + 1,
      requiresReview: true,
      reviewReasonCodes: [
        ...new Set([
          ...source.reviewReasonCodes,
          ...(involvesPayment ? (["payment_service"] as const) : []),
          ...(isRegulatedDomain ? (["regulated_domain"] as const) : []),
          ...(input.manualReviewRequested
            ? (["manual_review_requested"] as const)
            : []),
        ]),
      ],
      queuedAt: new Date(),
    });

    const bullJob = await this.queue.enqueueBuildCampaign({
      campaignJobId,
      recommendationSetId: input.recommendationSetId,
    });
    job.bullJobId = String(bullJob.id);
    await job.save();

    this.logger.info(
      {
        event: "ai.campaigns.job.queued",
        campaignJobId,
        recommendationSetId: input.recommendationSetId,
        involvesPayment,
        isRegulatedDomain,
      },
      "Campaign job queued",
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
      ? { status: input.status as CampaignJobStatus }
      : {};
    const [items, total] = await Promise.all([
      CampaignJobModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .lean(),
      CampaignJobModel.countDocuments(filter),
    ]);
    return { items: items.map((job) => this.toJobResponse(job)), total, limit, offset };
  }

  async getJob(campaignJobId: string) {
    const job = await CampaignJobModel.findOne({ campaignJobId }).lean();
    if (!job) {
      throw new NotFoundException({
        code: "CAMPAIGN_JOB_NOT_RETRYABLE",
        message: "Campaign job was not found.",
      });
    }
    return this.toJobResponse(job);
  }

  async retryJob(campaignJobId: string) {
    const job = await CampaignJobModel.findOne({ campaignJobId });
    if (!job) {
      throw new NotFoundException({
        code: "CAMPAIGN_JOB_NOT_RETRYABLE",
        message: "Campaign job was not found.",
      });
    }
    if (!TERMINAL_NON_REUSABLE_STATUSES.has(job.status)) {
      throw new BadRequestException({
        code: "CAMPAIGN_JOB_NOT_RETRYABLE",
        message: "Campaign job cannot be retried in its current state.",
      });
    }
    job.status = "queued";
    job.currentStage = "queued";
    job.errorCode = null;
    job.safeError = null;
    job.queuedAt = new Date();
    const bullJob = await this.queue.enqueueBuildCampaign({
      campaignJobId: job.campaignJobId,
      recommendationSetId: job.recommendationSetId,
    }, { uniqueJobId: true });
    job.bullJobId = String(bullJob.id);
    await job.save();
    this.logger.info(
      { event: "ai.campaigns.job.retried", campaignJobId },
      "Campaign job retried",
    );
    return this.toJobResponse(job.toObject());
  }

  async cancelJob(campaignJobId: string) {
    const job = await CampaignJobModel.findOne({ campaignJobId });
    if (!job) {
      throw new NotFoundException({
        code: "CAMPAIGN_JOB_NOT_RETRYABLE",
        message: "Campaign job was not found.",
      });
    }
    if (job.status === "cancelled") {
      return this.toJobResponse(job.toObject());
    }
    if (["completed", "failed", "dead_letter"].includes(job.status)) {
      throw new BadRequestException({
        code: "CAMPAIGN_JOB_CANCELLED",
        message: "Campaign job cannot be cancelled in its current state.",
      });
    }
    job.status = "cancelled";
    job.currentStage = "cancelled";
    job.cancelledAt = new Date();
    await job.save();
    this.logger.info(
      { event: "ai.campaigns.job.cancelled", campaignJobId },
      "Campaign job cancelled",
    );
    return this.toJobResponse(job.toObject());
  }

  private assertRequestShape(input: CreateCampaignJobInput): void {
    if (!(CAMPAIGN_OBJECTIVES as readonly string[]).includes(input.objective)) {
      throw new BadRequestException({
        code: "CAMPAIGN_OBJECTIVE_INVALID",
        message: "Unsupported campaign objective.",
      });
    }
    if (!(FUNNEL_STAGES as readonly string[]).includes(input.funnelStage)) {
      throw new BadRequestException({
        code: "CAMPAIGN_FUNNEL_STAGE_INVALID",
        message: "Unsupported funnel stage.",
      });
    }
    if (!(CAMPAIGN_TYPES as readonly string[]).includes(input.campaignType)) {
      throw new BadRequestException({
        code: "CAMPAIGN_TYPE_INVALID",
        message: "Unsupported campaign type.",
      });
    }
    for (const platform of input.selectedPlatforms) {
      if (!(CAMPAIGN_PLATFORMS as readonly string[]).includes(platform)) {
        throw new BadRequestException({
          code: "CAMPAIGN_PLATFORM_UNSUPPORTED",
          message: `Unsupported campaign platform: ${platform}.`,
        });
      }
    }
    for (const format of input.selectedFormats ?? []) {
      if (!(CONTENT_FORMATS as readonly string[]).includes(format)) {
        throw new BadRequestException({
          code: "CAMPAIGN_FORMAT_UNSUPPORTED",
          message: `Unsupported content format: ${format}.`,
        });
      }
    }
    if (input.selectedPlatforms.length === 0) {
      throw new BadRequestException({
        code: "CAMPAIGN_PLATFORM_UNSUPPORTED",
        message: "At least one target platform is required.",
      });
    }
    if (input.targetLanguages.length === 0) {
      throw new BadRequestException({
        code: "CAMPAIGN_LANGUAGE_UNSUPPORTED",
        message: "At least one target language is required.",
      });
    }
    for (const language of input.targetLanguages) {
      if (!getLanguageDefinition(language)) {
        throw new BadRequestException({
          code: "CAMPAIGN_LANGUAGE_UNSUPPORTED",
          message: `Unsupported campaign language: ${language}.`,
        });
      }
    }
    for (const locale of input.targetLocales ?? []) {
      const languagePart = locale.split("-")[0] ?? locale;
      if (!getLanguageDefinition(locale) && !getLanguageDefinition(languagePart)) {
        throw new BadRequestException({
          code: "CAMPAIGN_LOCALE_INVALID",
          message: `Unsupported campaign locale: ${locale}.`,
        });
      }
    }
    for (const country of input.targetCountries ?? []) {
      if (!/^[A-Za-z]{2}$/.test(country)) {
        throw new BadRequestException({
          code: "CAMPAIGN_COUNTRY_INVALID",
          message: `Invalid country code: ${country}.`,
        });
      }
    }
    if (input.selectedServiceIds.length === 0) {
      throw new BadRequestException({
        code: "CAMPAIGN_SERVICE_NOT_RECOMMENDED",
        message: "At least one selected service is required.",
      });
    }
  }

  private async assertCreateRateLimit(): Promise<void> {
    const redis = this.infrastructure.getRedis();
    const key = "ai:campaigns:create:global";
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, 60);
    }
    if (count > 30) {
      throw new HttpException(
        { code: "RATE_LIMITED", message: "Too many campaign job creation requests." },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private toJobResponse(
    job: CampaignJobDocument | Record<string, unknown>,
    extra?: { reused?: boolean },
  ) {
    const value = job as CampaignJobDocument;
    return {
      campaignJobId: value.campaignJobId,
      campaignId: value.campaignId,
      recommendationSetId: value.recommendationSetId,
      status: value.status,
      currentStage: value.currentStage,
      progress: value.progress ?? 0,
      generationFingerprint: value.generationFingerprint,
      campaignBriefId: value.campaignBriefId ?? null,
      campaignPackageId: value.campaignPackageId ?? null,
      reused: extra?.reused ?? false,
      attempts: value.attempts ?? 0,
      maxAttempts: value.maxAttempts ?? 3,
      errorCode: value.errorCode ?? null,
      safeError: value.safeError ?? null,
      requiresReview: value.requiresReview ?? true,
      reviewReasonCodes: value.reviewReasonCodes ?? [],
      createdAt:
        (value as unknown as { createdAt?: Date }).createdAt?.toISOString?.() ?? null,
      updatedAt:
        (value as unknown as { updatedAt?: Date }).updatedAt?.toISOString?.() ?? null,
    };
  }
}
