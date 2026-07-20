import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Worker, type Job } from "bullmq";
import { randomUUID } from "node:crypto";
import { createLogger } from "@miraaj/shared-logging";
import { AI_MEDIA_JOB_NAMES } from "@miraaj/shared-types";
import { loadEnvironment } from "../../../environment.js";
import { AiInternalClientService } from "../ai-internal-client.service.js";
import type { AnalyzeResponse } from "../types/ai-media-responses.js";
import { MediaStorageService } from "../media/media-storage.service.js";
import { AnalysisAttemptModel } from "../models/analysis-attempt.schema.js";
import { AnalysisJobModel } from "../models/analysis-job.schema.js";
import { AnalysisResultModel } from "../models/analysis-result.schema.js";
import { MediaAssetModel } from "../models/media-asset.schema.js";
import { UploadSessionModel } from "../models/upload-session.schema.js";
import { evaluateConfidence } from "../analysis/confidence.engine.js";
import {
  computeConfidenceBreakdown,
  mergeAnalysisOutputs,
} from "../analysis/merge.engine.js";
import { transitionJobStatus } from "../analysis/atomic-transition.js";
import {
  MediaQueueService,
  type AnalyzeMediaJobPayload,
  type ValidateMediaJobPayload,
} from "./media-queue.service.js";

