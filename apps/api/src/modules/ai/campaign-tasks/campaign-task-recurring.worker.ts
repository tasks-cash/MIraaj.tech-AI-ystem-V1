/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Worker, type Job } from "bullmq";
import { loadEnvironment } from "../../../environment.js";
import { CampaignTaskRecurringQueueService, RECURRING_JOB_NAMES } from "../queue/campaign-task-recurring-queue.service.js";
import { CampaignTaskRecurringService } from "./campaign-task-recurring.service.js";

@Injectable()
export class CampaignTaskRecurringWorker implements OnModuleInit, OnModuleDestroy {
  private readonly environment = loadEnvironment();
  private worker?: Worker;
  private planner?: ReturnType<typeof setInterval>;
  constructor(private readonly service: CampaignTaskRecurringService, private readonly queues: CampaignTaskRecurringQueueService) {}
  onModuleInit() {
    if (!this.environment.CAMPAIGN_TASK_RECURRING_SCHEDULER_ENABLED) return;
    this.worker = new Worker(this.environment.CAMPAIGN_TASK_RECURRING_QUEUE_NAME, (job: Job<{ occurrenceId: string }>) =>
      job.name === RECURRING_JOB_NAMES.COMPLETE ? this.service.complete(job.data.occurrenceId) : this.service.activate(job.data.occurrenceId),
    { connection: { url: this.environment.REDIS_URL }, concurrency: 2 });
    this.worker.on("failed", (job, error) => { if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) void this.queues.moveToDeadLetter(job.data.occurrenceId, error.message); });
    void this.service.planAll();
    this.planner = setInterval(() => void this.service.planAll(), 60_000);
    this.planner.unref();
  }
  async onModuleDestroy() { if (this.planner) clearInterval(this.planner); if (this.worker) await this.worker.close(); }
}
