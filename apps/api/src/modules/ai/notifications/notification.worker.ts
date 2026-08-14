/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Worker } from "bullmq";
import { loadEnvironment } from "../../../environment.js";
import { NotificationQueueService } from "../queue/notification-queue.service.js";
import { NotificationService } from "./notification.service.js";

@Injectable()
export class NotificationWorker implements OnModuleInit, OnModuleDestroy {
  private readonly environment = loadEnvironment();
  private worker?: Worker;
  private expiryTimer?: ReturnType<typeof setInterval>;
  constructor(private readonly service: NotificationService, private readonly queues: NotificationQueueService) {}
  onModuleInit() {
    if (!this.environment.NOTIFICATION_IN_APP_ENABLED) return;
    this.worker = new Worker(this.environment.NOTIFICATION_QUEUE_NAME, (job) => this.service.deliver(String(job.data.publicId)), { connection: { url: this.environment.REDIS_URL }, concurrency: 4 });
    this.worker.on("failed", (job, error) => { if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) void this.queues.deadLetterItem(String(job.data.publicId), error.message); });
    this.expiryTimer = setInterval(() => {
      void this.service.expireNotifications().then((result) => this.service.cleanupRetention().then((cleanup) => ({ ...result, ...cleanup })));
    }, 60_000);
    this.expiryTimer.unref();
  }
  async onModuleDestroy() { if (this.expiryTimer) clearInterval(this.expiryTimer); if (this.worker) await this.worker.close(); }
}
