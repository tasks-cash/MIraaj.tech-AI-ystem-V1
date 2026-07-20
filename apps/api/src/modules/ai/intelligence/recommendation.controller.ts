import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { AI_PERMISSIONS } from "@miraaj/shared-config";
import type { IntelligenceReviewReasonCode } from "@miraaj/shared-types";
import { AdminAuthGuard } from "../guards/admin-auth.guard.js";
import { AiPermissionGuard } from "../guards/ai-permission.guard.js";
import { RequireAiPermission } from "../decorators/require-ai-permission.decorator.js";
import { RecommendationService } from "./recommendation.service.js";
import { IntelligenceReviewService } from "./intelligence-review.service.js";

@Controller("api/admin/ai/recommendations")
@UseGuards(AdminAuthGuard, AiPermissionGuard)
export class RecommendationController {
  constructor(
    @Inject(RecommendationService)
    private readonly recommendations: RecommendationService,
    @Inject(IntelligenceReviewService)
    private readonly reviewService: IntelligenceReviewService,
  ) {}

  @Get()
  @RequireAiPermission(AI_PERMISSIONS.RECOMMENDATIONS_READ)
  listRecommendations(
    @Query("jobId") jobId?: string,
    @Query("status") status?: string,
    @Query("limit") limit?: string,
  ) {
    const params: { jobId?: string; status?: string; limit?: number } = {};
    if (jobId) params.jobId = jobId;
    if (status) params.status = status;
    if (limit) params.limit = Number(limit);
    return this.recommendations.listSets(params);
  }

  @Get(":setId")
  @RequireAiPermission(AI_PERMISSIONS.RECOMMENDATIONS_READ)
  getRecommendation(@Param("setId") setId: string) {
    return this.recommendations.getSet(setId);
  }

  @Post(":setId/recompute")
  @RequireAiPermission(AI_PERMISSIONS.RECOMMENDATIONS_RECOMPUTE)
  async recompute(@Param("setId") setId: string) {
    const set = await this.recommendations.getSet(setId);
    if (!set.jobId) {
      throw new BadRequestException({
        code: "RECOMMENDATION_NOT_RETRYABLE",
        message: "Recommendation set has no associated job.",
      });
    }
    return this.recommendations.recompute(set.jobId);
  }

  @Post(":setId/review")
  @RequireAiPermission(AI_PERMISSIONS.RECOMMENDATIONS_REVIEW)
  reviewRecommendation(
    @Param("setId") setId: string,
    @Body()
    body: {
      notes?: string;
      reasonCodes?: IntelligenceReviewReasonCode[];
      correctedPayload?: Record<string, unknown>;
    },
  ) {
    return this.reviewService.reviewRecommendationSet(setId, body);
  }

  @Post(":setId/approve")
  @RequireAiPermission(AI_PERMISSIONS.RECOMMENDATIONS_APPROVE)
  approveRecommendation(
    @Param("setId") setId: string,
    @Body()
    body: {
      notes?: string;
      reasonCodes?: IntelligenceReviewReasonCode[];
      correctedPayload?: Record<string, unknown>;
    },
  ) {
    return this.reviewService.approveRecommendationSet(setId, body);
  }

  @Post(":setId/reject")
  @RequireAiPermission(AI_PERMISSIONS.RECOMMENDATIONS_REJECT)
  rejectRecommendation(
    @Param("setId") setId: string,
    @Body() body: { notes?: string; reasonCodes?: IntelligenceReviewReasonCode[] },
  ) {
    return this.reviewService.rejectRecommendationSet(setId, body);
  }
}
