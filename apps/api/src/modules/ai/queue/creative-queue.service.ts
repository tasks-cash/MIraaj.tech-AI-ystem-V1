import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Queue } from "bullmq";
import {
  AI_CREATIVE_JOB_NAMES,
  type CreativeErrorCode,
} from "@miraaj/shared-types";
import { loadEnvironment } from "../../../environment.js";

export interface BuildCreativeJobPayload {
  creativeJobId: string;
  campaignPackageId: string;
}

@Injectable()
export class CreativeQueueService implements OnModuleDestroy {
  private readonly environment = loadEnvironment();
  private readonly connection = { url: this.environment.REDIS_URL };
  readonly creativeQueue: Queue<BuildCreativeJobPayload>;
  readonly deadLetterQueue: Queue<Record<string, unknown>>;

  constructor() {
    this.creativeQueue = new Queue(this.environment.AI_CREATIVE_QUEUE_NAME, {
      connection: this.connection,
      defaultJobOptions: {
        attempts: this.environment.AI_CREATIVE_MAX_RETRIES + 1,
        backoff: { type: "exponential", delay: 2_000 },
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    });
    this.deadLetterQueue = new Queue(this.environment.AI_CREATIVE_DLQ_NAME, {
      connection: this.connection,
    });
  }

  async enqueueBuildCreativeJob(
    payload: BuildCreativeJobPayload,
    options?: { uniqueJobId?: boolean },
  ) {
    const jobId = options?.uniqueJobId
      ? `creative:${payload.creativeJobId}:${Date.now()}`
      : `creative:${payload.creativeJobId}`;
    return this.creativeQueue.add(
      AI_CREATIVE_JOB_NAMES.BUILD_CREATIVE_JOB,
      payload,
      { jobId },
    );
  }

  async moveToDeadLetter(input: {
    creativeJobId: string;
    errorCode?: CreativeErrorCode;
    message?: string;
  }) {
    return this.deadLetterQueue.add("dead-letter", {
      ...input,
      sourceQueue: this.environment.AI_CREATIVE_QUEUE_NAME,
      errorCode: input.errorCode ?? "CREATIVE_PROVIDER_UNAVAILABLE",
      message: input.message ?? "Job moved to dead letter queue.",
      movedAt: new Date().toISOString(),
    });
  }

  async getQueueStats() {
    const [creativeCounts, deadLetterCounts] = await Promise.all([
      this.creativeQueue.getJobCounts(
        "waiting",
        "active",
        "completed",
        "failed",
        "delayed",
      ),
      this.deadLetterQueue.getJobCounts(
        "waiting",
        "active",
        "completed",
        "failed",
      ),
    ]);
    return {
      creative: {
        waiting: creativeCounts.waiting ?? 0,
        active: creativeCounts.active ?? 0,
        completed: creativeCounts.completed ?? 0,
        failed: creativeCounts.failed ?? 0,
        delayed: creativeCounts.delayed ?? 0,
      },
      deadLetter: {
        waiting: deadLetterCounts.waiting ?? 0,
        active: deadLetterCounts.active ?? 0,
        completed: deadLetterCounts.completed ?? 0,
        failed: deadLetterCounts.failed ?? 0,
      },
    };
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled([
      this.creativeQueue.close(),
      this.deadLetterQueue.close(),
    ]);
  }
}
