import { describe, expect, it } from "vitest";
import {
  buildStructuredLog,
  redactSensitiveText,
  truncateForLog,
  withTraceContext,
} from "./observability.js";

describe("shared logging observability", () => {
  it("builds the shared structured envelope", () => {
    const envelope = buildStructuredLog({
      level: "info",
      event: "ai.campaign.job.created",
      service: "miraaj-api",
      module: "campaigns",
      environment: "test",
      requestId: "req-1",
      correlationId: "corr-1",
      campaignJobId: "job-1",
      outcome: "success",
    });

    expect(envelope.event).toBe("ai.campaign.job.created");
    expect(envelope.campaignJobId).toBe("job-1");
    expect(envelope.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("redacts authorization headers and presigned URLs", () => {
    const redacted = redactSensitiveText(
      "Authorization: Bearer secret-token https://minio/bucket/file?X-Amz-Signature=abc",
    );
    expect(redacted).not.toContain("secret-token");
    expect(redacted).toContain("[REDACTED_AUTHORIZATION]");
    expect(redacted).toContain("[REDACTED_PRESIGNED_URL]");
  });

  it("truncates long OCR and campaign content safely", () => {
    expect(truncateForLog("x".repeat(600), 500)?.endsWith("…[truncated]")).toBe(true);
  });

  it("propagates trace and correlation context to child events", () => {
    const child = withTraceContext(
      { traceId: "trace-1", correlationId: "corr-1", requestId: "req-1" },
      {
        level: "info",
        event: "ai.campaign.validation.completed",
        service: "miraaj-api",
        environment: "test",
      },
    );

    expect(child.traceId).toBe("trace-1");
    expect(child.correlationId).toBe("corr-1");
    expect(child.requestId).toBe("req-1");
  });
});
