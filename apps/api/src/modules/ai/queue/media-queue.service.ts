import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Queue } from "bullmq";
import { AI_MEDIA_JOB_NAMES, type AIProcessingErrorCode } from "@miraaj/shared-types";
import { loadEnvironment } from "../../../environment.js";

export interface ValidateMediaJobPayload {
  sessionId: string;
  mediaId: string;
  objectKey: string;
}

export interface AnalyzeMediaJobPayload {
  jobId: string;
  mediaId: string;
}

@Injectable()
export class MediaQueueService implements OnModuleDestroy {
  private readonly environment = loadEnvironment();
  private readonly connection = {
    url: this.environment.REDIS_URL,
  };
  readonly validateQueue: Queue<ValidateMediaJobPayload>;
  readonly analyzeQueue: Queue<AnalyzeMediaJobPayload>;
  readonly deadLetterQueue: Queue<Record<string, unknown>>;

  constructor() {
    this.validateQueue = new Queue(this.environment.BULLMQ_VALIDATE_QUEUE, {
      connection: this.connection,
      defaultJobOptions: {
        attempts: this.environment.MEDIA_MAX_RETRIES + 1,
        backoff: { type: "exponential", delay: 2_000 },
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    });
    this.analyzeQueue = new Queue(this.environment.BULLMQ_ANALYZE_QUEUE, {
      connection: this.connection,
      defaultJobOptions: {
        attempts: this.environment.MEDIA_MAX_RETRIES + 1,
        backoff: { type: "exponential", delay: 2_000 },
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    });
    this.deadLetterQueue = new Queue(this.environment.BULLMQ_DEAD_LETTER_QUEUE, {
      connection: this.connection,
    });
  }

  async enqueueValidateMedia(payload: ValidateMediaJobPayload) {
    return this.validateQueue.add(AI_MEDIA_JOB_NAMES.VALIDATE_MEDIA, payload, {
      jobId: `validate:${payload.mediaId}`,
    });
  }

  async enqueueAnalyzeMedia(payload: AnalyzeMediaJobPayload) {
    return this.analyzeQueue.add(AI_MEDIA_JOB_NAMES.ANALYZE_MEDIA, payload, {
      jobId: `analyze:${payload.jobId}`,
    });
  }

  async moveToDeadLetter(input: {
    sourceQueue: string;
    jobName: string;
    payload: Record<string, unknown>;
    errorCode?: AIProcessingErrorCode;
    message?: string;
  }) {
    return this.deadLetterQueue.add("dead-letter", {
      ...input.payload,
      sourceQueue: input.sourceQueue,
      jobName: input.jobName,
      errorCode: input.errorCode ?? "MEDIA_NORMALIZATION_FAILED",
      message: input.message ?? "Job moved to dead letter queue.",
      movedAt: new Date().toISOString(),
    });
  }

  async getQueueStats() {
    const [validateCounts, analyzeCounts, deadLetterCounts] = await Promise.all([
      this.validateQueue.getJobCounts(
        "waiting",
        "active",
        "completed",
        "failed",
        "delayed",
      ),
      this.analyzeQueue.getJobCounts(
        "waiting",
        "active",
        "completed",
        "failed",
        "delayed",
      ),
      this.deadLetterQueue.getJobCounts("waiting", "active", "completed", "failed"),
    ]);
    return {
      validate: validateCounts,
      analyze: analyzeCounts,
      deadLetter: deadLetterCounts,
    };
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled([
      this.validateQueue.close(),
      this.analyzeQueue.close(),
      this.deadLetterQueue.close(),
    ]);
  }
}
