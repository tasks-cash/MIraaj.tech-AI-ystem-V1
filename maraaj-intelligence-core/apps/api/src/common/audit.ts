
import { AuditLog } from "@maraaj/database";
import { sha256Hex } from "@maraaj/crypto";
import { randomUUID } from "node:crypto";

export async function writeAudit(event: {
  tenantId?: string;
  projectId?: string;
  actorType: string;
  actorId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  previousValues?: unknown;
  newValues?: unknown;
  ipHash?: string;
  userAgent?: string;
  correlationId?: string;
  requestId?: string;
  severity?: string;
  metadata?: unknown;
}) {
  const last = await AuditLog.findOne().sort({ timestamp: -1 }).lean();
  const previousHash = (last as { eventHash?: string } | null)?.eventHash ?? "GENESIS";
  const eventId = randomUUID();
  const timestamp = new Date();
  const canonical = JSON.stringify({
    eventId,
    timestamp: timestamp.toISOString(),
    tenantId: event.tenantId ?? null,
    projectId: event.projectId ?? null,
    actorType: event.actorType,
    actorId: event.actorId ?? null,
    action: event.action,
    entityType: event.entityType ?? null,
    entityId: event.entityId ?? null,
    previousValues: event.previousValues ?? null,
    newValues: event.newValues ?? null,
    ipHash: event.ipHash ?? null,
    correlationId: event.correlationId ?? null,
    requestId: event.requestId ?? null,
    severity: event.severity ?? "informational",
  });
  const eventHash = sha256Hex(previousHash + canonical);
  await AuditLog.create({
    eventId,
    timestamp,
    ...event,
    previousHash,
    eventHash,
  });
  return { eventId, eventHash, previousHash };
}

export async function verifyAuditChain(limit = 1000): Promise<{ ok: boolean; brokenAt?: string }> {
  const logs = await AuditLog.find().sort({ timestamp: 1 }).limit(limit).lean();
  let prev = "GENESIS";
  for (const log of logs as Array<Record<string, unknown>>) {
    const canonical = JSON.stringify({
      eventId: log.eventId,
      timestamp: new Date(log.timestamp as string).toISOString(),
      tenantId: log.tenantId ?? null,
      projectId: log.projectId ?? null,
      actorType: log.actorType,
      actorId: log.actorId ?? null,
      action: log.action,
      entityType: log.entityType ?? null,
      entityId: log.entityId ?? null,
      previousValues: log.previousValues ?? null,
      newValues: log.newValues ?? null,
      ipHash: log.ipHash ?? null,
      correlationId: log.correlationId ?? null,
      requestId: log.requestId ?? null,
      severity: log.severity ?? "informational",
    });
    const expected = sha256Hex(prev + canonical);
    if (expected !== log.eventHash) {
      return { ok: false, brokenAt: String(log.eventId) };
    }
    prev = String(log.eventHash);
  }
  return { ok: true };
}
