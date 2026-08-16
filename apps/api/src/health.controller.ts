import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from "@nestjs/common";
import { loadEnvironment } from "./environment.js";
import { InfrastructureService } from "./infrastructure.service.js";
import { AiInternalClientService } from "./modules/ai/ai-internal-client.service.js";

const API_VERSION = "0.1.0";

@Controller()
export class HealthController {
  constructor(
    @Inject(InfrastructureService)
    private readonly infrastructure: InfrastructureService,
    @Inject(AiInternalClientService)
    private readonly aiService: AiInternalClientService,
  ) {}

  private tasksCashReadiness(environment: ReturnType<typeof loadEnvironment>) {
    const enabled = environment.TASKS_CASH_INTEGRATION_ENABLED;
    const hmacSecret = environment.TASKS_CASH_DISTRIBUTION_HMAC_SECRET || environment.TASKS_CASH_HMAC_SECRET;
    const callbackUrl = environment.TASKS_CASH_DISTRIBUTION_CALLBACK_URL || environment.TASKS_CASH_CALLBACK_URL;
    const hmacConfigured = enabled && hmacSecret.length >= 32;
    const callbackUrlConfigured = enabled && Boolean(callbackUrl);
    return {
      enabled,
      hmacConfigured,
      callbackUrlConfigured,
      callbackDeliveryReady: enabled && hmacConfigured && callbackUrlConfigured,
      outboxQueueName: environment.TASKS_CASH_OUTBOX_QUEUE_NAME,
    };
  }

  @Get("health")
  health() {
    const environment = loadEnvironment();
    return {
      status: "ok",
      service: "miraaj-api",
      version: API_VERSION,
      environment: environment.APP_ENV,
      integrations: {
        tasksCash: this.tasksCashReadiness(environment),
      },
    };
  }

  @Get("health/integrations")
  integrations() {
    const environment = loadEnvironment();
    return {
      status: "ok",
      tasksCash: this.tasksCashReadiness(environment),
    };
  }

  @Get("ready")
  async ready() {
    const dependencies = await this.infrastructure.dependencyStatus();
    let aiStatus: "ready" | "unavailable" = "unavailable";
    try {
      const ai = await this.aiService.getReady();
      aiStatus = ai.status === "ready" ? "ready" : "unavailable";
    } catch {
      aiStatus = "unavailable";
    }
    const isReady =
      dependencies.mongo === "ready" &&
      dependencies.redis === "ready" &&
      dependencies.minio === "ready" &&
      aiStatus === "ready";
    if (!isReady) {
      throw new ServiceUnavailableException({
        status: "not_ready",
        service: "miraaj-api",
        dependencies: {
          ...dependencies,
          aiService: aiStatus,
        },
      });
    }
    return {
      status: "ready",
      service: "miraaj-api",
      dependencies: {
        ...dependencies,
        aiService: aiStatus,
      },
    };
  }

  @Get("version")
  version() {
    return {
      service: "miraaj-api",
      version: API_VERSION,
    };
  }
}
