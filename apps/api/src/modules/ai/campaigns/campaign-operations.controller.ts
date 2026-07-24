import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { AI_PERMISSIONS } from "@miraaj/shared-config";
import { RequireAiPermission } from "../decorators/require-ai-permission.decorator.js";
import { AdminAuthGuard } from "../guards/admin-auth.guard.js";
import { AiPermissionGuard } from "../guards/ai-permission.guard.js";
import { CampaignOperationsService } from "./campaign-operations.service.js";

@Controller("api/admin/ai/campaigns")
@UseGuards(AdminAuthGuard, AiPermissionGuard)
export class CampaignOperationsController {
  constructor(@Inject(CampaignOperationsService) private readonly service: CampaignOperationsService) {}
  private actor(req: { adminUserId?: string }) { return req.adminUserId ?? "temporary-admin"; }
  @Post() @RequireAiPermission(AI_PERMISSIONS.CAMPAIGNS_CREATE)
  create(@Body() body: Record<string, unknown>, @Req() req: { adminUserId?: string }) { return this.service.importApproved(body, this.actor(req)); }
  @Get() @RequireAiPermission(AI_PERMISSIONS.CAMPAIGNS_READ)
  list(@Query() query: Record<string, unknown>) { return this.service.list(query); }
  @Get(":id") @RequireAiPermission(AI_PERMISSIONS.CAMPAIGNS_READ)
  get(@Param("id") id: string) { return this.service.get(id); }
  @Patch(":id") @RequireAiPermission(AI_PERMISSIONS.CAMPAIGNS_REVIEW)
  update(@Param("id") id: string, @Body() body: Record<string, unknown>, @Req() req: { adminUserId?: string }) { return this.service.update(id, body, this.actor(req)); }
  @Post(":id/revisions") @RequireAiPermission(AI_PERMISSIONS.CAMPAIGNS_REVIEW)
  revise(@Param("id") id: string, @Body() body: Record<string, unknown>, @Req() req: { adminUserId?: string }) { return this.service.revise(id, body, this.actor(req)); }
  @Post(":id/approve") @RequireAiPermission(AI_PERMISSIONS.CAMPAIGNS_APPROVE)
  approve(@Param("id") id: string, @Body() body: { reason?: string }, @Req() req: { adminUserId?: string }) { return this.service.transition(id, "approved", this.actor(req), body.reason ?? "approved"); }
  @Post(":id/pause") @RequireAiPermission(AI_PERMISSIONS.CAMPAIGNS_REVIEW)
  pause(@Param("id") id: string, @Body() body: { reason?: string }, @Req() req: { adminUserId?: string }) { return this.service.transition(id, "paused", this.actor(req), body.reason ?? ""); }
  @Post(":id/resume") @RequireAiPermission(AI_PERMISSIONS.CAMPAIGNS_REVIEW)
  resume(@Param("id") id: string, @Body() body: { reason?: string }, @Req() req: { adminUserId?: string }) { return this.service.transition(id, "active", this.actor(req), body.reason ?? ""); }
  @Post(":id/archive") @RequireAiPermission(AI_PERMISSIONS.CAMPAIGNS_REVIEW)
  archive(@Param("id") id: string, @Body() body: { reason?: string }, @Req() req: { adminUserId?: string }) { return this.service.transition(id, "archived", this.actor(req), body.reason ?? ""); }
}
