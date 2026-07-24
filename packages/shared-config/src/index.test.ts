import { describe, expect, it } from "vitest";
import { apiEnvironmentSchema } from "./index.js";

const baseEnvironment = {
  APP_ENV: "development",
  MONGODB_URI: "mongodb://localhost:27020/miraaj",
  REDIS_URL: "redis://localhost:6383",
  S3_ENDPOINT: "http://localhost:9200",
  S3_BUCKET: "miraaj-media",
  S3_ACCESS_KEY_ID: "test-access-key",
  S3_SECRET_ACCESS_KEY: "test-secret-key",
  ENCRYPTION_KEY_ID: "test-v1",
  ENCRYPTION_MASTER_KEY: "test-encryption-key-with-at-least-32-characters",
  AI_SERVICE_URL: "http://localhost:8200",
  AI_SERVICE_INTERNAL_SECRET: "test-internal-secret-with-at-least-32-characters",
  ADMIN_API_TOKEN: "test-admin-token-with-at-least-32-characters",
} as const;

describe("API environment policy", () => {
  it("allows temporary admin authentication outside production", () => {
    expect(apiEnvironmentSchema.safeParse(baseEnvironment).success).toBe(true);
  });

  it("keeps Prompt 6 automatic verification and Tasks.cash integration disabled", () => {
    const parsed = apiEnvironmentSchema.parse(baseEnvironment);
    expect(parsed.DISTRIBUTION_AUTO_VERIFY_ENABLED).toBe(false);
    expect(parsed.TASKS_CASH_INTEGRATION_ENABLED).toBe(false);
    expect(parsed.DISTRIBUTION_PILOT_ENABLED).toBe(false);
    expect(parsed.DISTRIBUTION_PUBLIC_POST_INSPECTION_ENABLED).toBe(false);
    expect(parsed.DISTRIBUTION_EMERGENCY_ASSIGNMENT_STOP).toBe(false);
    expect(parsed.AI_PROOF_VERIFICATION_QUEUE_NAME).toBe(
      "miraaj.ai.proof-verification",
    );
  });

  it("provides differentiated retention and fail-closed pilot capacity defaults", () => {
    const parsed = apiEnvironmentSchema.parse(baseEnvironment);
    expect(parsed.DISTRIBUTION_PROOF_RETENTION_DAYS).toBe(90);
    expect(parsed.DISTRIBUTION_REJECTED_PROOF_RETENTION_DAYS).toBe(30);
    expect(parsed.DISTRIBUTION_DUPLICATE_PROOF_RETENTION_DAYS).toBe(60);
    expect(parsed.DISTRIBUTION_FRAUD_PROOF_RETENTION_DAYS).toBe(180);
    expect(parsed.DISTRIBUTION_PILOT_MAX_ACTIVE_ASSIGNMENTS).toBe(0);
  });

  it("fails closed when Tasks.cash is enabled without secure configuration", () => {
    expect(
      apiEnvironmentSchema.safeParse({
        ...baseEnvironment,
        TASKS_CASH_INTEGRATION_ENABLED: "true",
      }).success,
    ).toBe(false);
  });

  it("rejects temporary admin authentication in production by default", () => {
    const result = apiEnvironmentSchema.safeParse({
      ...baseEnvironment,
      APP_ENV: "production",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual([
        "TEMPORARY_ADMIN_TOKEN_ENABLED",
      ]);
    }
  });

  it("requires an explicit production override for temporary admin authentication", () => {
    expect(
      apiEnvironmentSchema.safeParse({
        ...baseEnvironment,
        APP_ENV: "production",
        ALLOW_TEMPORARY_ADMIN_TOKEN_IN_PRODUCTION: "true",
      }).success,
    ).toBe(true);
  });
});
