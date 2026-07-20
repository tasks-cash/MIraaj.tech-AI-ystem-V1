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
import { CatalogSeedService } from "./catalog/catalog-seed.service.js";
import { CatalogService } from "./catalog/catalog.service.js";
import { CatalogController } from "./catalog/catalog.controller.js";
import { MatchingEngineService } from "./matching/matching-engine.service.js";
import { PhasePlannerService } from "./matching/phase-planner.service.js";
import { BundleBuilderService } from "./matching/bundle-builder.service.js";
import { BusinessProfileService } from "./intelligence/business-profile.service.js";
import { IntelligenceJobService } from "./intelligence/intelligence-job.service.js";
import { RecommendationService } from "./intelligence/recommendation.service.js";
import { IntelligenceReviewService } from "./intelligence/intelligence-review.service.js";
import { IntelligencePromptSeedService } from "./intelligence/intelligence-prompt-seed.service.js";
import { IntelligenceController } from "./intelligence/intelligence.controller.js";
import { BusinessProfileController } from "./intelligence/business-profile.controller.js";
import { RecommendationController } from "./intelligence/recommendation.controller.js";
import { IntelligenceQueueModule } from "./queue/intelligence-queue.module.js";
import { IntelligenceWorkerService } from "./queue/intelligence-worker.service.js";
import { CampaignQueueModule } from "./queue/campaign-queue.module.js";
import { CampaignWorkerService } from "./campaigns/campaign-worker.service.js";
import { CampaignSeedService } from "./campaigns/campaign-seed.service.js";
import { CampaignPromptSeedService } from "./campaigns/campaign-prompt-seed.service.js";
import { CampaignSourceEligibilityService } from "./campaigns/campaign-source-eligibility.service.js";
import { CampaignValidationService } from "./campaigns/campaign-validation.service.js";
import { CampaignQualityService } from "./campaigns/campaign-quality.service.js";
import { CampaignJobService } from "./campaigns/campaign-job.service.js";
import { CampaignReviewService } from "./campaigns/campaign-review.service.js";
import { BrandProfileService } from "./campaigns/brand-profile.service.js";
import { CampaignPolicyService } from "./campaigns/campaign-policy.service.js";
import { CampaignController } from "./campaigns/campaign.controller.js";
import { AuditEventService } from "./audit/audit-event.service.js";
import { AuditEventsController } from "./audit/audit-events.controller.js";

@Module({
  imports: [MediaQueueModule, IntelligenceQueueModule, CampaignQueueModule],
  controllers: [
    AiController,
    UploadSessionController,
    MediaController,
    AnalysisController,
    CatalogController,
    IntelligenceController,
    BusinessProfileController,
    RecommendationController,
    CampaignController,
    AuditEventsController,
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
    CatalogSeedService,
    CatalogService,
    MatchingEngineService,
    PhasePlannerService,
    BundleBuilderService,
    BusinessProfileService,
    IntelligenceJobService,
    RecommendationService,
    IntelligenceReviewService,
    IntelligencePromptSeedService,
    IntelligenceWorkerService,
    CampaignSeedService,
    CampaignPromptSeedService,
    CampaignSourceEligibilityService,
    CampaignValidationService,
    CampaignQualityService,
    CampaignJobService,
    CampaignReviewService,
    CampaignWorkerService,
    BrandProfileService,
    CampaignPolicyService,
    AuditEventService,
  ],
  exports: [
    AiService,
    AiHealthService,
    AiInternalClientService,
    MediaQueueModule,
    IntelligenceQueueModule,
    CampaignQueueModule,
    CatalogService,
  ],
})
export class AiModule {}
