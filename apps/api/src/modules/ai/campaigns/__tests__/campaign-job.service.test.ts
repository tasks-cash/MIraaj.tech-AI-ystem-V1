import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetEnvironmentCache } from "../../../../environment.js";
import type { CreateCampaignJobInput } from "../campaign-job.service.js";

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
} as const;

function matchesFilter(doc: Record<string, unknown>, filter: Record<string, unknown>): boolean {
  return Object.entries(filter).every(([key, value]) => {
    if (value && typeof value === "object" && "$nin" in (value as Record<string, unknown>)) {
      const list = (value as { $nin: unknown[] }).$nin;
      return !list.includes(doc[key]);
    }
    if (value && typeof value === "object" && "$in" in (value as Record<string, unknown>)) {
      const list = (value as { $in: unknown[] }).$in;
      return list.includes(doc[key]);
    }
    return doc[key] === value;
  });
}

/** Minimal in-memory fake mirroring the CampaignJobModel surface the service needs. */
function makeCampaignJobModel() {
  const store: Record<string, unknown>[] = [];
  function attachHelpers(doc: Record<string, unknown>) {
    if (!("save" in doc)) {
      Object.defineProperty(doc, "save", { value: () => Promise.resolve(doc), enumerable: false });
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

function makeFakeRedis() {
  let counter = 0;
  return { incr: () => Promise.resolve(++counter), expire: () => Promise.resolve(1) };
}

const approvedSource = {
  recommendationSet: { setId: "rec-1", revision: 1 },
  businessProfile: {
    profileId: "profile-1",
    audienceType: { code: "dentist" },
    businessType: { code: "dental_clinic" },
  },
  selectedServices: [
    { itemSlug: "dental_clinic_management", state: "recommended", isPaymentService: false },
  ],
  reviewReasonCodes: [] as string[],
};

const basePolicies = {
  campaignPolicy: { version: 1, maxServices: 5, maxPlatforms: 3, maxLanguages: 3 },
  brandProfile: { version: 1 },
  platformPolicy: { version: 1 },
  compliancePolicy: { version: 1 },
};

function makeFakeSeed(overrides: Partial<typeof basePolicies> = {}) {
  const merged = { ...basePolicies, ...overrides };
  return {
    getActiveCampaignPolicyOrThrow: () => Promise.resolve(merged.campaignPolicy),
    getActiveBrandProfileOrThrow: () => Promise.resolve(merged.brandProfile),
    getActivePlatformPolicyOrThrow: () => Promise.resolve(merged.platformPolicy),
    getActiveCompliancePolicyOrThrow: () => Promise.resolve(merged.compliancePolicy),
  };
}

function baseCreateInput(
  overrides: Partial<CreateCampaignJobInput> = {},
): CreateCampaignJobInput {
  return {
    recommendationSetId: "rec-1",
    selectedServiceIds: ["dental_clinic_management"],
    campaignType: "single_service_campaign",
    objective: "brand_awareness",
    funnelStage: "awareness",
    selectedPlatforms: ["facebook"],
    targetLanguages: ["en"],
    targetLocales: ["en-US"],
    requestedBy: "admin-1",
    ...overrides,
  };
}

async function loadJobService(options?: {
  source?: typeof approvedSource;
  seedOverrides?: Partial<typeof basePolicies>;
}) {
  vi.resetModules();
  const jobModel = makeCampaignJobModel();
  vi.doMock("../../models/campaign.schema.js", () => ({ CampaignJobModel: jobModel }));

  const { CampaignJobService } = await import("../campaign-job.service.js");

  const infrastructure = { getRedis: () => makeFakeRedis() };
  const eligibility = {
    loadAndValidate: () => Promise.resolve(options?.source ?? approvedSource),
  };
  const seed = makeFakeSeed(options?.seedOverrides);
  const enqueueSpy = vi.fn(() => Promise.resolve({ id: "bull-1" }));
  const queue = { enqueueBuildCampaign: enqueueSpy };

  const service = new CampaignJobService(
    infrastructure as never,
    eligibility as never,
    seed as never,
    queue as never,
  );
  return { service, enqueueSpy, jobModel };
}

describe("Prompt 4 — CampaignJobService idempotency and limits", () => {
  beforeEach(() => {
    Object.assign(process.env, baseEnv);
    resetEnvironmentCache();
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("../../models/campaign.schema.js");
    resetEnvironmentCache();
  });

  it("creates a new job on the first request and enqueues it exactly once", async () => {
    const { service, enqueueSpy, jobModel } = await loadJobService();
    const result = await service.createJob(baseCreateInput());

    expect(result.reused).toBe(false);
    expect(result.status).toBe("queued");
    expect(enqueueSpy).toHaveBeenCalledTimes(1);
    expect(jobModel.size()).toBe(1);
  });

  it("returns the existing job for an identical request instead of creating a duplicate (Scenario: idempotency)", async () => {
    const { service, enqueueSpy, jobModel } = await loadJobService();
    const first = await service.createJob(baseCreateInput());
    const second = await service.createJob(baseCreateInput());

    expect(second.reused).toBe(true);
    expect(second.campaignJobId).toBe(first.campaignJobId);
    expect(enqueueSpy).toHaveBeenCalledTimes(1);
    expect(jobModel.size()).toBe(1);
  });

  it("honors an explicit idempotency key across otherwise-different requests", async () => {
    const { service, enqueueSpy } = await loadJobService();
    const first = await service.createJob(
      baseCreateInput({ idempotencyKey: "client-key-1" }),
    );
    const second = await service.createJob(
      baseCreateInput({ idempotencyKey: "client-key-1", campaignName: "Different name" }),
    );

    expect(second.reused).toBe(true);
    expect(second.campaignJobId).toBe(first.campaignJobId);
    expect(enqueueSpy).toHaveBeenCalledTimes(1);
  });

  it("creates a fresh job when forceRegeneration is set, even with an identical fingerprint", async () => {
    const { service, enqueueSpy, jobModel } = await loadJobService();
    const first = await service.createJob(baseCreateInput());
    const second = await service.createJob(
      baseCreateInput({ forceRegeneration: true }),
    );

    expect(second.reused).toBe(false);
    expect(second.campaignJobId).not.toBe(first.campaignJobId);
    expect(enqueueSpy).toHaveBeenCalledTimes(2);
    expect(jobModel.size()).toBe(2);
  });

  it("rejects requests exceeding the active campaign policy's service/platform/language limits", async () => {
    const { service } = await loadJobService({
      seedOverrides: {
        campaignPolicy: { version: 1, maxServices: 1, maxPlatforms: 1, maxLanguages: 1 },
      },
    });

    await expect(
      service.createJob(baseCreateInput({ selectedPlatforms: ["facebook", "instagram"] })),
    ).rejects.toMatchObject({ response: { code: "CAMPAIGN_TOO_MANY_PLATFORMS" } });
  });

  it("Scenario E — always requires review and flags payment_service when a selected service is a payment service", async () => {
    const paymentSource = {
      ...approvedSource,
      businessProfile: {
        ...approvedSource.businessProfile,
        businessType: { code: "ecommerce" },
      },
      selectedServices: [
        { itemSlug: "stripe_integration", state: "recommended", isPaymentService: true },
      ],
    };
    const { service } = await loadJobService({ source: paymentSource });
    const result = await service.createJob(
      baseCreateInput({ selectedServiceIds: ["stripe_integration"] }),
    );

    expect(result.requiresReview).toBe(true);
    expect(result.reviewReasonCodes).toContain("payment_service");
  });

  it("always requires review and flags regulated_domain for regulated business types", async () => {
    const { service } = await loadJobService();
    const result = await service.createJob(baseCreateInput());

    expect(result.requiresReview).toBe(true);
    expect(result.reviewReasonCodes).toContain("regulated_domain");
  });

  it("rejects an unsupported campaign objective before touching eligibility or the database", async () => {
    const { service, jobModel } = await loadJobService();
    await expect(
      service.createJob(
        baseCreateInput({ objective: "not_a_real_objective" as never }),
      ),
    ).rejects.toMatchObject({ response: { code: "CAMPAIGN_OBJECTIVE_INVALID" } });
    expect(jobModel.size()).toBe(0);
  });
});
