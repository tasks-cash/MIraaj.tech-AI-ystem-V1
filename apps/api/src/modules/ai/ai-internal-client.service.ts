import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { createLogger } from "@miraaj/shared-logging";
import type {
  ServiceHealth,
  ServiceReadiness,
  ServiceVersion,
} from "@miraaj/shared-types";
import { loadEnvironment } from "../../environment.js";
import {
  internalRequestHeaders,
  signInternalRequest,
} from "../../internal-auth.js";
import {
  AiServiceTimeoutError,
  AiServiceUnavailableError,
} from "./types/ai-errors.js";
import type {
  AnalyzeResponse,
  MediaInspectResponse,
  OcrStatusResponse,
  ProvidersStatusResponse,
  SignedMediaRequestBody,
} from "./types/ai-media-responses.js";
import type {
  BusinessProfileReasoningRequestBody,
  BusinessProfileReasoningResponse,
  ContradictionCheckResponse,
  IntelligenceProvidersStatusResponse,
  NeedsSuggestionResponse,
} from "./types/ai-intelligence-responses.js";

@Injectable()
export class AiInternalClientService {
  async getHealth(input?: {
    requestId?: string;
    correlationId?: string;
  }): Promise<ServiceHealth> {
    return this.requestJson<ServiceHealth>({ method: "GET", path: "/health", ...input });
  }

  async getReady(input?: {
    requestId?: string;
    correlationId?: string;
  }): Promise<ServiceReadiness> {
    return this.requestJson<ServiceReadiness>({ method: "GET", path: "/ready", ...input });
  }

  async getVersion(input?: {
    requestId?: string;
    correlationId?: string;
  }): Promise<ServiceVersion> {
    return this.requestJson<ServiceVersion>({ method: "GET", path: "/version", ...input });
  }

  async postInspect(
    body: SignedMediaRequestBody,
    input?: { requestId?: string; correlationId?: string; idempotencyKey?: string },
  ): Promise<MediaInspectResponse> {
    return this.requestJson<MediaInspectResponse>({
      method: "POST",
      path: "/internal/v1/media/inspect",
      body,
      timeoutMs: loadEnvironment().MEDIA_PROCESSING_TIMEOUT_SECONDS * 1_000,
      idempotencyKey: input?.idempotencyKey ?? `inspect-${randomUUID()}`,
      ...input,
    });
  }

  async postOcr(
    body: SignedMediaRequestBody,
    input?: { requestId?: string; correlationId?: string; idempotencyKey?: string },
  ) {
    return this.requestJson({
      method: "POST",
      path: "/internal/v1/media/ocr",
      body,
      timeoutMs: loadEnvironment().MEDIA_OCR_TIMEOUT_SECONDS * 1_000,
      idempotencyKey: input?.idempotencyKey ?? `ocr-${randomUUID()}`,
      ...input,
    });
  }

  async postAnalyze(
    body: SignedMediaRequestBody,
    input?: { requestId?: string; correlationId?: string; idempotencyKey?: string },
  ): Promise<AnalyzeResponse> {
    return this.requestJson<AnalyzeResponse>({
      method: "POST",
      path: "/internal/v1/media/analyze",
      body,
      timeoutMs: loadEnvironment().MEDIA_VISION_TIMEOUT_SECONDS * 1_000,
      idempotencyKey: input?.idempotencyKey ?? `analyze-${randomUUID()}`,
      ...input,
    });
  }

  async getOcrStatus(input?: {
    requestId?: string;
    correlationId?: string;
  }): Promise<OcrStatusResponse> {
    return this.requestJson<OcrStatusResponse>({
      method: "GET",
      path: "/internal/v1/ocr/status",
      ...input,
    });
  }

  async getProvidersStatus(input?: {
    requestId?: string;
    correlationId?: string;
  }): Promise<ProvidersStatusResponse> {
    return this.requestJson<ProvidersStatusResponse>({
      method: "GET",
      path: "/internal/v1/providers/status",
      ...input,
    });
  }

