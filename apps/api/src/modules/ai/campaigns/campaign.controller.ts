import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AI_PERMISSIONS } from "@miraaj/shared-config";
import type { CampaignReviewStatus } from "@miraaj/shared-types";
import { AdminAuthGuard } from "../guards/admin-auth.guard.js";
import { AiPermissionGuard } from "../guards/ai-permission.guard.js";
import { RequireAiPermission } from "../decorators/require-ai-permission.decorator.js";
import {
  CampaignJobService,
  type CreateCampaignJobInput,
} from "./campaign-job.service.js";
import { CampaignReviewService } from "./campaign-review.service.js";
import { CampaignBriefModel } from "../models/campaign.schema.js";
import {
  BrandProfileModel,
  CampaignPolicyModel,
  CompliancePolicyModel,
  PlatformPolicyModel,
} from "../models/campaign-policy.schema.js";

@Controller("api/admin/ai")
@UseGuards(AdminAuthGuard, AiPermissionGuard)
export class CampaignController {
  constructor(
    @Inject(CampaignJobService)
    private readonly campaignJobService: CampaignJobService,
    @Inject(CampaignReviewService)
    private readonly campaignReviewService: CampaignReviewService,
  ) {}

  @Post("campaigns/jobs")
  @RequireAiPermission(AI_PERMISSIONS.CAMPAIGNS_CREATE)
  createJob(
    @Body() body: Omit<CreateCampaignJobInput, "requestedBy">,
    @Req() request: { adminUserId?: string },
  ) {
    return this.campaignJobService.createJob({
      ...body,
      requestedBy: request.adminUserId ?? "temporary-admin",
    });
  }

