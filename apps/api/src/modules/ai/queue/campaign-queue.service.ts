import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Queue } from "bullmq";
import {
  AI_CAMPAIGN_JOB_NAMES,
  type CampaignErrorCode,
} from "@miraaj/shared-types";
import { loadEnvironment } from "../../../environment.js";

export interface GenerateCampaignJobPayload {
  campaignJobId: string;
  recommendationSetId: string;
}

@Injectable()
export class CampaignQueueService implements OnModuleDestroy {
  private readonly environment = loadEnvironment();
  private readonly connection = { url: this.environment.REDIS_URL };
  readonly campaignQueue: Queue<GenerateCampaignJobPayload>;
  readonly deadLetterQueue: Queue<Record<string, unknown>>;

  constructor() {
    this.campaignQueue = new Queue(this.environment.AI_CAMPAIGN_QUEUE_NAME, {
      connection: this.connection,
      defaultJobOptions: {
        attempts: this.environment.AI_CAMPAIGN_MAX_RETRIES + 1,
        backoff: { type: "exponential", delay: 2_000 },
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    });
    this.deadLetterQueue = new Queue(this.environment.AI_CAMPAIGN_DLQ_NAME, {
      connection: this.connection,
    });
  }

  async enqueueBuildCampaign(
    payload: GenerateCampaignJobPayload,
    options?: { uniqueJobId?: boolean },
  ) {
    const jobId = options?.uniqueJobId
      ? `campaign:${payload.campaignJobId}:${Date.now()}`
      : `campaign:${payload.campaignJobId}`;
    return this.campaignQueue.add(
      AI_CAMPAIGN_JOB_NAMES.BUILD_CAMPAIGN_BRIEF,
      payload,
      { jobId },
    );
  }

  async moveToDeadLetter(input: {
    campaignJobId: string;
    errorCode?: CampaignErrorCode;
    message?: string;
  }) {
    return this.deadLetterQueue.add("dead-letter", {
      ...input,
      sourceQueue: this.environment.AI_CAMPAIGN_QUEUE_NAME,
      errorCode: input.errorCode ?? "CAMPAIGN_PROVIDER_UNAVAILABLE",
      message: input.message ?? "Job moved to dead letter queue.",
      movedAt: new Date().toISOString(),
    });
  }

  async getQueueStats() {
    const [campaignCounts, deadLetterCounts] = await Promise.all([
      this.campaignQueue.getJobCounts(
        "waiting",
        "active",
        "completed",
        "failed",
        "delayed",
      ),
      this.deadLetterQueue.getJobCounts("waiting", "active", "completed", "failed"),
    ]);
    return {
      campaigns: {
        waiting: campaignCounts.waiting ?? 0,
        active: campaignCounts.active ?? 0,
        completed: campaignCounts.completed ?? 0,
        failed: campaignCounts.failed ?? 0,
        delayed: campaignCounts.delayed ?? 0,
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
      this.campaignQueue.close(),
      this.deadLetterQueue.close(),
    ]);
  }
}
