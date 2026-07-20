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
  error: {
    code: string;
    message: string;
  } | null;
}
