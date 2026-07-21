import { describe, expect, it } from "vitest";
import {
  buildStructuredLog,
  InMemoryLogSink,
  OpenTelemetryCompatibleLogSink,
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

  it("includes creative generation identifiers when provided", () => {
    const envelope = buildStructuredLog({
      level: "info",
      event: "ai.creative.job.created",
      service: "miraaj-api",
      module: "creative",
      environment: "test",
      generationJobId: "gen-1",
      creativeAssetId: "asset-1",
      outcome: "success",
    });
    expect(envelope.generationJobId).toBe("gen-1");
    expect(envelope.creativeAssetId).toBe("asset-1");
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

  it("truncates OCR and campaign metadata while redacting secrets", () => {
    const envelope = buildStructuredLog({
      level: "info",
      event: "ai.media.ocr.completed",
      service: "miraaj-api",
      environment: "test",
      metadata: {
        ocrText: `Bearer secret-token ${"x".repeat(400)}`,
        campaignContent: "y".repeat(400),
        safeFlag: true,
      },
    });

    expect(String(envelope.metadata?.ocrText)).toContain("[REDACTED_AUTHORIZATION]");
    expect(String(envelope.metadata?.ocrText).endsWith("…[truncated]")).toBe(true);
    expect(String(envelope.metadata?.campaignContent).endsWith("…[truncated]")).toBe(true);
    expect(envelope.metadata?.safeFlag).toBe(true);
  });

  it("supports in-memory and otel-compatible sinks for tests", () => {
    const memory = new InMemoryLogSink();
    const otel = new OpenTelemetryCompatibleLogSink(memory);
    const event = buildStructuredLog({
      level: "info",
      event: "ai.audit.event.recorded",
      service: "miraaj-api",
      environment: "test",
      outcome: "success",
    });
    void otel.emit(event);
    expect(memory.events).toHaveLength(1);
    expect(memory.events[0]?.event).toBe("ai.audit.event.recorded");
  });
});
