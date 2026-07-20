import {
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
import { BusinessProfileService } from "./business-profile.service.js";
import { IntelligenceReviewService } from "./intelligence-review.service.js";

@Controller("api/admin/ai/business-profiles")
@UseGuards(AdminAuthGuard, AiPermissionGuard)
export class BusinessProfileController {
  constructor(
    @Inject(BusinessProfileService)
    private readonly businessProfileService: BusinessProfileService,
    @Inject(IntelligenceReviewService)
    private readonly reviewService: IntelligenceReviewService,
  ) {}

  @Get()
  @RequireAiPermission(AI_PERMISSIONS.BUSINESS_PROFILES_READ)
  listProfiles(
    @Query("status") status?: string,
    @Query("limit") limit?: string,
  ) {
    const params: { status?: string; limit?: number } = {};
    if (status) params.status = status;
    if (limit) params.limit = Number(limit);
    return this.businessProfileService.listProfiles(params);
  }

  @Get(":profileId")
  @RequireAiPermission(AI_PERMISSIONS.BUSINESS_PROFILES_READ)
  getProfile(@Param("profileId") profileId: string) {
    return this.businessProfileService.getProfile(profileId);
  }

  @Post(":profileId/review")
  @RequireAiPermission(AI_PERMISSIONS.BUSINESS_PROFILES_REVIEW)
  reviewProfile(
    @Param("profileId") profileId: string,
    @Body() body: { notes?: string; reasonCodes?: IntelligenceReviewReasonCode[] },
  ) {
    return this.reviewService.reviewProfile(profileId, body);
  }

  @Post(":profileId/approve")
  @RequireAiPermission(AI_PERMISSIONS.BUSINESS_PROFILES_APPROVE)
  approveProfile(
    @Param("profileId") profileId: string,
    @Body()
    body: {
      notes?: string;
      reasonCodes?: IntelligenceReviewReasonCode[];
      correctedPayload?: Record<string, unknown>;
    },
  ) {
    return this.reviewService.approveProfile(profileId, body);
  }

  @Post(":profileId/reject")
  @RequireAiPermission(AI_PERMISSIONS.BUSINESS_PROFILES_REJECT)
  rejectProfile(
    @Param("profileId") profileId: string,
    @Body() body: { notes?: string; reasonCodes?: IntelligenceReviewReasonCode[] },
  ) {
    return this.reviewService.rejectProfile(profileId, body);
  }
}
