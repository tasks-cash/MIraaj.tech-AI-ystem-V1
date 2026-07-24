import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AI_PERMISSIONS } from "@miraaj/shared-config";
import { RequireAiPermission } from "../decorators/require-ai-permission.decorator.js";
import { AdminAuthGuard } from "../guards/admin-auth.guard.js";
import { AiPermissionGuard } from "../guards/ai-permission.guard.js";
import { DistributionService } from "../distribution/distribution.service.js";
import { CampaignTaskService } from "./campaign-task.service.js";

interface RequestHeaders {
  "x-tenant-id"?: string;
  "x-participant-id"?: string;
  "idempotency-key"?: string;
  "if-match"?: string;
}

const required = (value: string | undefined, code: string): string => {
  const clean = value?.trim();
  if (!clean) throw new BadRequestException(code);
  return clean;
};
const revision = (value: string | undefined) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new BadRequestException("CAMPAIGN_TASK_IF_MATCH_REQUIRED");
  return parsed;
};

@Controller("api/admin/ai/campaign-tasks")
@UseGuards(AdminAuthGuard, AiPermissionGuard)
export class CampaignTaskAdminController {
  constructor(@Inject(CampaignTaskService) private readonly service: CampaignTaskService) {}
  private actor(req: { adminUserId?: string }) { return req.adminUserId ?? "temporary-admin"; }
  private tenant(headers: RequestHeaders) { return required(headers["x-tenant-id"], "TENANT_ID_REQUIRED"); }

  @Post() @RequireAiPermission(AI_PERMISSIONS.CAMPAIGN_TASKS_CREATE)
  create(@Body() body: unknown, @Headers() headers: RequestHeaders, @Req() req: { adminUserId?: string }) {
    return this.service.create(body, this.tenant(headers), this.actor(req));
  }
  @Get() @RequireAiPermission(AI_PERMISSIONS.CAMPAIGN_TASKS_READ)
  list(@Query() query: Record<string, unknown>, @Headers() headers: RequestHeaders) {
    return this.service.list(this.tenant(headers), query);
  }
  @Get(":id") @RequireAiPermission(AI_PERMISSIONS.CAMPAIGN_TASKS_READ)
  get(@Param("id") id: string, @Headers() headers: RequestHeaders) {
    return this.service.get(id, this.tenant(headers), true);
  }
  @Patch(":id") @RequireAiPermission(AI_PERMISSIONS.CAMPAIGN_TASKS_UPDATE)
  update(@Param("id") id: string, @Body() body: unknown, @Headers() headers: RequestHeaders, @Req() req: { adminUserId?: string }) {
    return this.service.update(id, body, this.tenant(headers), this.actor(req), revision(headers["if-match"]));
  }

  @Post(":id/submit-review") @RequireAiPermission(AI_PERMISSIONS.CAMPAIGN_TASKS_UPDATE)
  submit(@Param("id") id: string, @Body() body: { reason?: string }, @Headers() headers: RequestHeaders, @Req() req: { adminUserId?: string }) {
    return this.transition(id, "awaiting_review", body, headers, req);
  }
  @Post(":id/approve") @RequireAiPermission(AI_PERMISSIONS.CAMPAIGN_TASKS_APPROVE)
  approve(@Param("id") id: string, @Body() body: { reason?: string }, @Headers() headers: RequestHeaders, @Req() req: { adminUserId?: string }) {
    return this.transition(id, "approved", body, headers, req);
  }
  @Post(":id/schedule") @RequireAiPermission(AI_PERMISSIONS.CAMPAIGN_TASKS_ACTIVATE)
  schedule(@Param("id") id: string, @Body() body: { reason?: string }, @Headers() headers: RequestHeaders, @Req() req: { adminUserId?: string }) {
    return this.transition(id, "scheduled", body, headers, req);
  }
  @Post(":id/activate") @RequireAiPermission(AI_PERMISSIONS.CAMPAIGN_TASKS_ACTIVATE)
  activate(@Param("id") id: string, @Body() body: { reason?: string }, @Headers() headers: RequestHeaders, @Req() req: { adminUserId?: string }) {
    return this.transition(id, "active", body, headers, req);
  }
  @Post(":id/pause") @RequireAiPermission(AI_PERMISSIONS.CAMPAIGN_TASKS_PAUSE)
  pause(@Param("id") id: string, @Body() body: { reason?: string }, @Headers() headers: RequestHeaders, @Req() req: { adminUserId?: string }) {
    return this.transition(id, "paused", body, headers, req);
  }
  @Post(":id/resume") @RequireAiPermission(AI_PERMISSIONS.CAMPAIGN_TASKS_ACTIVATE)
  resume(@Param("id") id: string, @Body() body: { reason?: string }, @Headers() headers: RequestHeaders, @Req() req: { adminUserId?: string }) {
    return this.transition(id, "active", body, headers, req);
  }
  @Post(":id/complete") @RequireAiPermission(AI_PERMISSIONS.CAMPAIGN_TASKS_UPDATE)
  complete(@Param("id") id: string, @Body() body: { reason?: string }, @Headers() headers: RequestHeaders, @Req() req: { adminUserId?: string }) {
    return this.transition(id, "completed", body, headers, req);
  }
  @Post(":id/cancel") @RequireAiPermission(AI_PERMISSIONS.CAMPAIGN_TASKS_CANCEL)
  cancel(@Param("id") id: string, @Body() body: { reason?: string }, @Headers() headers: RequestHeaders, @Req() req: { adminUserId?: string }) {
    return this.transition(id, "cancelled", body, headers, req);
  }
  @Post(":id/archive") @RequireAiPermission(AI_PERMISSIONS.CAMPAIGN_TASKS_ARCHIVE)
  archive(@Param("id") id: string, @Body() body: { reason?: string }, @Headers() headers: RequestHeaders, @Req() req: { adminUserId?: string }) {
    return this.transition(id, "archived", body, headers, req);
  }
  private transition(id: string, target: string, body: { reason?: string }, headers: RequestHeaders, req: { adminUserId?: string }) {
    return this.service.transition(id, target, this.tenant(headers), this.actor(req), body.reason ?? "", revision(headers["if-match"]));
  }

