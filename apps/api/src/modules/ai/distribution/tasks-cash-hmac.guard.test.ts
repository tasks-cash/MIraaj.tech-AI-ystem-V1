import { createHash, createHmac } from "node:crypto";
import type { ExecutionContext } from "@nestjs/common";
import { beforeEach, describe, expect, it } from "vitest";
import { resetEnvironmentCache } from "../../../environment.js";
import { TasksCashHmacGuard } from "./tasks-cash-hmac.guard.js";

const secret = "tasks-cash-test-hmac-secret-at-least-32-characters";

function contextFor(input: { nonce: string; signature?: string; timestamp?: number }): ExecutionContext {
  const body = { externalAssignmentId: "external-1" };
  const timestamp = input.timestamp ?? Date.now();
  const bodyHash = createHash("sha256").update(JSON.stringify(body)).digest("hex");
  const canonical = `POST\n/api/integrations/tasks-cash/distribution/assignments\n${timestamp}\n${input.nonce}\n${bodyHash}`;
  const signature = input.signature ?? createHmac("sha256", secret).update(canonical).digest("hex");
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        method: "POST",
        originalUrl: "/api/integrations/tasks-cash/distribution/assignments",
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
    });
    resetEnvironmentCache();
  });

  it("accepts a valid signature exactly once", () => {
    const guard = new TasksCashHmacGuard();
    expect(guard.canActivate(contextFor({ nonce: "unique-valid-nonce" }))).toBe(true);
    expect(() => guard.canActivate(contextFor({ nonce: "unique-valid-nonce" }))).toThrow();
  });

  it("rejects an invalid signature", () => {
    expect(() => new TasksCashHmacGuard().canActivate(contextFor({ nonce: "invalid-signature-nonce", signature: "0".repeat(64) }))).toThrow();
  });
});
