
import { randomUUID } from "node:crypto";

export function success<T>(data: T, requestId = randomUUID()) {
  return {
    success: true as const,
    data,
    meta: { requestId, timestamp: new Date().toISOString() },
  };
}

export function failure(
  code: string,
  message: string,
  details: unknown[] = [],
  requestId = randomUUID(),
) {
  return {
    success: false as const,
    error: { code, message, details },
    meta: { requestId, timestamp: new Date().toISOString() },
  };
}
