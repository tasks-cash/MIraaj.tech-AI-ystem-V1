import { beforeEach, describe, expect, it } from "vitest";
import { UnauthorizedException } from "@nestjs/common";
import { resetEnvironmentCache } from "../../environment.js";
import { AdminAuthGuard } from "./guards/admin-auth.guard.js";

const baseEnv = {
  NODE_ENV: "test",
  APP_ENV: "test",
  LOG_LEVEL: "error",
  MONGODB_URI: "mongodb://localhost:27020/miraaj_test",
  REDIS_URL: "redis://localhost:6383",
  S3_ENDPOINT: "http://localhost:9200",
  S3_REGION: "us-east-1",
  S3_BUCKET: "miraaj-test",
  S3_ACCESS_KEY_ID: "test-key",
  S3_SECRET_ACCESS_KEY: "test-secret-value-with-enough-chars",
  S3_FORCE_PATH_STYLE: "true",
  ENCRYPTION_KEY_ID: "test-v1",
  ENCRYPTION_MASTER_KEY: "test-only-encryption-key-with-32-characters",
  API_HOST: "127.0.0.1",
  API_PORT: "4200",
  AI_SERVICE_URL: "http://127.0.0.1:8200",
  AI_SERVICE_HOST: "127.0.0.1",
  AI_SERVICE_PORT: "8200",
  AI_SERVICE_ID: "miraaj-api",
  AI_SERVICE_INTERNAL_SECRET: "test-only-internal-secret-with-32-characters",
  AI_SERVICE_REQUEST_TIMEOUT_MS: "5000",
  AI_SERVICE_REPLAY_WINDOW_SECONDS: "120",
  AI_SERVICE_VERSION: "0.1.0",
  TEMPORARY_ADMIN_TOKEN_ENABLED: "true",
  ALLOW_TEMPORARY_ADMIN_TOKEN_IN_PRODUCTION: "false",
  ADMIN_API_TOKEN: "test-only-admin-token-with-32-characters!!",
} as const;

function createContext(authorization?: string) {
  const request = {
    headers: authorization ? { authorization } : {},
  };
  return {
    request,
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  };
}

describe("AdminAuthGuard", () => {
  beforeEach(() => {
    Object.assign(process.env, baseEnv);
    resetEnvironmentCache();
  });

  it("rejects missing authorization", () => {
    const guard = new AdminAuthGuard();
    expect(() =>
      guard.canActivate(createContext() as never),
    ).toThrow(UnauthorizedException);
  });

  it("rejects invalid bearer tokens", () => {
    const guard = new AdminAuthGuard();
    expect(() =>
      guard.canActivate(createContext("Bearer wrong-token-value-that-is-long-enough") as never),
    ).toThrow(UnauthorizedException);
  });

  it("accepts a valid admin token", () => {
    const guard = new AdminAuthGuard();
    const context = createContext(`Bearer ${baseEnv.ADMIN_API_TOKEN}`);
    expect(
      guard.canActivate(context as never),
    ).toBe(true);
    expect(context.request).toMatchObject({
      adminPermissions: ["ai.systemStatus.read"],
    });
  });
});
