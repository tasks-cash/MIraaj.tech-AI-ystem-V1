import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { createLogger } from "@miraaj/shared-logging";
import type { AnalysisPurpose } from "@miraaj/shared-types";
import { ANALYSIS_PURPOSES } from "@miraaj/shared-types";
import { loadEnvironment } from "../../../environment.js";
import { InfrastructureService } from "../../../infrastructure.service.js";
import {
  AnalysisJobModel,
  type AnalysisJobDocument,
} from "../models/analysis-job.schema.js";
import { AnalysisResultModel } from "../models/analysis-result.schema.js";
import { MediaAssetModel } from "../models/media-asset.schema.js";
import { transitionJobStatus } from "./atomic-transition.js";
import { buildAnalysisFingerprint } from "./merge.engine.js";
import { MediaQueueService } from "../queue/media-queue.service.js";
import {
  DEFAULT_PROMPT_PURPOSE,
  PromptSeedService,
} from "./prompt-seed.service.js";
import { ReviewService } from "./review.service.js";

export interface CreateAnalysisJobInput {
  mediaId: string;
  purpose?: AnalysisPurpose;
  provider?: string;
  hints?: Record<string, unknown>;
  idempotencyKey?: string;
}

@Injectable()
export class AnalysisJobService {
  private readonly environment = loadEnvironment();
  private readonly logger = createLogger({
    service: "miraaj-api",
    environment: this.environment.APP_ENV,
    level: this.environment.LOG_LEVEL,
  });

  constructor(
    @Inject(InfrastructureService)
    private readonly infrastructure: InfrastructureService,
    @Inject(MediaQueueService)
    private readonly queue: MediaQueueService,
    @Inject(PromptSeedService)
    private readonly promptSeed: PromptSeedService,
    @Inject(ReviewService)
    private readonly reviewService: ReviewService,
  ) {}

  async createJob(input: CreateAnalysisJobInput) {
    await this.assertCreateRateLimit();
    const purpose = input.purpose ?? "business_context";
    if (!ANALYSIS_PURPOSES.includes(purpose)) {
      throw new BadRequestException({
        code: "ANALYSIS_PURPOSE_UNSUPPORTED",
        message: "Analysis purpose is not supported.",
      });
    }

    const media = await MediaAssetModel.findOne({ mediaId: input.mediaId }).lean();
    if (!media || media.status !== "ready") {
      throw new BadRequestException({
        code: "ANALYSIS_MEDIA_NOT_READY",
        message: "Media must be ready before analysis can be queued.",
      });
    }
    if (!media.sha256) {
      throw new BadRequestException({
        code: "ANALYSIS_MEDIA_NOT_READY",
        message: "Media fingerprint is unavailable.",
      });
    }

    const prompt = await this.promptSeed.getActivePrompt(DEFAULT_PROMPT_PURPOSE);
    const provider = input.provider ?? "gemini";
    const hints = input.hints ?? {};
    const fingerprint = buildAnalysisFingerprint({
      mediaSha256: media.sha256,
      purpose,
      promptVersionId: prompt.promptVersionId,
      provider,
      ocrLanguages: this.environment.OCR_LANGUAGES_DEFAULT,
      schemaVersion: prompt.schemaVersion,
      hints,
    });

    const existingResult = await AnalysisResultModel.findOne({
      fingerprint,
      reviewStatus: { $in: ["approved", "not_required"] },
    }).lean();
    if (existingResult) {
      const reusedJob = await AnalysisJobModel.findOne({
        jobId: existingResult.jobId,
      }).lean();
      if (reusedJob) {
        return this.toJobResponse(reusedJob, { reused: true, resultId: existingResult.resultId });
      }
    }

    const existingJob = await AnalysisJobModel.findOne({
      fingerprint,
      status: { $nin: ["failed", "cancelled", "dead_letter"] },
    }).lean();
    if (existingJob) {
      return this.toJobResponse(existingJob, {
        reused: existingJob.status === "reused",
        resultId: existingJob.resultId ?? null,
      });
    }

    if (input.idempotencyKey) {
      const idempotentJob = await AnalysisJobModel.findOne({
        idempotencyKey: input.idempotencyKey,
      }).lean();
      if (idempotentJob) {
        return this.toJobResponse(idempotentJob);
      }
    }

    const jobId = randomUUID();
    const job = await AnalysisJobModel.create({
      jobId,
      mediaId: input.mediaId,
      status: "queued",
      stage: "queued",
      purpose,
      promptVersionId: prompt.promptVersionId,
      promptPurpose: prompt.purpose,
      provider,
      ocrLanguages: this.environment.OCR_LANGUAGES_DEFAULT,
      schemaVersion: prompt.schemaVersion,
      hints,
      fingerprint,
      ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
      maxRetries: this.environment.MEDIA_MAX_RETRIES,
      progress: {
        stage: "queued",
        percent: 0,
        message: "Queued for analysis",
        updatedAt: new Date().toISOString(),
      },
    });

    const bullJob = await this.queue.enqueueAnalyzeMedia({
      jobId,
      mediaId: input.mediaId,
    });
    job.bullJobId = String(bullJob.id);
    job.queueName = this.environment.BULLMQ_ANALYZE_QUEUE;
    await job.save();

    this.logger.info(
      {
        event: "ai.analysis.job.queued",
        jobId,
        mediaId: input.mediaId,
        queueJobId: bullJob.id,
      },
      "Analysis job queued",
    );

    return this.toJobResponse(job.toObject());
  }

