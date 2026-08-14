import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { CampaignTaskParticipantAuthGuard } from "../guards/campaign-task-participant-auth.guard.js";
import type { CampaignTaskParticipantRequest } from "../types/campaign-task-participant-request.js";
import { NotificationService } from "./notification.service.js";

function context(request: CampaignTaskParticipantRequest) {
  if (!request.participantContext) throw new Error("Participant context is missing");
  return request.participantContext;
}

@Controller("api/ai/notifications")
@UseGuards(CampaignTaskParticipantAuthGuard)
export class NotificationController {
  constructor(@Inject(NotificationService) private readonly service: NotificationService) {}
  @Get() list(@Req() request: CampaignTaskParticipantRequest, @Query() query: Record<string, unknown>) { const ctx = context(request); return this.service.list(ctx.tenantId, ctx.participantId, query); }
  @Get("unread-count") count(@Req() request: CampaignTaskParticipantRequest) { const ctx = context(request); return this.service.unreadCount(ctx.tenantId, ctx.participantId); }
  @Patch(":id/read") read(@Param("id") id: string, @Req() request: CampaignTaskParticipantRequest) { const ctx = context(request); return this.service.markRead(id, ctx.tenantId, ctx.participantId); }
  @Post("mark-all-read") all(@Req() request: CampaignTaskParticipantRequest) { const ctx = context(request); return this.service.markAllRead(ctx.tenantId, ctx.participantId); }
  @Get("preferences") preferences(@Req() request: CampaignTaskParticipantRequest) { const ctx = context(request); return this.service.preferences(ctx.tenantId, ctx.participantId, "participant"); }
  @Patch("preferences") update(@Req() request: CampaignTaskParticipantRequest, @Body() body: unknown) { const ctx = context(request); return this.service.updatePreferences(ctx.tenantId, ctx.participantId, "participant", body); }
}
