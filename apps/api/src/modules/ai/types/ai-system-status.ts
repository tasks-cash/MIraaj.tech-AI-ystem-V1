import type {
  ServiceHealth,
  ServiceReadiness,
  ServiceVersion,
} from "@miraaj/shared-types";
import type {
  OcrStatusResponse,
  ProvidersStatusResponse,
} from "./ai-media-responses.js";

export interface QueueCountSnapshot {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed?: number;
}

export interface AiSystemStatus {
  module: "ok";
  configuredUrl: string;
  lastCheckedAt: string;
  python: {
    health: ServiceHealth | null;
    readiness: ServiceReadiness | null;
    version: ServiceVersion | null;
    ocr: OcrStatusResponse | null;
    providers: ProvidersStatusResponse | null;
  };
  infrastructure: {
    mongo: "ready" | "unavailable";
    redis: "ready" | "unavailable";
    minio: "ready" | "unavailable";
  };
  queues: {
    validate: QueueCountSnapshot;
    analyze: QueueCountSnapshot;
    deadLetter: QueueCountSnapshot;
    intelligence: QueueCountSnapshot;
    intelligenceDeadLetter: QueueCountSnapshot;
    workers: {
      validateConcurrency: number;
      analyzeConcurrency: number;
      intelligenceConcurrency: number;
    };
  };
  catalog: {
    activeVersionId: string | null;
    activeVersion: number | null;
    serviceCount: number;
    categoryCount: number;
    matchingPolicyId: string | null;
    matchingPolicyVersion: number | null;
  };
  intelligence: {
    awaitingReviewProfiles: number;
    awaitingReviewRecommendations: number;
    reasoningProvider: string;
    reasoningConfigured: boolean;
  };
  review: {
    awaitingReviewJobs: number;
    pendingResults: number;
  };
  staleJobs: {
    reconciledRecently: number;
  };
  campaigns: {
    queue: QueueCountSnapshot;
    deadLetter: QueueCountSnapshot;
    workerConcurrency: number;
    provider: string;
    translationProvider: string;
    autoApproveEnabled: boolean;
    brandProfileVersion: number | null;
    campaignPolicyVersion: number | null;
    platformPolicyVersion: number | null;
    compliancePolicyVersion: number | null;
    glossaryVersion: number | null;
    awaitingReviewJobs: number;
    awaitingReviewPackages: number;
  };
  creative: {
    queue: QueueCountSnapshot;
    deadLetter: QueueCountSnapshot;
    workerConcurrency: number;
    imageProvider: string;
    videoProvider: string;
    renderProvider: string;
    autoApproveEnabled: boolean;
    modelPolicyVersion: number | null;
    renderSpecVersion: number | null;
    providerCapabilityVersion: number | null;
    awaitingReviewJobs: number;
    awaitingReviewAssets: number;
    quarantinedAssets: number;
  };
  logging: {
    subsystemState: "ready" | "degraded" | "unavailable";
    lastSuccessfulLogEmission: string | null;
    auditPersistenceState: string;
    droppedLogCount: number;
    failedAuditWriteCount: number;
    traceExporterState: string;
    metricsExporterState: string;
  };
  error: {
    code: string;
    message: string;
  } | null;
}