  async listJobs(input?: { mediaId?: string; limit?: number }) {
    const limit = Math.min(input?.limit ?? 20, 100);
    const filter = input?.mediaId ? { mediaId: input.mediaId } : {};
    const jobs = await AnalysisJobModel.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return {
      items: jobs.map((job) => this.toJobResponse(job)),
      limit,
    };
  }

  async getJob(jobId: string) {
    const job = await AnalysisJobModel.findOne({ jobId }).lean();
    if (!job) {
      throw new NotFoundException({
        code: "ANALYSIS_JOB_NOT_FOUND",
        message: "Analysis job was not found.",
      });
    }
    return this.toJobResponse(job);
  }

  async getResult(resultId: string) {
    const result = await AnalysisResultModel.findOne({ resultId }).lean();
    if (!result) {
      throw new NotFoundException({
        code: "ANALYSIS_RESULT_NOT_FOUND",
        message: "Analysis result was not found.",
      });
    }
    return this.reviewService.toResultResponse(result);
  }

  async retryJob(jobId: string) {
    const job = await AnalysisJobModel.findOne({ jobId });
    if (!job) {
      throw new NotFoundException({
        code: "ANALYSIS_JOB_NOT_FOUND",
        message: "Analysis job was not found.",
      });
    }
    if (!["failed", "dead_letter", "cancelled"].includes(job.status)) {
      throw new BadRequestException({
        code: "ANALYSIS_JOB_NOT_RETRYABLE",
        message: "Analysis job cannot be retried in its current state.",
      });
    }
    job.status = "queued";
    job.stage = "queued";
    job.retryCount += 1;
    job.failureCode = null;
    job.failureMessage = null;
    const bullJob = await this.queue.enqueueAnalyzeMedia({
      jobId: job.jobId,
      mediaId: job.mediaId,
    });
    job.bullJobId = String(bullJob.id);
    await job.save();
    this.logger.info(
      { event: "ai.analysis.job.retried", jobId },
      "Analysis job retried",
    );
    return this.toJobResponse(job.toObject());
  }

  async cancelJob(jobId: string) {
    const job = await transitionJobStatus(
      AnalysisJobModel,
      jobId,
      "queued",
      {
        status: "cancelled",
        cancelledAt: new Date(),
      },
    );
    const cancelled =
      job ??
      (await transitionJobStatus(AnalysisJobModel, jobId, "active", {
        status: "cancelled",
        cancelledAt: new Date(),
      }));
    if (!cancelled) {
      const existing = await AnalysisJobModel.findOne({ jobId }).lean();
      if (!existing) {
        throw new NotFoundException({
          code: "ANALYSIS_JOB_NOT_FOUND",
          message: "Analysis job was not found.",
        });
      }
      if (existing.status === "cancelled") {
        return this.toJobResponse(existing);
      }
      throw new BadRequestException({
        code: "ANALYSIS_JOB_CANCELLED",
        message: "Analysis job cannot be cancelled in its current state.",
      });
    }
    this.logger.info(
      { event: "ai.analysis.job.cancelled", jobId },
      "Analysis job cancelled",
    );
    return this.toJobResponse(cancelled);
  }

  private async assertCreateRateLimit(): Promise<void> {
    const redis = this.infrastructure.getRedis();
    const key = "ai:analysis:create:global";
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, 60);
    }
    if (count > 30) {
      throw new HttpException(
        {
          code: "RATE_LIMITED",
          message: "Too many analysis job creation requests.",
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private toJobResponse(
    job: AnalysisJobDocument | Record<string, unknown>,
    extra?: { reused?: boolean; resultId?: string | null },
  ) {
    const value = job as AnalysisJobDocument;
    return {
      jobId: value.jobId,
      mediaId: value.mediaId,
      status: value.status,
      stage: value.stage,
      purpose: value.purpose,
      promptVersionId: value.promptVersionId,
      provider: value.provider,
      fingerprint: value.fingerprint,
      resultId: extra?.resultId ?? value.resultId ?? null,
      reused: extra?.reused ?? value.status === "reused",
      progress: value.progress ?? null,
      retryCount: value.retryCount ?? 0,
      failureCode: value.failureCode ?? null,
      failureMessage: value.failureMessage ?? null,
      createdAt: value.createdAt?.toISOString?.() ?? null,
      updatedAt: value.updatedAt?.toISOString?.() ?? null,
    };
  }
}
