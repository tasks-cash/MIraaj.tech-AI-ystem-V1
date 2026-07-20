export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";
export type LogOutcome = "success" | "failure" | "partial";

export interface StructuredLogEnvelope {
  timestamp: string;
  level: LogLevel;
  event: string;
  service: string;
  module?: string;
  environment: string;
  requestId?: string;
  correlationId?: string;
  traceId?: string;
  spanId?: string;
  actorId?: string;
  actorRole?: string;
  mediaId?: string;
  analysisJobId?: string;
  intelligenceJobId?: string;
  campaignJobId?: string;
  attemptId?: string;
  durationMs?: number;
  outcome?: LogOutcome;
  safeErrorCode?: string;
  metadata?: Record<string, unknown>;
}

const PRESIGNED_URL_PATTERN =
  /https?:\/\/[^\s"'<>]+(?:X-Amz-Signature|X-Amz-Credential|X-Amz-Algorithm)[^\s"'<>]*/gi;
const AUTHORIZATION_PATTERN = /(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi;

export function truncateForLog(
  value: string | null | undefined,
  maxChars = 500,
): string | undefined {
  if (!value) {
    return undefined;
  }
  if (value.length <= maxChars) {
    return value;
  }
  return `${value.slice(0, maxChars)}…[truncated]`;
}

export function redactSensitiveText(value: string): string {
  return value
    .replace(PRESIGNED_URL_PATTERN, "[REDACTED_PRESIGNED_URL]")
    .replace(AUTHORIZATION_PATTERN, "[REDACTED_AUTHORIZATION]");
}

export function buildStructuredLog(
  input: Omit<StructuredLogEnvelope, "timestamp"> & {
    timestamp?: string;
  },
): StructuredLogEnvelope {
  const metadata =
    input.metadata === undefined
      ? undefined
      : Object.fromEntries(
          Object.entries(input.metadata).map(([key, value]) => {
            if (typeof value === "string") {
              return [key, redactSensitiveText(value)];
            }
            return [key, value];
          }),
        );

  return {
    timestamp: input.timestamp ?? new Date().toISOString(),
    level: input.level,
    event: input.event,
    service: input.service,
    environment: input.environment,
    ...(input.module ? { module: input.module } : {}),
    ...(input.requestId ? { requestId: input.requestId } : {}),
    ...(input.correlationId ? { correlationId: input.correlationId } : {}),
    ...(input.traceId ? { traceId: input.traceId } : {}),
    ...(input.spanId ? { spanId: input.spanId } : {}),
    ...(input.actorId ? { actorId: input.actorId } : {}),
    ...(input.actorRole ? { actorRole: input.actorRole } : {}),
    ...(input.mediaId ? { mediaId: input.mediaId } : {}),
    ...(input.analysisJobId ? { analysisJobId: input.analysisJobId } : {}),
    ...(input.intelligenceJobId ? { intelligenceJobId: input.intelligenceJobId } : {}),
    ...(input.campaignJobId ? { campaignJobId: input.campaignJobId } : {}),
    ...(input.attemptId ? { attemptId: input.attemptId } : {}),
    ...(input.durationMs !== undefined ? { durationMs: input.durationMs } : {}),
    ...(input.outcome ? { outcome: input.outcome } : {}),
    ...(input.safeErrorCode ? { safeErrorCode: input.safeErrorCode } : {}),
    ...(metadata ? { metadata } : {}),
  };
}

export function withTraceContext(
  parent: Pick<StructuredLogEnvelope, "traceId" | "spanId" | "correlationId" | "requestId">,
  child: Omit<StructuredLogEnvelope, "timestamp">,
): StructuredLogEnvelope {
  const traceId = child.traceId ?? parent.traceId ?? parent.correlationId ?? parent.requestId;
  const correlationId = child.correlationId ?? parent.correlationId ?? parent.requestId;
  const requestId = child.requestId ?? parent.requestId;
  return buildStructuredLog({
    ...child,
    ...(traceId ? { traceId } : {}),
    ...(child.spanId ? { spanId: child.spanId } : {}),
    ...(correlationId ? { correlationId } : {}),
    ...(requestId ? { requestId } : {}),
  });
}