  @Get("campaigns/jobs")
  @RequireAiPermission(AI_PERMISSIONS.CAMPAIGNS_READ)
  listJobs(
    @Query("status") status?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.campaignJobService.listJobs({
      status,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get("campaigns/jobs/:campaignJobId")
  @RequireAiPermission(AI_PERMISSIONS.CAMPAIGNS_READ)
  getJob(@Param("campaignJobId") campaignJobId: string) {
    return this.campaignJobService.getJob(campaignJobId);
  }

  @Post("campaigns/jobs/:campaignJobId/retry")
  @RequireAiPermission(AI_PERMISSIONS.CAMPAIGNS_RETRY)
  retryJob(@Param("campaignJobId") campaignJobId: string) {
    return this.campaignJobService.retryJob(campaignJobId);
  }

  @Post("campaigns/jobs/:campaignJobId/cancel")
  @RequireAiPermission(AI_PERMISSIONS.CAMPAIGNS_CANCEL)
  cancelJob(@Param("campaignJobId") campaignJobId: string) {
    return this.campaignJobService.cancelJob(campaignJobId);
  }

  @Get("campaigns/briefs")
  @RequireAiPermission(AI_PERMISSIONS.CAMPAIGN_BRIEFS_READ)
  async listBriefs(
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    const take = Math.min(Number(limit ?? 25), 100);
    const skip = Number(offset ?? 0);
    const [items, total] = await Promise.all([
      CampaignBriefModel.find().sort({ createdAt: -1 }).skip(skip).limit(take).lean(),
      CampaignBriefModel.countDocuments(),
    ]);
    return { items, total, limit: take, offset: skip };
  }

  @Get("campaigns/briefs/:campaignBriefId")
  @RequireAiPermission(AI_PERMISSIONS.CAMPAIGN_BRIEFS_READ)
  async getBrief(@Param("campaignBriefId") campaignBriefId: string) {
    return CampaignBriefModel.findOne({ campaignBriefId }).lean();
  }

  @Patch("campaigns/briefs/:campaignBriefId")
  @RequireAiPermission(AI_PERMISSIONS.CAMPAIGN_BRIEFS_UPDATE)
  async patchBrief(
    @Param("campaignBriefId") campaignBriefId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const allowed = [
      "name",
      "campaignGoal",
      "desiredAction",
      "offerDetails",
      "destinationType",
      "destinationReference",
    ];
    const update: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) update[key] = body[key];
    }
    return CampaignBriefModel.findOneAndUpdate(
      { campaignBriefId },
      { $set: update },
      { new: true },
    ).lean();
  }

  @Get("campaigns/packages")
  @RequireAiPermission(AI_PERMISSIONS.CAMPAIGNS_READ)
  listPackages(
    @Query("status") status?: string,
    @Query("language") language?: string,
    @Query("platform") platform?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.campaignReviewService.listPackages({
      status,
      language,
      platform,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get("campaigns/packages/:campaignPackageId")
  @RequireAiPermission(AI_PERMISSIONS.CAMPAIGNS_READ)
  getPackage(@Param("campaignPackageId") campaignPackageId: string) {
    return this.campaignReviewService.getPackage(campaignPackageId);
  }

  @Get("campaigns/packages/:campaignPackageId/platform-variants")
  @RequireAiPermission(AI_PERMISSIONS.CAMPAIGNS_READ)
  async platformVariants(@Param("campaignPackageId") campaignPackageId: string) {
    const pkg = await this.campaignReviewService.getPackage(campaignPackageId);
    return { items: pkg.platformVariants ?? [] };
  }

  @Get("campaigns/packages/:campaignPackageId/language-variants")
  @RequireAiPermission(AI_PERMISSIONS.CAMPAIGNS_READ)
  async languageVariants(@Param("campaignPackageId") campaignPackageId: string) {
    const pkg = await this.campaignReviewService.getPackage(campaignPackageId);
    return { items: pkg.languageVariants ?? [] };
  }

  @Post("campaigns/packages/:campaignPackageId/review")
  @RequireAiPermission(AI_PERMISSIONS.CAMPAIGNS_REVIEW)
  review(
    @Param("campaignPackageId") campaignPackageId: string,
    @Body()
    body: {
      status: CampaignReviewStatus;
      notes?: string;
      corrections?: Record<string, unknown>;
      regenerationInstructions?: string;
    },
    @Req() request: { adminUserId?: string },
  ) {
    return this.campaignReviewService.review({
      campaignPackageId,
      reviewerId: request.adminUserId ?? "temporary-admin",
      status: body.status,
      notes: body.notes,
      corrections: body.corrections,
      regenerationInstructions: body.regenerationInstructions,
    });
  }

  @Post("campaigns/packages/:campaignPackageId/approve")
  @RequireAiPermission(AI_PERMISSIONS.CAMPAIGNS_APPROVE)
  approve(
    @Param("campaignPackageId") campaignPackageId: string,
    @Req() request: { adminUserId?: string },
  ) {
    return this.campaignReviewService.review({
      campaignPackageId,
      reviewerId: request.adminUserId ?? "temporary-admin",
      status: "approved",
    });
  }

  @Post("campaigns/packages/:campaignPackageId/reject")
  @RequireAiPermission(AI_PERMISSIONS.CAMPAIGNS_REJECT)
  reject(
    @Param("campaignPackageId") campaignPackageId: string,
    @Body() body: { notes?: string },
    @Req() request: { adminUserId?: string },
  ) {
    return this.campaignReviewService.review({
      campaignPackageId,
      reviewerId: request.adminUserId ?? "temporary-admin",
      status: "rejected",
      notes: body.notes,
    });
  }

  @Post("campaigns/packages/:campaignPackageId/regenerate")
  @RequireAiPermission(AI_PERMISSIONS.CAMPAIGNS_REGENERATE)
  regenerate(
    @Param("campaignPackageId") campaignPackageId: string,
    @Req() request: { adminUserId?: string },
  ) {
    return this.campaignReviewService.review({
      campaignPackageId,
      reviewerId: request.adminUserId ?? "temporary-admin",
      status: "needs_regeneration",
    });
  }

  @Get("brand-profiles")
  @RequireAiPermission(AI_PERMISSIONS.BRAND_PROFILES_READ)
  listBrandProfiles() {
    return BrandProfileModel.find().sort({ version: -1 }).lean();
  }

  @Get("brand-profiles/:brandProfileId")
  @RequireAiPermission(AI_PERMISSIONS.BRAND_PROFILES_READ)
  getBrandProfile(@Param("brandProfileId") brandProfileId: string) {
    return BrandProfileModel.find({ brandProfileId }).sort({ version: -1 }).lean();
  }

  @Get("campaign-policies")
  @RequireAiPermission(AI_PERMISSIONS.CAMPAIGN_POLICIES_READ)
  campaignPolicies() {
    return CampaignPolicyModel.find().sort({ version: -1 }).lean();
  }

  @Get("platform-policies")
  @RequireAiPermission(AI_PERMISSIONS.PLATFORM_POLICIES_READ)
  platformPolicies() {
    return PlatformPolicyModel.find().sort({ version: -1 }).lean();
  }

  @Get("compliance-policies")
  @RequireAiPermission(AI_PERMISSIONS.COMPLIANCE_POLICIES_READ)
  compliancePolicies() {
    return CompliancePolicyModel.find().sort({ version: -1 }).lean();
  }
}