  /**
   * Optional reasoning provider. Its output is advisory evidence only —
   * NestJS's deterministic BusinessProfileService always makes the final
   * decision on business type, audience, and services.
   */
  async postBusinessProfile(
    body: BusinessProfileReasoningRequestBody,
    input?: { requestId?: string; correlationId?: string; idempotencyKey?: string },
  ): Promise<BusinessProfileReasoningResponse> {
    return this.requestJson<BusinessProfileReasoningResponse>({
      method: "POST",
      path: "/internal/v1/intelligence/business-profile",
      body,
      timeoutMs: loadEnvironment().AI_REASONING_TIMEOUT_SECONDS * 1_000,
      idempotencyKey: input?.idempotencyKey ?? `intelligence-profile-${randomUUID()}`,
      ...input,
    });
  }

  async postNeeds(
    body: BusinessProfileReasoningRequestBody,
    input?: { requestId?: string; correlationId?: string; idempotencyKey?: string },
  ): Promise<NeedsSuggestionResponse> {
    return this.requestJson<NeedsSuggestionResponse>({
      method: "POST",
      path: "/internal/v1/intelligence/needs",
      body,
      timeoutMs: loadEnvironment().AI_REASONING_TIMEOUT_SECONDS * 1_000,
      idempotencyKey: input?.idempotencyKey ?? `intelligence-needs-${randomUUID()}`,
      ...input,
    });
  }

  async postContradictions(
    body: BusinessProfileReasoningRequestBody,
    input?: { requestId?: string; correlationId?: string; idempotencyKey?: string },
  ): Promise<ContradictionCheckResponse> {
    return this.requestJson<ContradictionCheckResponse>({
      method: "POST",
      path: "/internal/v1/intelligence/contradictions",
      body,
      timeoutMs: loadEnvironment().AI_REASONING_TIMEOUT_SECONDS * 1_000,
      idempotencyKey: input?.idempotencyKey ?? `intelligence-contradictions-${randomUUID()}`,
      ...input,
    });
  }

  async getIntelligenceProvidersStatus(input?: {
    requestId?: string;
    correlationId?: string;
  }): Promise<IntelligenceProvidersStatusResponse> {
    return this.requestJson<IntelligenceProvidersStatusResponse>({
      method: "GET",
      path: "/internal/v1/intelligence/providers/status",
      ...input,
    });
  }

  /**
   * Optional campaign strategy/generation/transcreation/quality/compliance
   * provider. NestJS's CampaignJobService and CampaignWorkerService already
   * fixed the objective, audience, and services before any of these calls
   * are made — the provider only ever drafts within that fixed scope, and
   * NestJS validation/quality scoring remains authoritative regardless of
   * what the provider returns.
   */
  async postCampaignStrategy(
    body: Record<string, unknown>,
    input?: { requestId?: string; correlationId?: string; idempotencyKey?: string },
  ): Promise<Record<string, unknown>> {
    return this.requestJson<Record<string, unknown>>({
      method: "POST",
      path: "/internal/v1/campaigns/strategy",
      body,
      timeoutMs: loadEnvironment().AI_CAMPAIGN_PROVIDER_TIMEOUT_SECONDS * 1_000,
      idempotencyKey: input?.idempotencyKey ?? `campaign-strategy-${randomUUID()}`,
      ...input,
    });
  }

  async postCampaignGenerate(
    body: Record<string, unknown>,
    input?: { requestId?: string; correlationId?: string; idempotencyKey?: string },
  ): Promise<Record<string, unknown>> {
    return this.requestJson<Record<string, unknown>>({
      method: "POST",
      path: "/internal/v1/campaigns/generate",
      body,
      timeoutMs: loadEnvironment().AI_CAMPAIGN_PROVIDER_TIMEOUT_SECONDS * 1_000,
      idempotencyKey: input?.idempotencyKey ?? `campaign-generate-${randomUUID()}`,
      ...input,
    });
  }

  async postCampaignTranscreate(
    body: Record<string, unknown>,
    input?: { requestId?: string; correlationId?: string; idempotencyKey?: string },
  ): Promise<Record<string, unknown>> {
    return this.requestJson<Record<string, unknown>>({
      method: "POST",
      path: "/internal/v1/campaigns/transcreate",
      body,
      timeoutMs: loadEnvironment().AI_TRANSLATION_TIMEOUT_SECONDS * 1_000,
      idempotencyKey: input?.idempotencyKey ?? `campaign-transcreate-${randomUUID()}`,
      ...input,
    });
  }

