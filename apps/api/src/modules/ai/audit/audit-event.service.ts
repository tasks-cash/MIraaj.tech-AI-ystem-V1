import { Injectable } from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import { createLogger } from "@miraaj/shared-logging";
import { loadEnvironment } from "../../../environment.js";
import { AuditEventModel } from "../models/audit-event.schema.js";

export interface RecordAuditEventInput {
  actorId: string;
  actorRole?: string;
  action: string;
  targetType: string;
  targetId: string;
  previousRevision?: number;
  newRevision?: number;
  reason?: string;
  correlationId: string;
  requestId: string;
  outcome?: "success" | "failure" | "denied";
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuditEventService {
  private readonly environment = loadEnvironment();
  private readonly logger = createLogger({
    service: "miraaj-api",
    environment: this.environment.APP_ENV,
    level: this.environment.LOG_LEVEL,
  });
  private droppedAuditWrites = 0;
  private lastSuccessfulAuditWriteAt: string | null = null;

  async record(input: RecordAuditEventInput, options?: { failClosed?: boolean }): Promise<void> {
    try {
      await AuditEventModel.create({
        auditEventId: randomUUID(),
        actorId: input.actorId,
        actorRole: input.actorRole ?? "administrator",
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        ...(input.previousRevision !== undefined
          ? { previousRevision: input.previousRevision }
          : {}),
        ...(input.newRevision !== undefined ? { newRevision: input.newRevision } : {}),
        ...(input.reason ? { reason: input.reason } : {}),
        correlationId: input.correlationId,
        requestId: input.requestId,
        outcome: input.outcome ?? "success",
        ...(input.ipAddress
          ? { ipHash: createHash("sha256").update(input.ipAddress).digest("hex") }
          : {}),
        ...(input.userAgent
          ? { userAgentSummary: input.userAgent.slice(0, 120) }
          : {}),
      });
      this.lastSuccessfulAuditWriteAt = new Date().toISOString();
      this.logger.info(
        {
          event: "ai.audit.event.recorded",
          action: input.action,
          targetType: input.targetType,
          targetId: input.targetId,
          correlationId: input.correlationId,
          requestId: input.requestId,
          outcome: input.outcome ?? "success",
        },
        "Audit event recorded",
      );
    } catch (error: unknown) {
      this.droppedAuditWrites += 1;
      this.logger.error(
        {
          event: "ai.audit.event.write_failed",
          action: input.action,
          targetType: input.targetType,
          targetId: input.targetId,
          safeErrorCode: "AUDIT_WRITE_FAILED",
        },
        "Audit event write failed",
      );
      if (options?.failClosed) {
        throw error;
      }
    }
  }

  async list(input?: {
    action?: string;
    actorId?: string;
    targetType?: string;
    targetId?: string;
    correlationId?: string;
    outcome?: string;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  }) {
    const limit = Math.min(input?.limit ?? 25, 100);
    const offset = input?.offset ?? 0;
    const filter: Record<string, unknown> = {};
    if (input?.action) filter.action = input.action;
    if (input?.actorId) filter.actorId = input.actorId;
    if (input?.targetType) filter.targetType = input.targetType;
    if (input?.targetId) filter.targetId = input.targetId;
    if (input?.correlationId) filter.correlationId = input.correlationId;
    if (input?.outcome) filter.outcome = input.outcome;
    if (input?.from || input?.to) {
      filter.createdAt = {
        ...(input.from ? { $gte: new Date(input.from) } : {}),
        ...(input.to ? { $lte: new Date(input.to) } : {}),
      };
    }
    const [items, total] = await Promise.all([
      AuditEventModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .lean(),
      AuditEventModel.countDocuments(filter),
    ]);
    return { items, total, limit, offset };
  }

  async getById(auditEventId: string) {
    return AuditEventModel.findOne({ auditEventId }).lean();
  }

  getStatus() {
    return {
      state: "ready",
      lastSuccessfulAuditWriteAt: this.lastSuccessfulAuditWriteAt,
      droppedAuditWrites: this.droppedAuditWrites,
      traceExporterState: "disabled",
      metricsExporterState: "disabled",
    };
  }
}
