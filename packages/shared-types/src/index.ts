export type RequestId = string & { readonly __brand: "RequestId" };
export type CorrelationId = string & { readonly __brand: "CorrelationId" };
export type IdempotencyKey = string & { readonly __brand: "IdempotencyKey" };
export type InternalServiceId = string & { readonly __brand: "InternalServiceId" };

export const JOB_STATUSES = [
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const AI_PROVIDERS = ["gemini", "disabled", "future-local"] as const;
export type AIProvider = (typeof AI_PROVIDERS)[number];

export const ANALYSIS_STATUSES = [
  "pending",
  "queued",
  "processing",
  "completed",
  "failed",
  "cancelled",
] as const;
export type AnalysisStatus = (typeof ANALYSIS_STATUSES)[number];

export const REVIEW_STATUSES = [
  "not_required",
  "pending",
  "in_review",
  "approved",
  "corrected",
  "rejected",
] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export type CountryCode = string & { readonly __brand: "CountryCode" };
export type ConfidenceScore = number & { readonly __brand: "ConfidenceScore" };

export const MEDIA_TYPES = [
  "image",
  "document",
  "video",
  "audio",
  "text",
  "page",
  "channel",
  "group",
] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

export type ServiceHealthStatus = "ok" | "degraded" | "unavailable";
export type ServiceReadinessStatus = "ready" | "not_ready";

export interface ServiceHealth {
  status: ServiceHealthStatus;
  service: string;
  version: string;
  environment: string;
}

export interface DependencyReadiness {
  configured: boolean;
  required: boolean;
  healthy: boolean;
  latencyMs: number | null;
  safeError: string | null;
}

export interface ServiceReadiness {
  status: ServiceReadinessStatus;
  service: string;
  checks: Record<string, boolean | DependencyReadiness>;
}

export interface ServiceVersion {
  service: string;
  version: string;
  environment?: string;
  buildId?: string | null;
}

export interface InternalRequestMetadata {
  serviceId: InternalServiceId | string;
  timestamp: number;
  requestId: RequestId;
  correlationId: CorrelationId;
  idempotencyKey: IdempotencyKey | string;
  bodySha256: string;
  signature: string;
}

/** Future queue names — not operational in Prompt 1. */
export const FUTURE_AI_QUEUE_NAMES = [
  "ai-analysis",
  "ai-campaign-generation",
  "ai-media-processing",
  "ai-publication",
] as const;

export function asConfidenceScore(value: number): ConfidenceScore {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError("Confidence score must be between 0 and 1.");
  }
  return value as ConfidenceScore;
}

export * from "./language-registry.js";
export * from "./multilingual-contracts.js";
export * from "./media-analysis.js";
export * from "./business-intelligence.js";
export * from "./campaign-intelligence.js";
