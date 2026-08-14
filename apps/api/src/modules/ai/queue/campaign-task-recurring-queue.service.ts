import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Queue } from "bullmq";
import { loadEnvironment } from "../../../environment.js";

export const RECURRING_JOB_NAMES = { ACTIVATE: "campaignTaskOccurrenceActivate", COMPLETE: "campaignTaskOccurrenceComplete", RECOVER: "campaignTaskRecurringRecover" } as const;

@Injectable()
export class CampaignTaskRecurringQueueService implements OnModuleDestroy {
  private readonly environment = loadEnvironment();
  readonly queue = new Queue(this.environment.CAMPAIGN_TASK_RECURRING_QUEUE_NAME, { connection: { url: this.environment.REDIS_URL }, defaultJobOptions: { attempts: 4, backoff: { type: "exponential", delay: 2_000 }, removeOnComplete: 250, removeOnFail: 250 } });
  readonly deadLetter = new Queue(this.environment.CAMPAIGN_TASK_RECURRING_DLQ_NAME, { connection: { url: this.environment.REDIS_URL } });
  enqueueActivation(occurrenceId: string, scheduledFor: Date) { return this.queue.add(RECURRING_JOB_NAMES.ACTIVATE, { occurrenceId }, { jobId: `occurrence:activate:${occurrenceId}`, delay: Math.max(0, scheduledFor.getTime() - Date.now()) }); }
  enqueueCompletion(occurrenceId: string, at: Date) { return this.queue.add(RECURRING_JOB_NAMES.COMPLETE, { occurrenceId }, { jobId: `occurrence:complete:${occurrenceId}`, delay: Math.max(0, at.getTime() - Date.now()) }); }
  moveToDeadLetter(occurrenceId: string, safeError: string) { return this.deadLetter.add("dead-letter", { occurrenceId, safeError: safeError.slice(0, 120) }, { jobId: `occurrence:dlq:${occurrenceId}` }); }
  async stats() { return { recurring: await this.queue.getJobCounts(), deadLetter: await this.deadLetter.getJobCounts() }; }
  async onModuleDestroy() { await Promise.allSettled([this.queue.close(), this.deadLetter.close()]); }
}
