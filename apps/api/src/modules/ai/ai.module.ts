import { Module } from "@nestjs/common";
import { AiController } from "./ai.controller.js";
import { AiHealthService } from "./ai-health.service.js";
import { AiInternalClientService } from "./ai-internal-client.service.js";
import { AiService } from "./ai.service.js";
import { AiSystemStatusPermissionGuard } from "./guards/ai-system-status-permission.guard.js";
import { AiSystemStatusRateLimitGuard } from "./guards/ai-system-status-rate-limit.guard.js";
import { AdminAuthGuard } from "./guards/admin-auth.guard.js";

@Module({
  controllers: [AiController],
  providers: [
    AiService,
    AiHealthService,
    AiInternalClientService,
    AiSystemStatusPermissionGuard,
    AiSystemStatusRateLimitGuard,
    AdminAuthGuard,
  ],
  exports: [AiService, AiHealthService, AiInternalClientService],
})
export class AiModule {}
