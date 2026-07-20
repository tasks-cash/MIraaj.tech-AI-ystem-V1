import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { HeadBucketCommand } from "@aws-sdk/client-s3";
import { loadEnvironment } from "../../environment.js";
import { createS3Client } from "../../s3-client.js";
import { InfrastructureService } from "../../infrastructure.service.js";
import { AiInternalClientService } from "./ai-internal-client.service.js";
import { AnalysisJobModel } from "./models/analysis-job.schema.js";
import { AnalysisResultModel } from "./models/analysis-result.schema.js";
import { BusinessProfileModel } from "./models/business-profile.schema.js";
import { ServiceRecommendationSetModel } from "./models/service-recommendation-set.schema.js";
import { ServiceCatalogItemModel } from "./models/service-catalog-item.schema.js";
import { ServiceCategoryModel } from "./models/service-category.schema.js";
import { ServiceCatalogVersionModel } from "./models/service-catalog-version.schema.js";
import { ServiceMatchingPolicyModel } from "./models/service-matching-policy.schema.js";
import { MediaQueueService } from "./queue/media-queue.service.js";
import { IntelligenceQueueService } from "./queue/intelligence-queue.service.js";
import { StaleJobService } from "./queue/stale-job.service.js";
import {
  AiServiceTimeoutError,
  AiServiceUnavailableError,
} from "./types/ai-errors.js";
import type { AiSystemStatus } from "./types/ai-system-status.js";

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => {
      setTimeout(() => resolve(fallback), ms);
    }),
  ]);
}

@Injectable()
export class AiHealthService {
  constructor(
    @Inject(AiInternalClientService)
    private readonly client: AiInternalClientService,
    @Inject(InfrastructureService)
    private readonly infrastructure: InfrastructureService,
    @Inject(MediaQueueService)
    private readonly mediaQueue: MediaQueueService,
    @Inject(IntelligenceQueueService)
    private readonly intelligenceQueue: IntelligenceQueueService,
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
    const [
      dependencyStatus,
      queueStats,
      intelligenceStats,
      awaitingReviewJobs,
      pendingResults,
      awaitingReviewProfiles,
      awaitingReviewRecommendations,
      activeCatalog,
      activePolicy,
      serviceCount,
      categoryCount,
      staleCount,
    ] = await Promise.all([
      this.infrastructure.dependencyStatus(),
      this.mediaQueue.getQueueStats(),
      this.intelligenceQueue.getQueueStats(),
      withTimeout(
        AnalysisJobModel.countDocuments({ status: "awaiting_review" }),
        1_000,
        0,
      ),
      withTimeout(
        AnalysisResultModel.countDocuments({ reviewStatus: "pending" }),
        1_000,
        0,
      ),
      withTimeout(
        BusinessProfileModel.countDocuments({ status: "awaiting_review" }),
        1_000,
        0,
      ),
      withTimeout(
        ServiceRecommendationSetModel.countDocuments({
          status: "awaiting_review",
        }),
        1_000,
        0,
      ),
      withTimeout(
        ServiceCatalogVersionModel.findOne({ status: "active" }).lean() as Promise<
          { versionId: string; version: number } | null
        >,
        1_000,
        null,
      ),
      withTimeout(
        ServiceMatchingPolicyModel.findOne({ status: "active" }).lean() as Promise<
          { policyId: string; version: number } | null
        >,
        1_000,
        null,
      ),
      withTimeout(
        ServiceCatalogItemModel.countDocuments({ status: "active" }),
        1_000,
        0,
      ),
      withTimeout(ServiceCategoryModel.countDocuments({}), 1_000, 0),
      withTimeout(this.staleJobService.reconcileStaleJobs(), 1_000, 0),
    ]);
    const minio = await this.checkMinio();
    const dlqFailed = await this.intelligenceQueue.deadLetterQueue
      .getFailedCount()
      .catch(() => 0);
    const dlqWaiting = await this.intelligenceQueue.deadLetterQueue
      .getWaitingCount()
      .catch(() => 0);

    const baseQueues: AiSystemStatus["queues"] = {
      validate: queueStats.validate as unknown as AiSystemStatus["queues"]["validate"],
      analyze: queueStats.analyze as unknown as AiSystemStatus["queues"]["analyze"],
      deadLetter: queueStats.deadLetter as unknown as AiSystemStatus["queues"]["deadLetter"],
      intelligence: intelligenceStats.intelligence,
      intelligenceDeadLetter: {
        waiting: dlqWaiting,
        active: 0,
        completed: 0,
        failed: dlqFailed,
      },
      workers: {
        validateConcurrency: environment.MEDIA_WORKER_CONCURRENCY,
        analyzeConcurrency: environment.MEDIA_WORKER_CONCURRENCY,
        intelligenceConcurrency: environment.AI_INTELLIGENCE_WORKER_CONCURRENCY,
      },
    };

    const catalogBlock: AiSystemStatus["catalog"] = {
      activeVersionId: activeCatalog?.versionId ?? null,
      activeVersion: activeCatalog?.version ?? null,
      serviceCount,
      categoryCount,
      matchingPolicyId: activePolicy?.policyId ?? null,
      matchingPolicyVersion: activePolicy?.version ?? null,
    };

    const intelligenceBlock: AiSystemStatus["intelligence"] = {
      awaitingReviewProfiles,
      awaitingReviewRecommendations,
      reasoningProvider: environment.AI_REASONING_PROVIDER,
      reasoningConfigured: Boolean(environment.AI_REASONING_MODEL),
    };

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
        queues: baseQueues,
        catalog: catalogBlock,
        intelligence: intelligenceBlock,
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
        queues: baseQueues,
        catalog: catalogBlock,
        intelligence: intelligenceBlock,
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
      await Promise.race([
        client.send(new HeadBucketCommand({ Bucket: environment.S3_BUCKET })),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error("minio-timeout")), 1_500);
        }),
      ]);
      return "ready";
    } catch {
      return "unavailable";
    }
  }
}
