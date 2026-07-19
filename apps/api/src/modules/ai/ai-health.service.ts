import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { loadEnvironment } from "../../environment.js";
import { AiInternalClientService } from "./ai-internal-client.service.js";
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
  ) {}

  async getSystemStatus(input?: {
    requestId?: string;
    correlationId?: string;
  }): Promise<AiSystemStatus> {
    const environment = loadEnvironment();
    const requestId = input?.requestId ?? randomUUID();
    const correlationId = input?.correlationId ?? requestId;
    const lastCheckedAt = new Date().toISOString();
    try {
      const [health, readiness, version] = await Promise.all([
        this.client.getHealth({ requestId, correlationId }),
        this.client.getReady({ requestId, correlationId }),
        this.client.getVersion({ requestId, correlationId }),
      ]);
      return {
        module: "ok",
        configuredUrl: environment.AI_SERVICE_URL,
        lastCheckedAt,
        python: { health, readiness, version },
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
        python: { health: null, readiness: null, version: null },
        error: safe,
      };
    }
  }
}
