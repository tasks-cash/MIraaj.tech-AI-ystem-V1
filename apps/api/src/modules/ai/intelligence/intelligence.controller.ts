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
import { AdminAuthGuard } from "../guards/admin-auth.guard.js";
import { AiPermissionGuard } from "../guards/ai-permission.guard.js";
import { RequireAiPermission } from "../decorators/require-ai-permission.decorator.js";
import {
  IntelligenceJobService,
  type CreateIntelligenceJobInput,
} from "./intelligence-job.service.js";

@Controller("api/admin/ai/intelligence")
@UseGuards(AdminAuthGuard, AiPermissionGuard)
export class IntelligenceController {
  constructor(
    @Inject(IntelligenceJobService)
    private readonly intelligenceJobService: IntelligenceJobService,
  ) {}

  @Post("jobs")
  @RequireAiPermission(AI_PERMISSIONS.INTELLIGENCE_CREATE)
  createJob(@Body() body: CreateIntelligenceJobInput) {
    return this.intelligenceJobService.createJob(body);
  }

  @Get("jobs")
  @RequireAiPermission(AI_PERMISSIONS.INTELLIGENCE_READ)
  listJobs(
    @Query("analysisResultId") analysisResultId?: string,
    @Query("limit") limit?: string,
  ) {
    const params: { analysisResultId?: string; limit?: number } = {};
    if (analysisResultId) {
      params.analysisResultId = analysisResultId;
    }
    if (limit) {
      params.limit = Number(limit);
    }
    return this.intelligenceJobService.listJobs(params);
  }

  @Get("jobs/:jobId")
  @RequireAiPermission(AI_PERMISSIONS.INTELLIGENCE_READ)
  getJob(@Param("jobId") jobId: string) {
    return this.intelligenceJobService.getJob(jobId);
  }

  @Post("jobs/:jobId/retry")
  @RequireAiPermission(AI_PERMISSIONS.INTELLIGENCE_RETRY)
  retryJob(@Param("jobId") jobId: string) {
    return this.intelligenceJobService.retryJob(jobId);
  }

  @Post("jobs/:jobId/cancel")
  @RequireAiPermission(AI_PERMISSIONS.INTELLIGENCE_CANCEL)
  cancelJob(@Param("jobId") jobId: string) {
    return this.intelligenceJobService.cancelJob(jobId);
  }
}