  @Post(":id/invitations") @RequireAiPermission(AI_PERMISSIONS.CAMPAIGN_TASKS_INVITE)
  invite(@Param("id") id: string, @Body() body: unknown, @Headers() headers: RequestHeaders, @Req() req: { adminUserId?: string }) {
    return this.service.createInvitations(id, body, this.tenant(headers), this.actor(req));
  }
  @Get(":id/invitations") @RequireAiPermission(AI_PERMISSIONS.CAMPAIGN_TASKS_READ)
  invitations(@Param("id") id: string, @Headers() headers: RequestHeaders) {
    return this.service.listInvitations(id, this.tenant(headers));
  }
  @Post(":id/invitations/:invitationId/cancel") @RequireAiPermission(AI_PERMISSIONS.CAMPAIGN_TASKS_INVITE)
  cancelInvite(@Param("id") id: string, @Param("invitationId") invitationId: string, @Headers() headers: RequestHeaders, @Req() req: { adminUserId?: string }) {
    return this.service.cancelInvitation(id, invitationId, this.tenant(headers), this.actor(req));
  }
  @Post("participants") @RequireAiPermission(AI_PERMISSIONS.CAMPAIGN_TASKS_ASSIGN)
  participant(@Body() body: unknown, @Headers() headers: RequestHeaders, @Req() req: { adminUserId?: string }) {
    return this.service.upsertParticipant(body, this.tenant(headers), this.actor(req));
  }
  @Post(":id/manual-assignments") @RequireAiPermission(AI_PERMISSIONS.CAMPAIGN_TASKS_ASSIGN)
  manual(@Param("id") id: string, @Body() body: { participantId?: string }, @Headers() headers: RequestHeaders, @Req() req: { adminUserId?: string }) {
    return this.service.manualAssignment(id, this.tenant(headers), required(body.participantId, "PARTICIPANT_ID_REQUIRED"), required(headers["idempotency-key"], "IDEMPOTENCY_KEY_REQUIRED"), this.actor(req));
  }
  @Get(":id/assignments") @RequireAiPermission(AI_PERMISSIONS.CAMPAIGN_TASKS_READ)
  assignments(@Param("id") id: string, @Headers() headers: RequestHeaders) {
    return this.service.assignments(id, this.tenant(headers));
  }
  @Get(":id/statistics") @RequireAiPermission(AI_PERMISSIONS.CAMPAIGN_TASKS_STATISTICS_READ)
  statistics(@Param("id") id: string, @Headers() headers: RequestHeaders) {
    return this.service.statistics(id, this.tenant(headers));
  }
  @Get(":id/proofs") @RequireAiPermission(AI_PERMISSIONS.CAMPAIGN_TASKS_PROOFS_READ)
  proofs(@Param("id") id: string, @Headers() headers: RequestHeaders) {
    return this.service.proofs(id, this.tenant(headers));
  }
  @Post(":id/proofs/:proofId/review") @RequireAiPermission(AI_PERMISSIONS.CAMPAIGN_TASKS_PROOFS_REVIEW)
  reviewProof(@Param("id") id: string, @Param("proofId") proofId: string, @Body() body: Record<string, unknown>, @Headers() headers: RequestHeaders, @Req() req: { adminUserId?: string }) {
    return this.service.reviewProof(id, proofId, this.tenant(headers), this.actor(req), body);
  }
  @Post(":id/reconcile") @RequireAiPermission(AI_PERMISSIONS.CAMPAIGN_TASKS_RECONCILIATION_RUN)
  reconcile(@Param("id") id: string, @Headers() headers: RequestHeaders, @Req() req: { adminUserId?: string }) {
    return this.service.reconcile(id, this.tenant(headers), this.actor(req));
  }
}

