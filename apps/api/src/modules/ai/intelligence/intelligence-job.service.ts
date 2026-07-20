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
import type { ReviewStatus } from "@miraaj/shared-types";
import { loadEnvironment } from "../../../environment.js";
import { InfrastructureService } from "../../../infrastructure.service.js";
import { AnalysisResultModel } from "../models/analysis-result.schema.js";
import {
  BusinessIntelligenceJobModel,
  type BusinessIntelligenceJobDocument,
} from "../models/business-intelligence-job.schema.js";
import { ServiceRecommendationSetModel } from "../models/service-recommendation-set.schema.js";
import { transitionStatus } from "../analysis/atomic-transition.js";
import { CatalogService } from "../catalog/catalog.service.js";
import { IntelligenceQueueService } from "../queue/intelligence-queue.service.js";

/** Review statuses that are considered complete enough to build intelligence from. */
const READY_REVIEW_STATUSES: ReviewStatus[] = ["approved", "not_required", "corrected"];
/** Review statuses that represent "awaiting human review" — allowed only with override. */
const AWAITING_REVIEW_STATUSES: ReviewStatus[] = ["pending", "in_review"];

export interface SourceEligibilityCheckInput {
  reviewStatus: ReviewStatus | null | undefined;
  allowAwaitingReview: boolean;
}

/**
 * Pure eligibility gate — NestJS never builds intelligence from a rejected
 * source, and only builds from an awaiting-review source with an explicit
 * override flag.
 */
export function assertSourceEligible(input: SourceEligibilityCheckInput): void {
  if (!input.reviewStatus) {
    throw new NotFoundException({
      code: "INTELLIGENCE_SOURCE_NOT_FOUND",
      message: "Source analysis result was not found.",
    });
  }
  if (input.reviewStatus === "rejected") {
    throw new BadRequestException({
      code: "INTELLIGENCE_SOURCE_REJECTED",
      message: "Source analysis result was rejected and cannot be used.",
    });
  }
  if (READY_REVIEW_STATUSES.includes(input.reviewStatus)) {
    return;
  }
  if (AWAITING_REVIEW_STATUSES.includes(input.reviewStatus)) {
    if (input.allowAwaitingReview) {
      return;
    }
    throw new BadRequestException({
      code: "INTELLIGENCE_SOURCE_NOT_READY",
      message:
        "Source analysis result is awaiting review. Set allowAwaitingReview to proceed explicitly.",
    });
  }
  throw new BadRequestException({
    code: "INTELLIGENCE_SOURCE_NOT_READY",
    message: "Source analysis result is not ready for intelligence processing.",
  });
}

