import { createHash } from "node:crypto";
import type {
  CorrelationId,
  InternalRequestMetadata,
  RequestId,
} from "@miraaj/shared-types";
import { z } from "zod";

export const internalRequestHeadersSchema = z.object({
  serviceId: z.string().min(3).max(100),
  timestamp: z.coerce.number().int().positive(),
  requestId: z.string().uuid(),
  correlationId: z.string().min(8).max(200),
  idempotencyKey: z.string().min(8).max(200),
  bodySha256: z.string().regex(/^[a-f0-9]{64}$/),
  signature: z.string().regex(/^[a-f0-9]{64}$/),
});

export function sha256Hex(body: string | Uint8Array): string {
  return createHash("sha256").update(body).digest("hex");
}

export function canonicalizeInternalRequest(input: {
  method: string;
  path: string;
  serviceId: string;
  timestamp: number;
  requestId: string;
  correlationId: string;
  idempotencyKey: string;
  bodySha256: string;
}): string {
  return [
    input.method.toUpperCase(),
    input.path,
    input.serviceId,
    input.timestamp.toString(),
    input.requestId,
    input.correlationId,
    input.idempotencyKey,
    input.bodySha256,
  ].join("\n");
}

export function parseInternalRequestMetadata(
  source: z.input<typeof internalRequestHeadersSchema>,
): InternalRequestMetadata {
  const value = internalRequestHeadersSchema.parse(source);
  return {
    ...value,
    requestId: value.requestId as RequestId,
    correlationId: value.correlationId as CorrelationId,
  };
}
