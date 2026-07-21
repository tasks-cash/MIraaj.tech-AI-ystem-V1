import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetEnvironmentCache } from "../../../../environment.js";
import type { CreateCreativeJobInput } from "../creative-job.service.js";

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
  AI_IMAGE_PROVIDER: "disabled",
  AI_VIDEO_PROVIDER: "disabled",
  AI_RENDER_PROVIDER: "local",
  CREATIVE_MAX_BRIEFS_PER_JOB: "20",
  CREATIVE_MAX_VARIANTS_PER_BRIEF: "4",
  CREATIVE_MAX_TOTAL_ASSETS_PER_JOB: "40",
  CREATIVE_AUTO_APPROVE_ENABLED: "false",
} as const;

function matchesFilter(doc: Record<string, unknown>, filter: Record<string, unknown>): boolean {
  return Object.entries(filter).every(([key, value]) => {
    if (value && typeof value === "object" && "$nin" in (value as Record<string, unknown>)) {
      const list = (value as { $nin: unknown[] }).$nin;
      return !list.includes(doc[key]);
    }
    return doc[key] === value;
  });
}

function makeJobModel() {
  const store: Record<string, unknown>[] = [];
  function attachHelpers(doc: Record<string, unknown>) {
    if (!("save" in doc)) {
      Object.defineProperty(doc, "save", {
        value: () => Promise.resolve(doc),
        enumerable: false,
      });
    }
    if (!("toObject" in doc)) {
      Object.defineProperty(doc, "toObject", {
        value: () => ({ ...doc }),
        enumerable: false,
      });
    }
    return doc;
  }
  return {
    findOne(filter: Record<string, unknown>) {
      const found = store.find((doc) => matchesFilter(doc, filter)) ?? null;
      return {
        lean: () => Promise.resolve(found ? { ...found } : null),
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve(found ? attachHelpers(found) : null).then(resolve),
      };
    },
    find(filter: Record<string, unknown> = {}) {
      const matched = store.filter((doc) => matchesFilter(doc, filter));
      const chain = {
        sort: () => chain,
        skip: () => chain,
        limit: () => chain,
        lean: () => Promise.resolve(matched.map((doc) => ({ ...doc }))),
      };
      return chain;
    },
    countDocuments(filter: Record<string, unknown> = {}) {
      return Promise.resolve(store.filter((doc) => matchesFilter(doc, filter)).length);
    },
    create(fields: Record<string, unknown>) {
      const doc = attachHelpers({ ...fields });
      store.push(doc);
      return Promise.resolve(doc);
    },
    size: () => store.length,
  };
}

const approvedSource = {
  campaignPackage: {
    campaignPackageId: "pkg-1",
    campaignId: "campaign-1",
    campaignBriefId: "brief-1",
    status: "approved",
    currentRevision: 1,
    brandProfileId: "miraaj-tech",
    brandProfileVersion: 1,
    platformPolicyVersion: 1,
    compliancePolicyVersion: 1,
    selectedPlatforms: ["facebook"],
    targetLanguages: ["en"],
    targetLocales: ["en-US"],
    requiredDisclosures: {},
    reviewReasonCodes: [] as string[],
    selectedServices: ["dental_clinic_management"],
    correlationId: "corr-1",
    createdBy: "admin-1",
  },
  briefs: [{ briefId: "img-1", briefType: "image" as const }],
  reviewReasonCodes: [] as string[],
};

function baseCreateInput(
  overrides: Partial<CreateCreativeJobInput> = {},
): CreateCreativeJobInput {
  return {
    campaignPackageId: "pkg-1",
    selectedAssetTypes: ["square_image"],
    selectedPlatforms: ["facebook"],
    targetLanguages: ["en"],
    targetLocales: ["en-US"],
    requestedBy: "admin-1",
    ...overrides,
  };
}

async function loadJobService(options?: {
  source?: typeof approvedSource;
  env?: Record<string, string>;
  budget?: {
    assertWithinConcurrencyLimits?: () => Promise<void>;
    assertCostBudget?: () => Promise<void>;
  };
  seed?: {
    getActiveModelPolicyForProviders?: () => Promise<Record<string, unknown>>;
    getCapabilityOrNull?: (id: string) => Promise<Record<string, unknown> | null>;
  };
}) {
  vi.resetModules();
  resetEnvironmentCache();
  Object.assign(process.env, baseEnv, options?.env ?? {});
  const jobModel = makeJobModel();
  vi.doMock("../../models/creative.schema.js", () => ({
    CreativeGenerationJobModel: jobModel,
  }));
  const enqueue = vi.fn().mockResolvedValue({ id: "bull-1" });
  const serviceModule = await import("../creative-job.service.js");
  const service = new serviceModule.CreativeJobService(
    { getRedis: () => ({ incr: () => Promise.resolve(1), expire: () => Promise.resolve(1) }) } as never,
    {
      loadAndValidate: () =>
        Promise.resolve(options?.source ?? approvedSource),
    } as never,
    {
      getActiveModelPolicyOrThrow: () =>
        Promise.resolve({ version: 1, autoApproveEnabled: false }),
      getActiveModelPolicyForProviders: () =>
        options?.seed?.getActiveModelPolicyForProviders?.() ??
        Promise.resolve({ version: 1, autoApproveEnabled: false }),
      getCapabilityOrNull: (id: string) =>
        options?.seed?.getCapabilityOrNull?.(id) ??
        Promise.resolve(
          id === "image-openai" || id === "video-runway"
            ? { capabilityId: id, status: "active" }
            : null,
        ),
    } as never,
    { enqueueBuildCreativeJob: enqueue } as never,
    {
      assertWithinConcurrencyLimits:
        options?.budget?.assertWithinConcurrencyLimits ??
        (() => Promise.resolve()),
      assertCostBudget:
        options?.budget?.assertCostBudget ?? (() => Promise.resolve()),
    } as never,
  );
  return { service, jobModel, enqueue };
}

