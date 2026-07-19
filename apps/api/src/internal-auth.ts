import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type {
  CorrelationId,
  InternalRequestMetadata,
  RequestId,
} from "@miraaj/shared-types";
import {
  canonicalizeInternalRequest,
  sha256Hex,
} from "@miraaj/shared-validation";
import type { ApiEnvironment } from "./environment.js";

export const INTERNAL_HEADER_NAMES = {
  serviceId: "x-miraaj-service",
  timestamp: "x-miraaj-timestamp",
  requestId: "x-miraaj-request-id",
  correlationId: "x-miraaj-correlation-id",
  idempotencyKey: "idempotency-key",
  bodySha256: "x-miraaj-content-sha256",
  signature: "x-miraaj-signature",
} as const;

export function signInternalRequest(input: {
  method: string;
  path: string;
  body: string;
  idempotencyKey: string;
  environment: Pick<
    ApiEnvironment,
    "AI_SERVICE_ID" | "AI_SERVICE_INTERNAL_SECRET"
  >;
  requestId?: string;
  correlationId?: string;
  timestamp?: number;
}): InternalRequestMetadata {
  const timestamp = input.timestamp ?? Math.floor(Date.now() / 1_000);
  const requestId = input.requestId ?? randomUUID();
  const correlationId = input.correlationId ?? requestId;
  const bodySha256 = sha256Hex(input.body);
  const canonical = canonicalizeInternalRequest({
    method: input.method,
    path: input.path,
    serviceId: input.environment.AI_SERVICE_ID,
    timestamp,
    requestId,
    correlationId,
    idempotencyKey: input.idempotencyKey,
    bodySha256,
  });
  const signature = createHmac(
    "sha256",
    input.environment.AI_SERVICE_INTERNAL_SECRET,
  )
    .update(canonical)
    .digest("hex");

  return {
    serviceId: input.environment.AI_SERVICE_ID,
    timestamp,
    requestId: requestId as RequestId,
    correlationId: correlationId as CorrelationId,
    idempotencyKey: input.idempotencyKey,
    bodySha256,
    signature,
  };
}

export function internalRequestHeaders(
  metadata: InternalRequestMetadata,
): Record<string, string> {
  return {
    [INTERNAL_HEADER_NAMES.serviceId]: String(metadata.serviceId),
    [INTERNAL_HEADER_NAMES.timestamp]: metadata.timestamp.toString(),
    [INTERNAL_HEADER_NAMES.requestId]: metadata.requestId,
    [INTERNAL_HEADER_NAMES.correlationId]: metadata.correlationId,
    [INTERNAL_HEADER_NAMES.idempotencyKey]: metadata.idempotencyKey,
    [INTERNAL_HEADER_NAMES.bodySha256]: metadata.bodySha256,
    [INTERNAL_HEADER_NAMES.signature]: metadata.signature,
  };
}

export function secureTokenEquals(expected: string, provided: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }
  return timingSafeEqual(expectedBuffer, providedBuffer);
}