  async postCampaignQualityCheck(
    body: Record<string, unknown>,
    input?: { requestId?: string; correlationId?: string; idempotencyKey?: string },
  ): Promise<Record<string, unknown>> {
    return this.requestJson<Record<string, unknown>>({
      method: "POST",
      path: "/internal/v1/campaigns/quality-check",
      body,
      timeoutMs: loadEnvironment().AI_CAMPAIGN_PROVIDER_TIMEOUT_SECONDS * 1_000,
      idempotencyKey: input?.idempotencyKey ?? `campaign-quality-${randomUUID()}`,
      ...input,
    });
  }

  async postCampaignComplianceCheck(
    body: Record<string, unknown>,
    input?: { requestId?: string; correlationId?: string; idempotencyKey?: string },
  ): Promise<Record<string, unknown>> {
    return this.requestJson<Record<string, unknown>>({
      method: "POST",
      path: "/internal/v1/campaigns/compliance-check",
      body,
      timeoutMs: loadEnvironment().AI_CAMPAIGN_PROVIDER_TIMEOUT_SECONDS * 1_000,
      idempotencyKey: input?.idempotencyKey ?? `campaign-compliance-${randomUUID()}`,
      ...input,
    });
  }

  async getCampaignProvidersStatus(input?: {
    requestId?: string;
    correlationId?: string;
  }): Promise<Record<string, unknown>> {
    return this.requestJson<Record<string, unknown>>({
      method: "GET",
      path: "/internal/v1/campaigns/providers/status",
      ...input,
    });
  }

  /**
   * Optional creative media providers. NestJS owns eligibility, rights, review,
   * and approval — FastAPI only generates/renders/validates media bytes.
   */
  async postCreativeGenerateImage(
    body: Record<string, unknown>,
    input?: { requestId?: string; correlationId?: string; idempotencyKey?: string },
  ): Promise<Record<string, unknown>> {
    return this.requestJson<Record<string, unknown>>({
      method: "POST",
      path: "/internal/v1/creative/generate-image",
      body,
      timeoutMs: loadEnvironment().AI_IMAGE_PROVIDER_TIMEOUT_SECONDS * 1_000,
      idempotencyKey: input?.idempotencyKey ?? `creative-image-${randomUUID()}`,
      ...input,
    });
  }

  async postCreativeGenerateVideo(
    body: Record<string, unknown>,
    input?: { requestId?: string; correlationId?: string; idempotencyKey?: string },
  ): Promise<Record<string, unknown>> {
    return this.requestJson<Record<string, unknown>>({
      method: "POST",
      path: "/internal/v1/creative/generate-video",
      body,
      timeoutMs: loadEnvironment().AI_VIDEO_PROVIDER_TIMEOUT_SECONDS * 1_000,
      idempotencyKey: input?.idempotencyKey ?? `creative-video-${randomUUID()}`,
      ...input,
    });
  }

  async postCreativeRenderImageVariant(
    body: Record<string, unknown>,
    input?: { requestId?: string; correlationId?: string; idempotencyKey?: string },
  ): Promise<Record<string, unknown>> {
    return this.requestJson<Record<string, unknown>>({
      method: "POST",
      path: "/internal/v1/creative/render/image-variant",
      body,
      timeoutMs: loadEnvironment().AI_RENDER_TIMEOUT_SECONDS * 1_000,
      idempotencyKey: input?.idempotencyKey ?? `creative-render-image-${randomUUID()}`,
      ...input,
    });
  }

  async postCreativeRenderTextOverlay(
    body: Record<string, unknown>,
    input?: { requestId?: string; correlationId?: string; idempotencyKey?: string },
  ): Promise<Record<string, unknown>> {
    return this.requestJson<Record<string, unknown>>({
      method: "POST",
      path: "/internal/v1/creative/render/text-overlay",
      body,
      timeoutMs: loadEnvironment().AI_RENDER_TIMEOUT_SECONDS * 1_000,
      idempotencyKey: input?.idempotencyKey ?? `creative-overlay-${randomUUID()}`,
      ...input,
    });
  }

