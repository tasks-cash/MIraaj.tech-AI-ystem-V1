import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Queue } from "bullmq";
import { loadEnvironment } from "../../../environment.js";

export const NOTIFICATION_JOB_NAMES = { DISPATCH: "notificationDispatch", RETRY: "notificationRetry", EXPIRY: "notificationExpiry", EMAIL: "notificationEmailDelivery", WEBHOOK: "notificationWebhookDelivery" } as const;
@Injectable()
export class NotificationQueueService implements OnModuleDestroy {
  private readonly environment = loadEnvironment();
  readonly queue = new Queue(this.environment.NOTIFICATION_QUEUE_NAME, { connection: { url: this.environment.REDIS_URL }, defaultJobOptions: { attempts: 4, backoff: { type: "exponential", delay: 2_000 }, removeOnComplete: 500, removeOnFail: 500 } });
  readonly deadLetter = new Queue(this.environment.NOTIFICATION_DLQ_NAME, { connection: { url: this.environment.REDIS_URL } });
  enqueue(publicId: string) { return this.queue.add(NOTIFICATION_JOB_NAMES.DISPATCH, { publicId }, { jobId: `notification-${publicId}` }); }
  deadLetterItem(publicId: string, safeError: string) { return this.deadLetter.add("dead-letter", { publicId, safeError: safeError.slice(0, 120) }, { jobId: `notification-dlq-${publicId}` }); }
  async stats() { return { notifications: await this.queue.getJobCounts(), deadLetter: await this.deadLetter.getJobCounts() }; }
  async onModuleDestroy() { await Promise.allSettled([this.queue.close(), this.deadLetter.close()]); }
}
