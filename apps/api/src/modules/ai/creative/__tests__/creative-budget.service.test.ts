import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { resetEnvironmentCache } from "../../../../environment.js";
import {
  CreativeGenerationAttemptModel,
  CreativeGenerationJobModel,
} from "../../models/creative.schema.js";
import { CreativeBudgetService } from "../creative-budget.service.js";

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
  AI_SERVICE_REQUEST_TIMEOUT_MS: "100",
  AI_SERVICE_REPLAY_WINDOW_SECONDS: "120",
  AI_SERVICE_VERSION: "0.1.0",
  ADMIN_API_TOKEN: "test-only-admin-token-with-32-characters!!",
  AI_PROVIDER_USAGE_TRACKING_ENABLED: "true",
  AI_PROVIDER_MAX_ACTIVE_IMAGE_JOBS: "2",
  AI_PROVIDER_MAX_ACTIVE_VIDEO_JOBS: "1",
} as const;

describe("Prompt 5.1 — CreativeBudgetService", () => {
  beforeEach(() => {
    resetEnvironmentCache();
    delete process.env.AI_PROVIDER_DAILY_COST_LIMIT;
    delete process.env.AI_PROVIDER_JOB_COST_LIMIT;
    delete process.env.AI_PROVIDER_MONTHLY_COST_LIMIT;
    Object.assign(process.env, baseEnv);
    vi.restoreAllMocks();
  });

  afterEach(() => {
    resetEnvironmentCache();
    vi.restoreAllMocks();
  });

  function loadService(env?: Record<string, string>) {
    resetEnvironmentCache();
    delete process.env.AI_PROVIDER_DAILY_COST_LIMIT;
    delete process.env.AI_PROVIDER_JOB_COST_LIMIT;
    delete process.env.AI_PROVIDER_MONTHLY_COST_LIMIT;
    Object.assign(process.env, baseEnv, env ?? {});
    return new CreativeBudgetService();
  }

  it("enforces image concurrency limits", async () => {
    vi.spyOn(CreativeGenerationJobModel, "countDocuments").mockResolvedValue(2);
    const service = loadService();
    await expect(
      service.assertWithinConcurrencyLimits({
        needsImage: true,
        needsVideo: false,
        imageProvider: "openai",
        videoProvider: "disabled",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("allows create when under concurrency limits", async () => {
    vi.spyOn(CreativeGenerationJobModel, "countDocuments").mockResolvedValue(0);
    const service = loadService();
    await expect(
      service.assertWithinConcurrencyLimits({
        needsImage: true,
        needsVideo: true,
        imageProvider: "openai",
        videoProvider: "runway",
      }),
    ).resolves.toBeUndefined();
  });

  it("blocks when daily known cost meets limit", async () => {
    vi.spyOn(CreativeGenerationAttemptModel, "find").mockReturnValue({
      select: () => ({
        lean: () =>
          Promise.resolve([
            {
              usageMetadata: {
                costUnknown: false,
                providerReportedCost: 10,
              },
            },
          ]),
      }),
    } as never);
    vi.spyOn(CreativeGenerationAttemptModel, "countDocuments").mockResolvedValue(
      0,
    );
    const service = loadService({ AI_PROVIDER_DAILY_COST_LIMIT: "10" });
    await expect(service.assertCostBudget()).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("fails job cost when provider reports over JOB_COST_LIMIT", () => {
    const service = loadService({ AI_PROVIDER_JOB_COST_LIMIT: "1" });
    expect(() => service.assertJobCostLimit(2.5)).toThrow(BadRequestException);
  });

  it("skips cost checks when limits unset", async () => {
    const service = loadService();
    await expect(service.assertCostBudget()).resolves.toBeUndefined();
    expect(() => service.assertJobCostLimit(999)).not.toThrow();
  });
});
