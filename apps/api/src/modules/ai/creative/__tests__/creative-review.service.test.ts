import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { resetEnvironmentCache } from "../../../../environment.js";

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
  CREATIVE_AUTO_APPROVE_ENABLED: "false",
} as const;

function makeAsset(overrides: Record<string, unknown> = {}) {
  const doc: Record<string, unknown> = {
    assetId: "asset-1",
    creativeJobId: "cjob-1",
    status: "awaiting_review",
    currentRevision: 1,
    rightsRecordId: "rights-1",
    reviewReasonCodes: ["generated_image"],
    correlationId: "corr-1",
    ...overrides,
  };
  Object.defineProperty(doc, "save", {
    value: () => Promise.resolve(doc),
    enumerable: false,
  });
  Object.defineProperty(doc, "toObject", {
    value: () => ({ ...doc }),
    enumerable: false,
  });
  return doc;
}

function makeJob(overrides: Record<string, unknown> = {}) {
  const doc: Record<string, unknown> = {
    creativeJobId: "cjob-1",
    campaignPackageId: "pkg-1",
    status: "awaiting_review",
    reviewReasonCodes: [],
    ...overrides,
  };
  Object.defineProperty(doc, "save", {
    value: () => Promise.resolve(doc),
    enumerable: false,
  });
  return doc;
}

async function loadReviewService(input: {
  asset: Record<string, unknown>;
  rightsStatus: string;
  job?: Record<string, unknown>;
}) {
  vi.resetModules();
  resetEnvironmentCache();
  Object.assign(process.env, baseEnv);

  const reviewCollector: Array<Record<string, unknown>> = [];
  const feedbackCollector: Array<Record<string, unknown>> = [];
  const enqueue = vi.fn().mockResolvedValue({ id: "bull-regen-1" });

  vi.doMock("../../models/creative.schema.js", () => ({
    CreativeAssetModel: {
      findOne: (filter: Record<string, unknown>) => {
        if (filter.assetId === input.asset.assetId) {
          return Promise.resolve(input.asset);
        }
        return {
          lean: () =>
            Promise.resolve(
              filter.assetId === input.asset.assetId ? { ...input.asset } : null,
            ),
        };
      },
      find: () => ({
        sort: () => ({
          skip: () => ({
            limit: () => ({ lean: () => Promise.resolve([]) }),
          }),
        }),
      }),
      countDocuments: () => Promise.resolve(0),
    },
    AssetRightsRecordModel: {
      findOne: () => ({
        lean: () =>
          Promise.resolve({
            rightsRecordId: input.asset.rightsRecordId,
            status: input.rightsStatus,
          }),
      }),
    },
    CreativeAssetReviewModel: {
      create: (fields: Record<string, unknown>) => {
        reviewCollector.push(fields);
        return Promise.resolve(fields);
      },
    },
    CreativeAssetFeedbackModel: {
      create: (fields: Record<string, unknown>) => {
        feedbackCollector.push(fields);
        return Promise.resolve(fields);
      },
    },
    CreativeGenerationJobModel: {
      findOne: () => Promise.resolve(input.job ?? makeJob()),
    },
  }));

  const { CreativeReviewService } = await import("../creative-review.service.js");
  const service = new CreativeReviewService(
    {
      record: vi.fn().mockResolvedValue(undefined),
    } as never,
    {
      enqueueBuildCreativeJob: enqueue,
    } as never,
  );

  return { service, enqueue, reviewCollector, feedbackCollector };
}

describe("Prompt 5 — CreativeReviewService", () => {
  beforeEach(() => {
    resetEnvironmentCache();
    Object.assign(process.env, baseEnv);
  });

  afterEach(() => {
    resetEnvironmentCache();
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("blocks approve when rights are unknown", async () => {
    const { service } = await loadReviewService({
      asset: makeAsset(),
      rightsStatus: "unknown",
    });
    await expect(
      service.review({
        assetId: "asset-1",
        reviewerId: "admin-1",
        status: "approved",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("blocks approve when rights are prohibited", async () => {
    const { service } = await loadReviewService({
      asset: makeAsset(),
      rightsStatus: "prohibited",
    });
    await expect(
      service.review({
        assetId: "asset-1",
        reviewerId: "admin-1",
        status: "approved",
      }),
    ).rejects.toMatchObject({
      response: { code: "CREATIVE_COPYRIGHT_RISK" },
    });
  });

  it("regenerate supersedes asset and enqueues unique job id", async () => {
    const asset = makeAsset();
    const job = makeJob();
    const { service, enqueue } = await loadReviewService({
      asset,
      rightsStatus: "verified",
      job,
    });
    const result = await service.regenerateAsset({
      assetId: "asset-1",
      reviewerId: "admin-1",
      regenerationInstructions: "Fix composition",
    });
    expect(result.status).toBe("superseded");
    expect(result.queued).toBe(true);
    expect(asset.status).toBe("superseded");
    expect(job.status).toBe("queued");
    expect(enqueue).toHaveBeenCalledWith(
      {
        creativeJobId: "cjob-1",
        campaignPackageId: "pkg-1",
      },
      { uniqueJobId: true },
    );
  });
});