describe("Prompt 5 — CreativeJobService", () => {
  beforeEach(() => {
    resetEnvironmentCache();
    Object.assign(process.env, baseEnv);
  });

  afterEach(() => {
    resetEnvironmentCache();
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("creates a creative job from an approved package", async () => {
    const { service, jobModel, enqueue } = await loadJobService();
    const result = await service.createJob(baseCreateInput());
    expect(result.status).toBe("queued");
    expect(result.campaignPackageId).toBe("pkg-1");
    expect(jobModel.size()).toBe(1);
    expect(enqueue).toHaveBeenCalledOnce();
  });

  it("rejects invalid asset types", async () => {
    const { service } = await loadJobService();
    await expect(
      service.createJob(
        baseCreateInput({
          selectedAssetTypes: ["not_a_real_type" as never],
        }),
      ),
    ).rejects.toMatchObject({
      response: { code: "CREATIVE_ASSET_TYPE_INVALID" },
    });
  });

  it("enforces CREATIVE_MAX_TOTAL_ASSETS_PER_JOB", async () => {
    const manyBriefs = {
      ...approvedSource,
      briefs: Array.from({ length: 5 }, (_, i) => ({
        briefId: `img-${i}`,
        briefType: "image" as const,
      })),
    };
    const { service } = await loadJobService({
      source: manyBriefs,
      env: { CREATIVE_MAX_TOTAL_ASSETS_PER_JOB: "2" },
    });
    await expect(
      service.createJob(
        baseCreateInput({
          selectedAssetTypes: ["square_image", "portrait_image"],
          selectedPlatforms: ["facebook", "instagram"],
        }),
      ),
    ).rejects.toMatchObject({
      response: { code: "CREATIVE_GENERATION_LIMIT_EXCEEDED" },
    });
  });

  it("allows create when image provider is disabled (worker stubs later)", async () => {
    const { service, enqueue } = await loadJobService({
      env: { AI_IMAGE_PROVIDER: "disabled" },
    });
    const result = await service.createJob(baseCreateInput());
    expect(result.status).toBe("queued");
    expect(result.imageProviderPreference).toBe("disabled");
    expect(enqueue).toHaveBeenCalledOnce();
  });

  it("rejects openai preference when capability seed is missing", async () => {
    const { service } = await loadJobService({
      seed: {
        getCapabilityOrNull: () => Promise.resolve(null),
      },
    });
    await expect(
      service.createJob(
        baseCreateInput({ imageProviderPreference: "openai" }),
      ),
    ).rejects.toMatchObject({
      response: { code: "CREATIVE_PROVIDER_CAPABILITY_MISSING" },
    });
  });

  it("rejects when concurrency budget is exceeded for openai", async () => {
    const { BadRequestException } = await import("@nestjs/common");
    const { service } = await loadJobService({
      budget: {
        assertWithinConcurrencyLimits: () =>
          Promise.reject(
            new BadRequestException({
              code: "CREATIVE_GENERATION_LIMIT_EXCEEDED",
              message: "Active image job limit reached.",
            }),
          ),
      },
    });
    await expect(
      service.createJob(
        baseCreateInput({ imageProviderPreference: "openai" }),
      ),
    ).rejects.toMatchObject({
      response: { code: "CREATIVE_GENERATION_LIMIT_EXCEEDED" },
    });
  });

  it("keeps requiresReview true and ignores autoApprove on policy", async () => {
    const { service, jobModel } = await loadJobService({
      seed: {
        getActiveModelPolicyForProviders: () =>
          Promise.resolve({
            version: 1,
            autoApproveEnabled: true,
          }),
      },
    });
    const result = await service.createJob(
      baseCreateInput({ imageProviderPreference: "openai" }),
    );
    expect(result.requiresReview).toBe(true);
    expect(jobModel.size()).toBe(1);
  });
});