@Controller("api/ai/distribution")
@UseGuards(AdminAuthGuard)
export class CampaignTaskParticipantController {
  constructor(
    @Inject(CampaignTaskService) private readonly service: CampaignTaskService,
    @Inject(DistributionService) private readonly distribution: DistributionService,
  ) {}
  private context(headers: RequestHeaders) {
    return {
      tenantId: required(headers["x-tenant-id"], "TENANT_ID_REQUIRED"),
      participantId: required(headers["x-participant-id"], "PARTICIPANT_ID_REQUIRED"),
    };
  }
  @Get("tasks/available")
  available(@Headers() headers: RequestHeaders) {
    const value = this.context(headers);
    return this.service.available(value.tenantId, value.participantId);
  }
  @Get("tasks/:taskId")
  task(@Param("taskId") taskId: string, @Headers() headers: RequestHeaders) {
    const value = this.context(headers);
    return this.service.participantTask(taskId, value.tenantId, value.participantId);
  }
  @Post("tasks/:taskId/claim")
  claim(@Param("taskId") taskId: string, @Headers() headers: RequestHeaders) {
    const value = this.context(headers);
    return this.service.claim(taskId, value.tenantId, value.participantId, required(headers["idempotency-key"], "IDEMPOTENCY_KEY_REQUIRED"));
  }
  @Get("assignments/:id")
  assignment(@Param("id") id: string, @Headers() headers: RequestHeaders) {
    return this.distribution.assignmentPackage(id, this.context(headers).participantId);
  }
  @Post("assignments/:id/cancel")
  cancel(@Param("id") id: string, @Headers() headers: RequestHeaders) {
    return this.distribution.cancelAssignment(id, this.context(headers).participantId);
  }
  @Post("assignments/:id/assets/refresh")
  refresh(@Param("id") id: string, @Headers() headers: RequestHeaders) {
    return this.distribution.assignmentPackage(id, this.context(headers).participantId);
  }
  @Post("invitations/:token/accept")
  accept(@Param("token") token: string, @Headers() headers: RequestHeaders) {
    const value = this.context(headers);
    return this.service.acceptInvitation(token, value.participantId, value.tenantId, true);
  }
  @Post("invitations/:token/decline")
  decline(@Param("token") token: string, @Headers() headers: RequestHeaders) {
    const value = this.context(headers);
    return this.service.acceptInvitation(token, value.participantId, value.tenantId, false);
  }
  @Post("proofs/upload-session")
  proofUpload(@Body() body: Record<string, unknown>, @Headers() headers: RequestHeaders) {
    const value = this.context(headers);
    return this.distribution.createProofUploadSession({ ...body, externalUserId: value.participantId }, value.participantId, required(headers["idempotency-key"], "IDEMPOTENCY_KEY_REQUIRED"));
  }
  @Post("proofs/:id/complete")
  proofComplete(@Param("id") id: string, @Headers() headers: RequestHeaders) {
    return this.distribution.completeProof(id, this.context(headers).participantId);
  }
  @Get("proofs/:id/status")
  proofStatus(@Param("id") id: string, @Headers() headers: RequestHeaders) {
    return this.distribution.getProofForExternalUser(id, this.context(headers).participantId);
  }
  @Post("proofs/:id/additional-evidence")
  additionalEvidence(@Param("id") id: string, @Body() body: Record<string, unknown>, @Headers() headers: RequestHeaders) {
    const value = this.context(headers);
    return this.distribution.addEvidence(id, body, value.participantId);
  }
}
