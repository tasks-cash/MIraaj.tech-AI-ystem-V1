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

@Injectable()
export class AiInternalClientService {
  async getHealth(input?: {
    requestId?: string;
    correlationId?: string;
  }): Promise<ServiceHealth> {
    return this.requestJson<ServiceHealth>("/health", input);
  }

  async getReady(input?: {
    requestId?: string;
    correlationId?: string;
  }): Promise<ServiceReadiness> {
    return this.requestJson<ServiceReadiness>("/ready", input);
  }

  async getVersion(input?: {
    requestId?: string;
    correlationId?: string;
  }): Promise<ServiceVersion> {
    return this.requestJson<ServiceVersion>("/version", input);
  }

  private async requestJson<T>(
    path: string,
    input?: { requestId?: string; correlationId?: string },
  ): Promise<T> {
    const environment = loadEnvironment();
    const logger = createLogger({
      service: "miraaj-api",
      environment: environment.APP_ENV,
      level: environment.LOG_LEVEL,
    });
    const requestId = input?.requestId ?? randomUUID();
    const correlationId = input?.correlationId ?? requestId;
    const metadata = signInternalRequest({
      method: "GET",
      path,
      body: "",
      idempotencyKey: `health-${path}-${requestId}`,
      environment,
      requestId,
      correlationId,
    });
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      environment.AI_SERVICE_REQUEST_TIMEOUT_MS,
    );
    const started = Date.now();
    try {
      const response = await fetch(`${environment.AI_SERVICE_URL}${path}`, {
        headers: internalRequestHeaders(metadata),
        signal: controller.signal,
      });
      logger.info(
        {
          requestId,
          correlationId,
          service: "miraaj-api",
          route: path,
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
