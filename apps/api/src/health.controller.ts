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

  @Get("health")
  health() {
    const environment = loadEnvironment();
    return {
      status: "ok",
      service: "miraaj-api",
      version: API_VERSION,
      environment: environment.APP_ENV,
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
