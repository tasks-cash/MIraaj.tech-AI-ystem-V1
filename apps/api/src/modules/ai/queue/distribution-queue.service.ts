import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Queue } from "bullmq";
import { loadEnvironment } from "../../../environment.js";

export const DISTRIBUTION_JOB_NAMES = {
  BUILD_CONTENT: "build-distribution-content",
  VERIFY_PROOF: "verify-proof",
  DELIVER_OUTBOX: "deliver-tasks-cash-outbox",
} as const;

@Injectable()
export class DistributionQueueService implements OnModuleDestroy {
  private readonly environment = loadEnvironment();
  private readonly connection = { url: this.environment.REDIS_URL };
  readonly contentQueue = new Queue(this.environment.AI_DISTRIBUTION_CONTENT_QUEUE_NAME, { connection: this.connection });
  readonly proofQueue = new Queue(this.environment.AI_PROOF_VERIFICATION_QUEUE_NAME, {
    connection: this.connection,
    defaultJobOptions: {
      attempts: this.environment.AI_PROOF_MAX_RETRIES + 1,
      backoff: { type: "exponential", delay: 2_000 },
      removeOnComplete: 250,
      removeOnFail: 250,
    },
  });
  readonly proofDeadLetterQueue = new Queue(this.environment.AI_PROOF_VERIFICATION_DLQ_NAME, { connection: this.connection });
  readonly outboxQueue = new Queue(this.environment.TASKS_CASH_OUTBOX_QUEUE_NAME, {
    connection: this.connection,
    defaultJobOptions: {
      attempts: this.environment.TASKS_CASH_CALLBACK_MAX_RETRIES,
      backoff: { type: "exponential", delay: 5_000 },
      removeOnComplete: 500,
      removeOnFail: 500,
    },
  });

  enqueueContent(templateId: string) {
    return this.contentQueue.add(DISTRIBUTION_JOB_NAMES.BUILD_CONTENT, { templateId }, { jobId: `distribution-content:${templateId}` });
  }

  enqueueProof(proofSubmissionId: string) {
    return this.proofQueue.add(DISTRIBUTION_JOB_NAMES.VERIFY_PROOF, { proofSubmissionId }, { jobId: `proof:${proofSubmissionId}` });
  }

  enqueueOutbox(eventId: string) {
    return this.outboxQueue.add(DISTRIBUTION_JOB_NAMES.DELIVER_OUTBOX, { eventId }, { jobId: `outbox:${eventId}` });
  }

  async moveProofToDeadLetter(proofSubmissionId: string, safeError: string) {
    return this.proofDeadLetterQueue.add("dead-letter", { proofSubmissionId, safeError, movedAt: new Date().toISOString() }, { jobId: `proof-dlq:${proofSubmissionId}` });
  }

  async getQueueStats() {
    const queues = [this.contentQueue, this.proofQueue, this.proofDeadLetterQueue, this.outboxQueue];
    const counts = await Promise.all(queues.map((queue) => queue.getJobCounts("waiting", "active", "completed", "failed", "delayed")));
    const names = ["distributionContent", "proofVerification", "proofDeadLetter", "tasksCashOutbox"] as const;
    return Object.fromEntries(names.map((name, index) => [name, counts[index]]));
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled([this.contentQueue.close(), this.proofQueue.close(), this.proofDeadLetterQueue.close(), this.outboxQueue.close()]);
  }
}
