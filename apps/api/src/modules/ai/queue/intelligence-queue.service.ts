import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Queue } from "bullmq";
import {
  AI_INTELLIGENCE_JOB_NAMES,
  type IntelligenceErrorCode,
} from "@miraaj/shared-types";
import { loadEnvironment } from "../../../environment.js";

export interface BuildBusinessProfileJobPayload {
  jobId: string;
  analysisResultId: string;
}

@Injectable()
export class IntelligenceQueueService implements OnModuleDestroy {
  private readonly environment = loadEnvironment();
  private readonly connection = { url: this.environment.REDIS_URL };
  readonly intelligenceQueue: Queue<BuildBusinessProfileJobPayload>;
  readonly deadLetterQueue: Queue<Record<string, unknown>>;

  constructor() {
    this.intelligenceQueue = new Queue(this.environment.AI_INTELLIGENCE_QUEUE_NAME, {
      connection: this.connection,
      defaultJobOptions: {
        attempts: this.environment.AI_INTELLIGENCE_MAX_RETRIES + 1,
        backoff: { type: "exponential", delay: 2_000 },
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    });
    this.deadLetterQueue = new Queue(this.environment.AI_INTELLIGENCE_DLQ_NAME, {
      connection: this.connection,
    });
  }

  async enqueueBuildProfile(payload: BuildBusinessProfileJobPayload) {
    return this.intelligenceQueue.add(
      AI_INTELLIGENCE_JOB_NAMES.BUILD_BUSINESS_PROFILE,
      payload,
      { jobId: `intelligence:${payload.jobId}` },
    );
  }

  async moveToDeadLetter(input: {
    jobId: string;
    analysisResultId: string;
    errorCode?: IntelligenceErrorCode;
    message?: string;
  }) {
    return this.deadLetterQueue.add("dead-letter", {
      ...input,
      sourceQueue: this.environment.AI_INTELLIGENCE_QUEUE_NAME,
      errorCode: input.errorCode ?? "INTELLIGENCE_PROVIDER_UNAVAILABLE",
      message: input.message ?? "Job moved to dead letter queue.",
      movedAt: new Date().toISOString(),
    });
  }

  async getQueueStats() {
    const [intelligenceCounts, deadLetterCounts] = await Promise.all([
      this.intelligenceQueue.getJobCounts(
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
      intelligence: {
        waiting: intelligenceCounts.waiting ?? 0,
        active: intelligenceCounts.active ?? 0,
        completed: intelligenceCounts.completed ?? 0,
        failed: intelligenceCounts.failed ?? 0,
        delayed: intelligenceCounts.delayed ?? 0,
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
      this.intelligenceQueue.close(),
      this.deadLetterQueue.close(),
    ]);
  }
}
