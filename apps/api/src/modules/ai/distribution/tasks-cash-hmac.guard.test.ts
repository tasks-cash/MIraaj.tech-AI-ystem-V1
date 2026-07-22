import type { ExecutionContext } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetEnvironmentCache } from "../../../environment.js";
import { signTasksCashRequest } from "./distribution.contracts.js";
import { TasksCashHmacGuard } from "./tasks-cash-hmac.guard.js";

const secret = "tasks-cash-test-hmac-secret-at-least-32-characters";

function contextFor(input: { nonce: string; signature?: string; timestamp?: number; body?: unknown }): ExecutionContext {
  const body = input.body ?? { apiVersion: "v1", externalAssignmentId: "external-1" };
  const timestamp = input.timestamp ?? Date.now();
  const signature = input.signature ?? signTasksCashRequest(secret, {
    method: "POST",
    path: "/api/integrations/tasks-cash/distribution/assignments",
    timestamp,
    nonce: input.nonce,
    body,
  });
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        method: "POST",
        originalUrl: "/api/integrations/tasks-cash/distribution/assignments?ignored=true",
        body,
        headers: {
          "x-tasks-cash-timestamp": String(timestamp),
          "x-tasks-cash-nonce": input.nonce,
          "x-tasks-cash-signature": signature,
        },
      }),
    }),
  } as ExecutionContext;
}

describe("Tasks.cash distribution HMAC guard", () => {
  beforeEach(() => {
    Object.assign(process.env, {
      APP_ENV: "test", MONGODB_URI: "mongodb://localhost/test", REDIS_URL: "redis://localhost:6379",
      S3_ENDPOINT: "http://localhost:9000", S3_BUCKET: "test", S3_ACCESS_KEY_ID: "test", S3_SECRET_ACCESS_KEY: "test",
      ENCRYPTION_KEY_ID: "test", ENCRYPTION_MASTER_KEY: "test-encryption-key-with-at-least-32-characters",
      AI_SERVICE_URL: "http://localhost:8200", AI_SERVICE_INTERNAL_SECRET: "test-internal-secret-with-at-least-32-characters",
      ADMIN_API_TOKEN: "test-admin-token-with-at-least-32-characters", TASKS_CASH_INTEGRATION_ENABLED: "true",
      TASKS_CASH_CALLBACK_URL: "https://tasks.example/callback", TASKS_CASH_HMAC_SECRET: secret,
    });
    resetEnvironmentCache();
  });

  it("accepts a valid signature and delegates durable replay reservation", async () => {
    const replay = { reserve: vi.fn().mockResolvedValue(true) };
    const guard = new TasksCashHmacGuard(replay as never);
    await expect(guard.canActivate(contextFor({ nonce: "unique-valid-nonce" }))).resolves.toBe(true);
    expect(replay.reserve).toHaveBeenCalledOnce();
  });

  it("rejects a nonce reserved by another replica", async () => {
    const guard = new TasksCashHmacGuard({ reserve: vi.fn().mockResolvedValue(false) } as never);
    await expect(guard.canActivate(contextFor({ nonce: "cross-replica-replay" }))).rejects.toThrow();
  });

  it("rejects invalid signatures before reserving the nonce", async () => {
    const replay = { reserve: vi.fn() };
    const guard = new TasksCashHmacGuard(replay as never);
    await expect(guard.canActivate(contextFor({ nonce: "invalid-signature", signature: "0".repeat(64) }))).rejects.toThrow();
    expect(replay.reserve).not.toHaveBeenCalled();
  });
});