export function buildIntelligenceFingerprint(input: {
  analysisResultId: string;
  catalogVersionId: string;
  matchingPolicyId: string;
}): string {
  const canonical = JSON.stringify({
    analysisResultId: input.analysisResultId,
    catalogVersionId: input.catalogVersionId,
    matchingPolicyId: input.matchingPolicyId,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

export interface CreateIntelligenceJobInput {
  analysisResultId: string;
  allowAwaitingReview?: boolean;
  idempotencyKey?: string;
}

@Injectable()
export class IntelligenceJobService {
  private readonly environment = loadEnvironment();
  private readonly logger = createLogger({
    service: "miraaj-api",
    environment: this.environment.APP_ENV,
    level: this.environment.LOG_LEVEL,
  });

  constructor(
    @Inject(InfrastructureService)
    private readonly infrastructure: InfrastructureService,
    @Inject(CatalogService)
    private readonly catalogService: CatalogService,
    @Inject(IntelligenceQueueService)
    private readonly queue: IntelligenceQueueService,
  ) {}

  async createJob(input: CreateIntelligenceJobInput) {
    await this.assertCreateRateLimit();

    const analysisResult = await AnalysisResultModel.findOne({
      resultId: input.analysisResultId,
    }).lean();
    assertSourceEligible({
      reviewStatus: analysisResult?.reviewStatus,
      allowAwaitingReview: input.allowAwaitingReview ?? false,
    });
    if (!analysisResult) {
      throw new NotFoundException({
        code: "INTELLIGENCE_SOURCE_NOT_FOUND",
        message: "Source analysis result was not found.",
      });
    }

    const catalogVersion = await this.catalogService.getActiveVersionOrThrow();
    const policy = await this.catalogService.getActiveMatchingPolicyOrThrow();

    const fingerprint = buildIntelligenceFingerprint({
      analysisResultId: input.analysisResultId,
      catalogVersionId: catalogVersion.versionId,
      matchingPolicyId: policy.policyId,
    });

    const reusableSet = await ServiceRecommendationSetModel.findOne({
      analysisResultId: input.analysisResultId,
      catalogVersionId: catalogVersion.versionId,
      matchingPolicyId: policy.policyId,
      status: { $in: ["generated", "approved", "corrected"] },
    }).lean();
    if (reusableSet) {
      const reusedJob = await BusinessIntelligenceJobModel.findOne({
        jobId: reusableSet.jobId,
      }).lean();
      if (reusedJob) {
        return this.toJobResponse(reusedJob, { reused: true, recommendationSetId: reusableSet.setId });
      }
    }

    const existingJob = await BusinessIntelligenceJobModel.findOne({
      fingerprint,
      status: { $nin: ["failed", "cancelled", "dead_letter"] },
    }).lean();
    if (existingJob) {
      return this.toJobResponse(existingJob, { reused: existingJob.status === "reused" });
    }

    if (input.idempotencyKey) {
      const idempotentJob = await BusinessIntelligenceJobModel.findOne({
        idempotencyKey: input.idempotencyKey,
      }).lean();
      if (idempotentJob) {
        return this.toJobResponse(idempotentJob);
      }
    }

    const jobId = randomUUID();
    const job = await BusinessIntelligenceJobModel.create({
      jobId,
      analysisResultId: input.analysisResultId,
      status: "queued",
      stage: "queued",
      fingerprint,
      catalogVersionId: catalogVersion.versionId,
      matchingPolicyId: policy.policyId,
      allowAwaitingReviewSource: input.allowAwaitingReview ?? false,
      ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
      maxRetries: this.environment.AI_INTELLIGENCE_MAX_RETRIES,
      progress: {
        stage: "queued",
        percent: 0,
        message: "Queued for business intelligence processing",
        updatedAt: new Date().toISOString(),
      },
    });

    const bullJob = await this.queue.enqueueBuildProfile({
      jobId,
      analysisResultId: input.analysisResultId,
    });
    job.bullJobId = String(bullJob.id);
    job.queueName = this.environment.AI_INTELLIGENCE_QUEUE_NAME;
    await job.save();

    this.logger.info(
      {
        event: "ai.intelligence.job.queued",
        jobId,
        analysisResultId: input.analysisResultId,
      },
      "Business intelligence job queued",
    );

    return this.toJobResponse(job.toObject());
  }

  async listJobs(input?: { analysisResultId?: string; limit?: number }) {
    const limit = Math.min(input?.limit ?? 20, 100);
    const filter = input?.analysisResultId
      ? { analysisResultId: input.analysisResultId }
      : {};
    const jobs = await BusinessIntelligenceJobModel.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return { items: jobs.map((job) => this.toJobResponse(job)), limit };
  }

  async getJob(jobId: string) {
    const job = await BusinessIntelligenceJobModel.findOne({ jobId }).lean();
    if (!job) {
      throw new NotFoundException({
        code: "INTELLIGENCE_JOB_NOT_RETRYABLE",
        message: "Business intelligence job was not found.",
      });
    }
    return this.toJobResponse(job);
  }

  async retryJob(jobId: string) {
    const job = await BusinessIntelligenceJobModel.findOne({ jobId });
    if (!job) {
      throw new NotFoundException({
        code: "INTELLIGENCE_JOB_NOT_RETRYABLE",
        message: "Business intelligence job was not found.",
      });
    }
    if (!["failed", "dead_letter", "cancelled"].includes(job.status)) {
      throw new BadRequestException({
        code: "INTELLIGENCE_JOB_NOT_RETRYABLE",
        message: "Business intelligence job cannot be retried in its current state.",
      });
    }
    job.status = "queued";
    job.stage = "queued";
    job.retryCount += 1;
    job.failureCode = null;
    job.failureMessage = null;
    const bullJob = await this.queue.enqueueBuildProfile({
      jobId: job.jobId,
      analysisResultId: job.analysisResultId,
    });
    job.bullJobId = String(bullJob.id);
    await job.save();
    this.logger.info(
      { event: "ai.intelligence.job.retried", jobId },
      "Business intelligence job retried",
    );
    return this.toJobResponse(job.toObject());
  }

  async cancelJob(jobId: string) {
    const fromQueued = await transitionStatus(
      BusinessIntelligenceJobModel,
      { jobId },
      "queued",
      { status: "cancelled", cancelledAt: new Date() },
    );
    const cancelled =
      fromQueued ??
      (await transitionStatus(
        BusinessIntelligenceJobModel,
        { jobId },
        "active",
        { status: "cancelled", cancelledAt: new Date() },
      ));
    if (!cancelled) {
      const existing = await BusinessIntelligenceJobModel.findOne({ jobId }).lean();
      if (!existing) {
        throw new NotFoundException({
          code: "INTELLIGENCE_JOB_NOT_RETRYABLE",
          message: "Business intelligence job was not found.",
        });
      }
      if (existing.status === "cancelled") {
        return this.toJobResponse(existing);
      }
      throw new BadRequestException({
        code: "INTELLIGENCE_JOB_CANCELLED",
        message: "Business intelligence job cannot be cancelled in its current state.",
      });
    }
    this.logger.info(
      { event: "ai.intelligence.job.cancelled", jobId },
      "Business intelligence job cancelled",
    );
    return this.toJobResponse(cancelled);
  }

  private async assertCreateRateLimit(): Promise<void> {
    const redis = this.infrastructure.getRedis();
    const key = "ai:intelligence:create:global";
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, 60);
    }
    if (count > 30) {
      throw new HttpException(
        { code: "RATE_LIMITED", message: "Too many intelligence job creation requests." },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private toJobResponse(
    job: BusinessIntelligenceJobDocument | Record<string, unknown>,
    extra?: { reused?: boolean; recommendationSetId?: string },
  ) {
    const value = job as BusinessIntelligenceJobDocument;
    return {
      jobId: value.jobId,
      analysisResultId: value.analysisResultId,
      status: value.status,
      stage: value.stage,
      fingerprint: value.fingerprint,
      catalogVersionId: value.catalogVersionId,
      matchingPolicyId: value.matchingPolicyId,
      profileId: value.profileId ?? null,
      recommendationSetId: extra?.recommendationSetId ?? value.recommendationSetId ?? null,
      reused: extra?.reused ?? value.status === "reused",
      progress: value.progress ?? null,
      retryCount: value.retryCount ?? 0,
      failureCode: value.failureCode ?? null,
      failureMessage: value.failureMessage ?? null,
      createdAt: (value as unknown as { createdAt?: Date }).createdAt?.toISOString?.() ?? null,
      updatedAt: (value as unknown as { updatedAt?: Date }).updatedAt?.toISOString?.() ?? null,
    };
  }
}
