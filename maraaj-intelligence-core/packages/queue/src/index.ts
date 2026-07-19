
import { Queue, Worker, type JobsOptions, type Processor, type ConnectionOptions } from "bullmq";

export const QUEUE_NAMES = [
  "image-ingestion",
  "image-analysis",
  "ocr",
  "moderation",
  "social-card-generation",
  "header-image-generation",
  "qr-generation",
  "destination-validation",
  "publishing",
  "webhook-delivery",
  "analytics-aggregation",
  "scheduled-recheck",
  "dataset-export",
  "audit-integrity",
] as const;

export type QueueName = (typeof QUEUE_NAMES)[number];

export interface JobContext {
  jobId?: string;
  tenantId: string;
  projectId: string;
  actorId?: string;
  correlationId: string;
  idempotencyKey?: string;
  createdAt: string;
}

export function createQueue(name: QueueName, connection: ConnectionOptions) {
  return new Queue(name, {
    connection,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    },
  });
}

export function createWorker<T>(
  name: QueueName,
  processor: Processor<T>,
  connection: ConnectionOptions,
) {
  return new Worker<T>(name, processor, {
    connection,
    concurrency: 5,
  });
}

export function defaultJobOptions(extra?: JobsOptions): JobsOptions {
  return {
    attempts: 5,
    backoff: { type: "exponential", delay: 2000 },
    ...extra,
  };
}

export { Queue, Worker };
