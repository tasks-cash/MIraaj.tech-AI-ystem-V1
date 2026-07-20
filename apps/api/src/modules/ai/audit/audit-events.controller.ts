import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { AI_PERMISSIONS } from "@miraaj/shared-config";
import { AdminAuthGuard } from "../guards/admin-auth.guard.js";
import { AiPermissionGuard } from "../guards/ai-permission.guard.js";
import { RequireAiPermission } from "../decorators/require-ai-permission.decorator.js";
import { AuditEventService } from "./audit-event.service.js";

@Controller("api/admin/ai/audit-events")
@UseGuards(AdminAuthGuard, AiPermissionGuard)
export class AuditEventsController {
  constructor(
    @Inject(AuditEventService)
    private readonly auditEventService: AuditEventService,
  ) {}

  @Get()
  @RequireAiPermission(AI_PERMISSIONS.AUDIT_LOGS_READ)
  list(
    @Query("action") action?: string,
    @Query("actorId") actorId?: string,
    @Query("targetType") targetType?: string,
    @Query("targetId") targetId?: string,
    @Query("correlationId") correlationId?: string,
    @Query("outcome") outcome?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.auditEventService.list({
      ...(action ? { action } : {}),
      ...(actorId ? { actorId } : {}),
      ...(targetType ? { targetType } : {}),
      ...(targetId ? { targetId } : {}),
      ...(correlationId ? { correlationId } : {}),
      ...(outcome ? { outcome } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      ...(limit ? { limit: Number(limit) } : {}),
      ...(offset ? { offset: Number(offset) } : {}),
    });
  }

  @Get(":auditEventId")
  @RequireAiPermission(AI_PERMISSIONS.AUDIT_LOGS_READ)
  async get(@Param("auditEventId") auditEventId: string) {
    const event = await this.auditEventService.getById(auditEventId);
    if (!event) {
      throw new NotFoundException({
        code: "AUDIT_EVENT_NOT_FOUND",
        message: "Audit event was not found.",
      });
    }
    return event;
  }
}
