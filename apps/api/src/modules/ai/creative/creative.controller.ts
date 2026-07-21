import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AI_PERMISSIONS } from "@miraaj/shared-config";
import type { CreativeReviewStatus } from "@miraaj/shared-types";
import { AdminAuthGuard } from "../guards/admin-auth.guard.js";
import { AiPermissionGuard } from "../guards/ai-permission.guard.js";
import { RequireAiPermission } from "../decorators/require-ai-permission.decorator.js";
import {
  CreativeJobService,
  type CreateCreativeJobInput,
} from "./creative-job.service.js";
import { CreativeReviewService } from "./creative-review.service.js";
import { CreativeSeedService } from "./creative-seed.service.js";
import { CreativeQueueService } from "../queue/creative-queue.service.js";
import {
  AssetRightsRecordModel,
  CreativeModelPolicyModel,
  CreativeProviderCapabilityModel,
  CreativeRenderSpecificationModel,
} from "../models/creative.schema.js";

@Controller("api/admin/ai/creative")
@UseGuards(AdminAuthGuard, AiPermissionGuard)
export class CreativeController {
  constructor(
    @Inject(CreativeJobService)
    private readonly creativeJobService: CreativeJobService,
    @Inject(CreativeReviewService)
    private readonly creativeReviewService: CreativeReviewService,
    @Inject(CreativeSeedService)
    private readonly creativeSeedService: CreativeSeedService,
    @Inject(CreativeQueueService)
    private readonly creativeQueueService: CreativeQueueService,
  ) {}

  @Post("jobs")
  @RequireAiPermission(AI_PERMISSIONS.CREATIVE_JOBS_CREATE)
  createJob(
    @Body() body: Omit<CreateCreativeJobInput, "requestedBy">,
    @Req() request: { adminUserId?: string },
  ) {
    return this.creativeJobService.createJob({
      ...body,
      requestedBy: request.adminUserId ?? "temporary-admin",
    });
  }

  @Get("jobs")
  @RequireAiPermission(AI_PERMISSIONS.CREATIVE_JOBS_READ)
  listJobs(
    @Query("status") status?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.creativeJobService.listJobs({
      status,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get("jobs/:creativeJobId")
  @RequireAiPermission(AI_PERMISSIONS.CREATIVE_JOBS_READ)
  getJob(@Param("creativeJobId") creativeJobId: string) {
    return this.creativeJobService.getJob(creativeJobId);
  }

  @Post("jobs/:creativeJobId/retry")
  @RequireAiPermission(AI_PERMISSIONS.CREATIVE_JOBS_RETRY)
  retryJob(@Param("creativeJobId") creativeJobId: string) {
    return this.creativeJobService.retryJob(creativeJobId);
  }

  @Post("jobs/:creativeJobId/cancel")
  @RequireAiPermission(AI_PERMISSIONS.CREATIVE_JOBS_CANCEL)
  cancelJob(@Param("creativeJobId") creativeJobId: string) {
    return this.creativeJobService.cancelJob(creativeJobId);
  }

  @Get("assets")
  @RequireAiPermission(AI_PERMISSIONS.CREATIVE_ASSETS_READ)
  listAssets(
    @Query("status") status?: string,
    @Query("campaignPackageId") campaignPackageId?: string,
    @Query("requiresReview") requiresReview?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.creativeReviewService.listAssets({
      status,
      campaignPackageId,
      requiresReview,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get("assets/:assetId")
  @RequireAiPermission(AI_PERMISSIONS.CREATIVE_ASSETS_READ)
  getAsset(@Param("assetId") assetId: string) {
    return this.creativeReviewService.getAsset(assetId);
  }

  @Post("assets/:assetId/review")
  @RequireAiPermission(AI_PERMISSIONS.CREATIVE_ASSETS_REVIEW)
  review(
    @Param("assetId") assetId: string,
    @Body()
    body: {
      status: CreativeReviewStatus;
      notes?: string;
      corrections?: Record<string, unknown>;
      regenerationInstructions?: string;
    },
    @Req() request: { adminUserId?: string },
  ) {
    return this.creativeReviewService.review({
      assetId,
      reviewerId: request.adminUserId ?? "temporary-admin",
      status: body.status,
      notes: body.notes,
      corrections: body.corrections,
      regenerationInstructions: body.regenerationInstructions,
    });
  }

  @Post("assets/:assetId/approve")
  @RequireAiPermission(AI_PERMISSIONS.CREATIVE_ASSETS_APPROVE)
  approve(
    @Param("assetId") assetId: string,
    @Req() request: { adminUserId?: string },
  ) {
    return this.creativeReviewService.review({
      assetId,
      reviewerId: request.adminUserId ?? "temporary-admin",
      status: "approved",
    });
  }

  @Post("assets/:assetId/reject")
  @RequireAiPermission(AI_PERMISSIONS.CREATIVE_ASSETS_REJECT)
  reject(
    @Param("assetId") assetId: string,
    @Body() body: { notes?: string },
    @Req() request: { adminUserId?: string },
  ) {
    return this.creativeReviewService.review({
      assetId,
      reviewerId: request.adminUserId ?? "temporary-admin",
      status: "rejected",
      notes: body.notes,
    });
  }

  @Post("assets/:assetId/regenerate")
  @RequireAiPermission(AI_PERMISSIONS.CREATIVE_ASSETS_REGENERATE)
  regenerate(
    @Param("assetId") assetId: string,
    @Body() body: { regenerationInstructions?: string },
    @Req() request: { adminUserId?: string },
  ) {
    return this.creativeReviewService.regenerateAsset({
      assetId,
      reviewerId: request.adminUserId ?? "temporary-admin",
      ...(body?.regenerationInstructions
        ? { regenerationInstructions: body.regenerationInstructions }
        : {}),
    });
  }

  @Get("rights/:rightsRecordId")
  @RequireAiPermission(AI_PERMISSIONS.CREATIVE_RIGHTS_READ)
  async getRights(@Param("rightsRecordId") rightsRecordId: string) {
    return AssetRightsRecordModel.findOne({ rightsRecordId }).lean();
  }

  @Get("providers")
  @RequireAiPermission(AI_PERMISSIONS.CREATIVE_PROVIDERS_READ)
  async listProviders() {
    const [capabilities, policy, queueStats] = await Promise.all([
      CreativeProviderCapabilityModel.find().lean(),
      CreativeModelPolicyModel.findOne({ status: "active" }).lean(),
      this.creativeQueueService.getQueueStats(),
    ]);
    return { capabilities, policy, queueStats };
  }

  @Get("render-specifications")
  @RequireAiPermission(AI_PERMISSIONS.RENDER_SPECIFICATIONS_READ)
  async listRenderSpecs(
    @Query("platform") platform?: string,
    @Query("status") status?: string,
  ) {
    const filter: Record<string, unknown> = {};
    if (platform) filter.platform = platform;
    if (status) filter.status = status;
    const items = await CreativeRenderSpecificationModel.find(filter)
      .sort({ platform: 1, aspectRatio: 1 })
      .lean();
    return { items };
  }

  @Post("seed/reconcile")
  @RequireAiPermission(AI_PERMISSIONS.CREATIVE_PROVIDERS_MANAGE)
  reconcileSeed() {
    return this.creativeSeedService.seedAll();
  }
}
