import { Controller, Get, Headers, Inject, UseGuards } from "@nestjs/common";
import { AI_PERMISSIONS } from "@miraaj/shared-config";
import { AdminAuthGuard } from "./guards/admin-auth.guard.js";
import { AiPermissionGuard } from "./guards/ai-permission.guard.js";
import { AiSystemStatusRateLimitGuard } from "./guards/ai-system-status-rate-limit.guard.js";
import { RequireAiPermission } from "./decorators/require-ai-permission.decorator.js";
import { AiService } from "./ai.service.js";

@Controller("api/admin/ai")
@UseGuards(
  AiSystemStatusRateLimitGuard,
  AdminAuthGuard,
  AiPermissionGuard,
)
export class AiController {
  constructor(
    @Inject(AiService)
    private readonly aiService: AiService,
  ) {}

  @Get("system-status")
  @RequireAiPermission(AI_PERMISSIONS.SYSTEM_STATUS_READ)
  systemStatus(
    @Headers("x-miraaj-request-id") requestId?: string,
    @Headers("x-miraaj-correlation-id") correlationId?: string,
  ) {
    const input: { requestId?: string; correlationId?: string } = {};
    if (requestId) {
      input.requestId = requestId;
    }
    if (correlationId) {
      input.correlationId = correlationId;
    }
    return this.aiService.getSystemStatus(input);
  }
}
