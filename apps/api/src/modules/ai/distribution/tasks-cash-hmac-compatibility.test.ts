import type { ExecutionContext } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetEnvironmentCache } from "../../../environment.js";
import { signTasksCashRequest } from "./distribution.contracts.js";
import { TasksCashHmacGuard } from "./tasks-cash-hmac.guard.js";

const secret = "tasks-cash-distribution-hmac-secret-at-least-32-characters";
const path = "/api/integrations/tasks-cash/distribution/assignments";
const timestamp = Date.now();
const nonce = "hmac-compat-nonce-1";
const body = { apiVersion: "v1", externalTaskId: "task-1", externalUserId: "user-1" };

function contextFor(input: {
  nonce: string;
  timestamp: number;
  signature?: string;
  body?: unknown;
  originalUrl?: string;
}): ExecutionContext {
  const requestBody = input.body ?? body;
  const requestTimestamp = input.timestamp;
  const signature =
    input.signature ??
    signTasksCashRequest(secret, {
      method: "POST",
      path,
      timestamp: requestTimestamp,
      nonce: input.nonce,
      body: requestBody,
    });
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        method: "POST",
        originalUrl: input.originalUrl ?? `${path}?ignored=true`,
        body: requestBody,
        headers: {
          "x-tasks-cash-timestamp": String(requestTimestamp),
          "x-tasks-cash-nonce": input.nonce,
          "x-tasks-cash-signature": signature,
        },
      }),
    }),
  } as ExecutionContext;
}

describe("Tasks.cash request HMAC compatibility", () => {
  beforeEach(() => {
    Object.assign(process.env, {
      APP_ENV: "test",
      MONGODB_URI: "mongodb://localhost/test",
      REDIS_URL: "redis://localhost:6379",
      S3_ENDPOINT: "http://localhost:9000",
      S3_BUCKET: "test",
      S3_ACCESS_KEY_ID: "test",
      S3_SECRET_ACCESS_KEY: "test",
      ENCRYPTION_KEY_ID: "test",
      ENCRYPTION_MASTER_KEY: "test-encryption-key-with-at-least-32-characters",
      AI_SERVICE_URL: "http://localhost:8200",
      AI_SERVICE_INTERNAL_SECRET: "test-internal-secret-with-at-least-32-characters",
      ADMIN_API_TOKEN: "test-admin-token-with-at-least-32-characters",
      TASKS_CASH_INTEGRATION_ENABLED: "true",
      TASKS_CASH_CALLBACK_URL: "https://tasks.example/callback",
      TASKS_CASH_HMAC_SECRET: secret,
      TASKS_CASH_DISTRIBUTION_CALLBACK_URL: "https://tasks.example/callback",
      TASKS_CASH_DISTRIBUTION_HMAC_SECRET: secret,
    });
    resetEnvironmentCache();
  });

  it("accepts a valid Tasks.cash-compatible signature", async () => {
    const guard = new TasksCashHmacGuard({ reserve: vi.fn().mockResolvedValue(true) } as never);
    await expect(guard.canActivate(contextFor({ nonce, timestamp }))).resolves.toBe(true);
  });

  it("rejects a one-byte body change", async () => {
    const guard = new TasksCashHmacGuard({ reserve: vi.fn().mockResolvedValue(true) } as never);
    const signatureForOriginal = signTasksCashRequest(secret, { method: "POST", path, timestamp, nonce: "body-change-nonce", body });
    const modifiedBody = { ...body, externalUserId: "user-2" };
    await expect(guard.canActivate(contextFor({ nonce: "body-change-nonce", timestamp, body: modifiedBody, signature: signatureForOriginal }))).rejects.toThrow();
  });

  it("rejects the wrong HMAC secret", async () => {
    const wrongSignature = signTasksCashRequest("wrong-secret-at-least-32-characters-!!", {
      method: "POST",
      path,
      timestamp,
      nonce,
      body,
    });
    const guard = new TasksCashHmacGuard({ reserve: vi.fn().mockResolvedValue(true) } as never);
    await expect(guard.canActivate(contextFor({ nonce, timestamp, signature: wrongSignature }))).rejects.toThrow();
  });

  it("rejects an expired timestamp", async () => {
    const expired = Date.now() - 121_000;
    const guard = new TasksCashHmacGuard({ reserve: vi.fn().mockResolvedValue(true) } as never);
    await expect(guard.canActivate(contextFor({ nonce: "expired-nonce", timestamp: expired }))).rejects.toThrow();
  });

  it("rejects a future timestamp outside tolerance", async () => {
    const future = Date.now() + 121_000;
    const guard = new TasksCashHmacGuard({ reserve: vi.fn().mockResolvedValue(true) } as never);
    await expect(guard.canActivate(contextFor({ nonce: "future-nonce", timestamp: future }))).rejects.toThrow();
  });

  it("rejects a signature built from a different canonical value", async () => {
    const wrongPathSignature = signTasksCashRequest(secret, {
      method: "POST",
      path: "/api/integrations/tasks-cash/distribution/proofs/upload-session",
      timestamp,
      nonce,
      body,
    });
    const guard = new TasksCashHmacGuard({ reserve: vi.fn().mockResolvedValue(true) } as never);
    await expect(guard.canActivate(contextFor({ nonce, timestamp, signature: wrongPathSignature }))).rejects.toThrow();
  });

  it("rejects a replayed nonce", async () => {
    const guard = new TasksCashHmacGuard({ reserve: vi.fn().mockResolvedValue(false) } as never);
    await expect(guard.canActivate(contextFor({ nonce: "replayed-nonce", timestamp }))).rejects.toThrow();
  });

  it("allows the same idempotent request to verify when replay is not yet recorded", async () => {
    const replay = { reserve: vi.fn().mockResolvedValue(true) };
    const guard = new TasksCashHmacGuard(replay as never);
    await expect(guard.canActivate(contextFor({ nonce: "idempotent-nonce", timestamp }))).resolves.toBe(true);
    await expect(guard.canActivate(contextFor({ nonce: "idempotent-nonce", timestamp }))).resolves.toBe(true);
    expect(replay.reserve).toHaveBeenCalledTimes(2);
  });
});
