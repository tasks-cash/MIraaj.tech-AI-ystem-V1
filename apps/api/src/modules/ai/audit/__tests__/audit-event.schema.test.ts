import { describe, expect, it } from "vitest";
import { AuditEventModel } from "../../models/audit-event.schema.js";

describe("audit event schema", () => {
  it("marks audit events immutable by default", () => {
    const doc = new AuditEventModel({
      auditEventId: "audit-1",
      actorId: "admin-1",
      action: "campaign.package.approved",
      targetType: "campaign_package",
      targetId: "pkg-1",
      correlationId: "corr-1",
      requestId: "req-1",
    });
    expect(doc.immutable).toBe(true);
  });
});