  async postCreativeRenderSubtitles(
    body: Record<string, unknown>,
    input?: { requestId?: string; correlationId?: string; idempotencyKey?: string },
  ): Promise<Record<string, unknown>> {
    return this.requestJson<Record<string, unknown>>({
      method: "POST",
      path: "/internal/v1/creative/render/subtitles",
      body,
      timeoutMs: loadEnvironment().AI_RENDER_TIMEOUT_SECONDS * 1_000,
      idempotencyKey: input?.idempotencyKey ?? `creative-subtitles-${randomUUID()}`,
      ...input,
    });
  }

  async postCreativeValidateMedia(
    body: Record<string, unknown>,
    input?: { requestId?: string; correlationId?: string; idempotencyKey?: string },
  ): Promise<Record<string, unknown>> {
    return this.requestJson<Record<string, unknown>>({
      method: "POST",
      path: "/internal/v1/creative/validate-media",
      body,
      timeoutMs: loadEnvironment().AI_RENDER_TIMEOUT_SECONDS * 1_000,
      idempotencyKey: input?.idempotencyKey ?? `creative-validate-${randomUUID()}`,
      ...input,
    });
  }

  async postCreativeOcrCheck(
    body: Record<string, unknown>,
    input?: { requestId?: string; correlationId?: string; idempotencyKey?: string },
  ): Promise<Record<string, unknown>> {
    return this.requestJson<Record<string, unknown>>({
      method: "POST",
      path: "/internal/v1/creative/ocr-check",
      body,
      timeoutMs: loadEnvironment().MEDIA_OCR_TIMEOUT_SECONDS * 1_000,
      idempotencyKey: input?.idempotencyKey ?? `creative-ocr-${randomUUID()}`,
      ...input,
    });
  }

  async getCreativeProvidersStatus(input?: {
    requestId?: string;
    correlationId?: string;
  }): Promise<Record<string, unknown>> {
    return this.requestJson<Record<string, unknown>>({
      method: "GET",
      path: "/internal/v1/creative/providers/status",
      ...input,
    });
  }

  private async requestJson<T>(input: {
    method: "GET" | "POST";
    path: string;
    body?: unknown;
    requestId?: string;
    correlationId?: string;
    idempotencyKey?: string;
    timeoutMs?: number;
  }): Promise<T> {
    const environment = loadEnvironment();
    const logger = createLogger({
      service: "miraaj-api",
      environment: environment.APP_ENV,
      level: environment.LOG_LEVEL,
    });
    const requestId = input.requestId ?? randomUUID();
    const correlationId = input.correlationId ?? requestId;
    const bodyText =
      input.method === "GET" ? "" : JSON.stringify(input.body ?? {});
    const idempotencyKey =
      input.idempotencyKey ??
      (input.method === "GET" ? `get-${input.path}-${requestId}` : `post-${requestId}`);
    const metadata = signInternalRequest({
      method: input.method,
      path: input.path,
      body: bodyText,
      idempotencyKey,
      environment,
      requestId,
      correlationId,
    });
    const controller = new AbortController();
    const timeoutMs = input.timeoutMs ?? environment.AI_SERVICE_REQUEST_TIMEOUT_MS;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const started = Date.now();
    try {
      const response = await fetch(`${environment.AI_SERVICE_URL}${input.path}`, {
        method: input.method,
        headers: {
          ...internalRequestHeaders(metadata),
          ...(input.method === "POST"
            ? { "Content-Type": "application/json" }
            : {}),
        },
        ...(input.method === "POST" ? { body: bodyText } : {}),
        signal: controller.signal,
      });
      logger.info(
        {
          requestId,
          correlationId,
          service: "miraaj-api",
          route: input.path,
          duration: Date.now() - started,
          status: response.status,
        },
        "ai_service_request_completed",
      );
      if (!response.ok) {
        throw new AiServiceUnavailableError(
          `AI service returned HTTP ${response.status}.`,
        );
      }
      return (await response.json()) as T;
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new AiServiceTimeoutError();
      }
      if (
        error instanceof AiServiceUnavailableError ||
        error instanceof AiServiceTimeoutError
      ) {
        throw error;
      }
      throw new AiServiceUnavailableError();
    } finally {
      clearTimeout(timeout);
    }
  }
}
