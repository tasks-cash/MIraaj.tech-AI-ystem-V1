import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { HeadBucketCommand } from "@aws-sdk/client-s3";
import { loadEnvironment } from "../../environment.js";
import { createS3Client } from "../../s3-client.js";
import { InfrastructureService } from "../../infrastructure.service.js";
import { AiInternalClientService } from "./ai-internal-client.service.js";
import { AnalysisJobModel } from "./models/analysis-job.schema.js";
import { AnalysisResultModel } from "./models/analysis-result.schema.js";
import { MediaQueueService } from "./queue/media-queue.service.js";
import { StaleJobService } from "./queue/stale-job.service.js";
import {
  AiServiceTimeoutError,
  AiServiceUnavailableError,
} from "./types/ai-errors.js";
import type { AiSystemStatus } from "./types/ai-system-status.js";

@Injectable()
export class AiHealthService {
  constructor(
    @Inject(AiInternalClientService)
    private readonly client: AiInternalClientService,
    @Inject(InfrastructureService)
    private readonly infrastructure: InfrastructureService,
    @Inject(MediaQueueService)
    private readonly mediaQueue: MediaQueueService,
    @Inject(StaleJobService)
    private readonly staleJobService: StaleJobService,
  ) {}

  async getSystemStatus(input?: {
    requestId?: string;
    correlationId?: string;
  }): Promise<AiSystemStatus> {
    const environment = loadEnvironment();
    const requestId = input?.requestId ?? randomUUID();
    const correlationId = input?.correlationId ?? requestId;
    const lastCheckedAt = new Date().toISOString();
    const [dependencyStatus, queueStats, awaitingReviewJobs, pendingResults, staleCount] =
      await Promise.all([
        this.infrastructure.dependencyStatus(),
        this.mediaQueue.getQueueStats(),
        AnalysisJobModel.countDocuments({ status: "awaiting_review" }),
        AnalysisResultModel.countDocuments({ reviewStatus: "pending" }),
        this.staleJobService.reconcileStaleJobs(),
      ]);
    const minio = await this.checkMinio();

    try {
      const [health, readiness, version, ocrStatus, providersStatus] =
        await Promise.all([
          this.client.getHealth({ requestId, correlationId }),
          this.client.getReady({ requestId, correlationId }),
          this.client.getVersion({ requestId, correlationId }),
          this.client.getOcrStatus({ requestId, correlationId }).catch(() => null),
          this.client
            .getProvidersStatus({ requestId, correlationId })
            .catch(() => null),
        ]);
      return {
        module: "ok",
        configuredUrl: environment.AI_SERVICE_URL,
        lastCheckedAt,
        python: {
          health,
          readiness,
          version,
          ocr: ocrStatus,
          providers: providersStatus,
        },
        infrastructure: {
          mongo: dependencyStatus.mongo,
          redis: dependencyStatus.redis,
          minio,
        },
        queues: {
          validate: queueStats.validate as unknown as AiSystemStatus["queues"]["validate"],
          analyze: queueStats.analyze as unknown as AiSystemStatus["queues"]["analyze"],
          deadLetter: queueStats.deadLetter as unknown as AiSystemStatus["queues"]["deadLetter"],
          workers: {
            validateConcurrency: environment.MEDIA_WORKER_CONCURRENCY,
            analyzeConcurrency: environment.MEDIA_WORKER_CONCURRENCY,
          },
        },
        review: {
          awaitingReviewJobs,
          pendingResults,
        },
        staleJobs: {
          reconciledRecently: staleCount,
        },
        error: null,
      };
    } catch (error: unknown) {
      const safe =
        error instanceof AiServiceTimeoutError ||
        error instanceof AiServiceUnavailableError
          ? { code: error.code, message: error.message }
          : {
              code: "AI_SERVICE_UNAVAILABLE",
              message: "The AI service is unavailable.",
            };
      return {
        module: "ok",
        configuredUrl: environment.AI_SERVICE_URL,
        lastCheckedAt,
        python: {
          health: null,
          readiness: null,
          version: null,
          ocr: null,
          providers: null,
        },
        infrastructure: {
          mongo: dependencyStatus.mongo,
          redis: dependencyStatus.redis,
          minio,
        },
        queues: {
          validate: queueStats.validate as unknown as AiSystemStatus["queues"]["validate"],
          analyze: queueStats.analyze as unknown as AiSystemStatus["queues"]["analyze"],
          deadLetter: queueStats.deadLetter as unknown as AiSystemStatus["queues"]["deadLetter"],
          workers: {
            validateConcurrency: environment.MEDIA_WORKER_CONCURRENCY,
            analyzeConcurrency: environment.MEDIA_WORKER_CONCURRENCY,
          },
        },
        review: {
          awaitingReviewJobs,
          pendingResults,
        },
        staleJobs: {
          reconciledRecently: staleCount,
        },
        error: safe,
      };
    }
  }

  private async checkMinio(): Promise<"ready" | "unavailable"> {
    const environment = loadEnvironment();
    try {
      const client = createS3Client();
      await client.send(new HeadBucketCommand({ Bucket: environment.S3_BUCKET }));
      return "ready";
    } catch {
      return "unavailable";
    }
  }
}