@Injectable()
export class MediaWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly environment = loadEnvironment();
  private readonly logger = createLogger({
    service: "miraaj-api",
    environment: this.environment.APP_ENV,
    level: this.environment.LOG_LEVEL,
  });
  private validateWorker?: Worker<ValidateMediaJobPayload>;
  private analyzeWorker?: Worker<AnalyzeMediaJobPayload>;

  constructor(
    @Inject(MediaQueueService)
    private readonly queueService: MediaQueueService,
    @Inject(MediaStorageService)
    private readonly storage: MediaStorageService,
    @Inject(AiInternalClientService)
    private readonly aiClient: AiInternalClientService,
  ) {}

  onModuleInit(): void {
    const connection = { url: this.environment.REDIS_URL };
    this.validateWorker = new Worker(
      this.environment.BULLMQ_VALIDATE_QUEUE,
      async (job) => this.processValidate(job),
      {
        connection,
        concurrency: this.environment.MEDIA_WORKER_CONCURRENCY,
      },
    );
    this.analyzeWorker = new Worker(
      this.environment.BULLMQ_ANALYZE_QUEUE,
      async (job) => this.processAnalyze(job),
      {
        connection,
        concurrency: this.environment.MEDIA_WORKER_CONCURRENCY,
      },
    );
    this.validateWorker.on("failed", (job, error) => {
      this.logger.error(
        {
          event: "ai.media.validate.failed",
          jobId: job?.id,
          safeError: error.message,
        },
        "Validate worker job failed",
      );
    });
    this.analyzeWorker.on("failed", (job, error) => {
      this.logger.error(
        {
          event: "ai.analysis.analyze.failed",
          jobId: job?.id,
          safeError: error.message,
        },
        "Analyze worker job failed",
      );
    });
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled([
      this.validateWorker?.close(),
      this.analyzeWorker?.close(),
    ]);
  }

  private async processValidate(job: Job<ValidateMediaJobPayload>): Promise<void> {
    const signedMediaUrl = await this.storage.createPresignedReadUrl(
      job.data.objectKey,
    );
    const inspect = await this.aiClient.postInspect({
      signedMediaUrl,
      hints: {},
    });

    if (!inspect.accepted || !inspect.metadata) {
      await MediaAssetModel.updateOne(
        { mediaId: job.data.mediaId },
        {
          status: "rejected",
          failureCode: inspect.errorCode ?? "MEDIA_DECODE_FAILED",
          failureMessage: inspect.safeMessage ?? "Media validation failed.",
        },
      );
      await UploadSessionModel.updateOne(
        { sessionId: job.data.sessionId },
        {
          status: "rejected",
          failureCode: inspect.errorCode,
          failureMessage: inspect.safeMessage,
        },
      );
      return;
    }

    const normalizedVersion = 1;
    const normalizedFormat = this.environment.MEDIA_NORMALIZED_IMAGE_FORMAT;
    let normalizedObjectKey: string | undefined;
    if (
      inspect.sanitization?.normalizedBytes &&
      inspect.metadata.kind === "image"
    ) {
      normalizedObjectKey = this.storage.buildNormalizedObjectKey(
        job.data.mediaId,
        normalizedVersion,
        normalizedFormat,
      );
    }

    await MediaAssetModel.updateOne(
      { mediaId: job.data.mediaId },
      {
        status: "ready",
        verifiedMime: inspect.metadata.verifiedMime,
        kind: inspect.metadata.kind,
        originalBytes: inspect.metadata.originalBytes,
        width: inspect.metadata.width,
        height: inspect.metadata.height,
        pageCount: inspect.metadata.pageCount,
        sha256: inspect.metadata.sha256,
        normalizedObjectKey,
        normalizedVersion,
        normalizedFormat,
        duplicateStatus: inspect.duplicate?.duplicateStatus ?? "none",
        readyAt: new Date(),
      },
    );

    await UploadSessionModel.updateOne(
      { sessionId: job.data.sessionId },
      {
        status: "completed",
        completedAt: new Date(),
      },
    );

    this.logger.info(
      {
        event: "ai.media.validate.completed",
        mediaId: job.data.mediaId,
        sessionId: job.data.sessionId,
      },
      "Media validation completed",
    );
  }

  private async processAnalyze(job: Job<AnalyzeMediaJobPayload>): Promise<void> {
    const jobRecord = await AnalysisJobModel.findOne({ jobId: job.data.jobId });
    if (!jobRecord) {
      return;
    }
    if (jobRecord.status === "cancelled") {
      return;
    }

    const activated = await transitionJobStatus(
      AnalysisJobModel,
      job.data.jobId,
      "queued",
      {
        status: "active",
        stage: "ocr",
        lastHeartbeatAt: new Date(),
      },
    );
    if (!activated) {
      return;
    }

    const media = await MediaAssetModel.findOne({ mediaId: job.data.mediaId }).lean();
    if (!media?.originalObjectKey || !media.sha256) {
      await this.failJob(job.data.jobId, "ANALYSIS_MEDIA_NOT_READY", "Media is not ready.");
      return;
    }

    const signedMediaUrl = await this.storage.createPresignedReadUrl(
      media.originalObjectKey,
    );
    const attemptId = randomUUID();
    let analyzeResponse: AnalyzeResponse;
    try {
      analyzeResponse = await this.aiClient.postAnalyze({
        signedMediaUrl,
        hints: (jobRecord.hints as Record<string, unknown>) ?? {},
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Analysis failed.";
      await this.failJob(job.data.jobId, "VISION_PROVIDER_UNAVAILABLE", message);
      return;
    }

    if (!analyzeResponse.accepted) {
      await this.failJob(
        job.data.jobId,
        analyzeResponse.errorCode ?? "VISION_PROVIDER_UNAVAILABLE",
        analyzeResponse.safeMessage ?? "Analysis was rejected.",
      );
      return;
    }

    const ocr = analyzeResponse.ocr ?? null;
    const vision = analyzeResponse.vision ?? null;
    const confidence =
      analyzeResponse.confidence ??
      computeConfidenceBreakdown({
        mediaValidationConfidence: analyzeResponse.inspect?.metadata ? 0.95 : 0.5,
        ocr,
        vision,
      });
    const mergedOutput = mergeAnalysisOutputs({ ocr, vision });
    const decision = evaluateConfidence({
      confidence,
      autoCompleteMin: this.environment.CONFIDENCE_AUTO_COMPLETE_MIN,
      reviewMin: this.environment.CONFIDENCE_REVIEW_MIN,
      lowBelow: this.environment.CONFIDENCE_LOW_BELOW,
      ...(ocr?.requiresReview ? { ocrRequiresReview: true } : {}),
      ...(vision?.requiresReview ? { visionRequiresReview: true } : {}),
    });

    const ocrObjectKey = ocr
      ? this.storage.buildOcrObjectKey(job.data.mediaId, attemptId)
      : undefined;
    if (ocr && ocrObjectKey) {
      await this.storage.putJsonObject(ocrObjectKey, ocr);
    }

    await AnalysisAttemptModel.create({
      attemptId,
      jobId: job.data.jobId,
      mediaId: job.data.mediaId,
      attemptNumber: jobRecord.retryCount + 1,
      stage: "complete",
      provider: jobRecord.provider,
      promptVersionId: jobRecord.promptVersionId,
      ...(ocrObjectKey ? { ocrObjectKey } : {}),
      inspectPayload: analyzeResponse.inspect,
      ocrPayload: ocr,
      visionPayload: vision,
      mergePayload: mergedOutput,
      confidencePayload: confidence,
      processingMs: analyzeResponse.processingMs,
      immutable: true,
    });

    const resultId = randomUUID();
    const reviewStatus = decision.autoComplete ? "not_required" : "pending";
    const finalStatus = decision.requiresReview ? "awaiting_review" : "completed";

    await AnalysisResultModel.create({
      resultId,
      jobId: job.data.jobId,
      mediaId: job.data.mediaId,
      attemptId,
      purpose: jobRecord.purpose,
      fingerprint: jobRecord.fingerprint,
      reviewStatus,
      overallConfidence: confidence.overallConfidence,
      confidence,
      mergedOutput,
      ocrSummary: ocr
        ? {
            averageConfidence: ocr.averageConfidence,
            primaryLanguage: ocr.languageDetection.primaryLanguage ?? null,
          }
        : null,
      visionSummary: vision
        ? {
            mediaSummary: vision.mediaSummary,
            requiresReview: vision.requiresReview,
          }
        : null,
      reviewReasonCodes: decision.reviewReasonCodes,
      requiresReview: decision.requiresReview,
      immutable: true,
    });

    await AnalysisJobModel.updateOne(
      { jobId: job.data.jobId },
      {
        status: finalStatus,
        stage: "complete",
        activeAttemptId: attemptId,
        resultId,
        completedAt: finalStatus === "completed" ? new Date() : undefined,
        progress: {
          stage: "complete",
          percent: 100,
          message: decision.requiresReview
            ? "Awaiting human review"
            : "Analysis completed",
          updatedAt: new Date().toISOString(),
        },
      },
    );

    this.logger.info(
      {
        event: "ai.analysis.job.completed",
        jobId: job.data.jobId,
        resultId,
        requiresReview: decision.requiresReview,
      },
      "Analysis job completed",
    );
  }

  private async failJob(
    jobId: string,
    failureCode: string,
    failureMessage: string,
  ): Promise<void> {
    const job = await AnalysisJobModel.findOne({ jobId });
    if (!job) {
      return;
    }
    if (job.retryCount >= job.maxRetries) {
      job.status = "dead_letter";
      await this.queueService.moveToDeadLetter({
        sourceQueue: this.environment.BULLMQ_ANALYZE_QUEUE,
        jobName: AI_MEDIA_JOB_NAMES.ANALYZE_MEDIA,
        payload: { jobId, mediaId: job.mediaId },
        errorCode: failureCode as never,
        message: failureMessage,
      });
    } else {
      job.status = "failed";
    }
    job.failureCode = failureCode;
    job.failureMessage = failureMessage;
    await job.save();
  }
}
