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
import type { ReviewReasonCode } from "@miraaj/shared-types";
import { AdminAuthGuard } from "../guards/admin-auth.guard.js";
import { AiPermissionGuard } from "../guards/ai-permission.guard.js";
import { RequireAiPermission } from "../decorators/require-ai-permission.decorator.js";
import {
  AnalysisJobService,
  type CreateAnalysisJobInput,
} from "./analysis-job.service.js";
import { ReviewService } from "./review.service.js";

@Controller("api/admin/ai/analysis")
@UseGuards(AdminAuthGuard, AiPermissionGuard)
export class AnalysisController {
  constructor(
    @Inject(AnalysisJobService)
    private readonly analysisJobService: AnalysisJobService,
    @Inject(ReviewService)
    private readonly reviewService: ReviewService,
  ) {}

  @Post("jobs")
  @RequireAiPermission(AI_PERMISSIONS.ANALYSIS_CREATE)
  createJob(@Body() body: CreateAnalysisJobInput) {
    return this.analysisJobService.createJob(body);
  }

  @Get("jobs")
  @RequireAiPermission(AI_PERMISSIONS.ANALYSIS_READ)
    listJobs(
    @Query("mediaId") mediaId?: string,
    @Query("limit") limit?: string,
  ) {
    const params: { mediaId?: string; limit?: number } = {};
    if (mediaId) {
      params.mediaId = mediaId;
    }
    if (limit) {
      params.limit = Number(limit);
    }
    return this.analysisJobService.listJobs(params);
  }

  @Get("jobs/:jobId")
  @RequireAiPermission(AI_PERMISSIONS.ANALYSIS_READ)
  getJob(@Param("jobId") jobId: string) {
    return this.analysisJobService.getJob(jobId);
  }

  @Get("results/:resultId")
  @RequireAiPermission(AI_PERMISSIONS.ANALYSIS_READ)
  getResult(@Param("resultId") resultId: string) {
    return this.analysisJobService.getResult(resultId);
  }

  @Post("jobs/:jobId/retry")
  @RequireAiPermission(AI_PERMISSIONS.ANALYSIS_RETRY)
  retryJob(@Param("jobId") jobId: string) {
    return this.analysisJobService.retryJob(jobId);
  }

  @Post("jobs/:jobId/cancel")
  @RequireAiPermission(AI_PERMISSIONS.ANALYSIS_CANCEL)
  cancelJob(@Param("jobId") jobId: string) {
    return this.analysisJobService.cancelJob(jobId);
  }

  @Post("results/:resultId/review")
  @RequireAiPermission(AI_PERMISSIONS.ANALYSIS_REVIEW)
  reviewResult(
    @Param("resultId") resultId: string,
    @Body() body: { notes?: string; reasonCodes?: ReviewReasonCode[] },
  ) {
    return this.reviewService.submitReview(resultId, body);
  }

  @Post("results/:resultId/approve")
  @RequireAiPermission(AI_PERMISSIONS.ANALYSIS_APPROVE)
  approveResult(
    @Param("resultId") resultId: string,
    @Body()
    body: {
      notes?: string;
      reasonCodes?: ReviewReasonCode[];
      correctedOutput?: Record<string, unknown>;
    },
  ) {
    return this.reviewService.approveResult(resultId, body);
  }

  @Post("results/:resultId/reject")
  @RequireAiPermission(AI_PERMISSIONS.ANALYSIS_REJECT)
  rejectResult(
    @Param("resultId") resultId: string,
    @Body() body: { notes?: string; reasonCodes?: ReviewReasonCode[] },
  ) {
    return this.reviewService.rejectResult(resultId, body);
  }
}
