import { Inject, Injectable } from "@nestjs/common";
import { loadEnvironment } from "../../environment.js";
import { AiHealthService } from "./ai-health.service.js";

@Injectable()
export class AiService {
  constructor(
    @Inject(AiHealthService)
    private readonly healthService: AiHealthService,
  ) {}

  getConfiguredUrl(): string {
    return loadEnvironment().AI_SERVICE_URL;
  }

  getSystemStatus(input?: { requestId?: string; correlationId?: string }) {
    return this.healthService.getSystemStatus(input);
  }
}
