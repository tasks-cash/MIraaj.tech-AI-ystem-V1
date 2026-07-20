import { Module } from "@nestjs/common";
import { AiController } from "./ai.controller.js";
import { AiHealthService } from "./ai-health.service.js";
import { AiInternalClientService } from "./ai-internal-client.service.js";
import { AiService } from "./ai.service.js";
import { AnalysisController } from "./analysis/analysis.controller.js";
import { AnalysisJobService } from "./analysis/analysis-job.service.js";
import { PromptSeedService } from "./analysis/prompt-seed.service.js";
import { ReviewService } from "./analysis/review.service.js";
import { AiPermissionGuard } from "./guards/ai-permission.guard.js";
import { AiSystemStatusRateLimitGuard } from "./guards/ai-system-status-rate-limit.guard.js";
import { AdminAuthGuard } from "./guards/admin-auth.guard.js";
import { MediaController } from "./media/media.controller.js";
import { MediaService } from "./media/media.service.js";
import { UploadSessionController } from "./media/upload-session.controller.js";
import { UploadSessionService } from "./media/upload-session.service.js";
import { MediaQueueModule } from "./queue/media-queue.module.js";
import { MediaWorkerService } from "./queue/media-worker.service.js";
import { StaleJobService } from "./queue/stale-job.service.js";

@Module({
  imports: [MediaQueueModule],
  controllers: [
    AiController,
    UploadSessionController,
    MediaController,
    AnalysisController,
  ],
  providers: [
    AiService,
    AiHealthService,
    AiInternalClientService,
    AiPermissionGuard,
    AiSystemStatusRateLimitGuard,
    AdminAuthGuard,
    UploadSessionService,
    MediaService,
    AnalysisJobService,
    ReviewService,
    PromptSeedService,
    MediaWorkerService,
    StaleJobService,
  ],
  exports: [AiService, AiHealthService, AiInternalClientService, MediaQueueModule],
})
export class AiModule {}
