import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
} as const;

/** Minimal in-memory single-active-document collection (mirrors catalog-seed.test.ts). */
function makeSingletonModel() {
  const store: Record<string, unknown>[] = [];
  function attachSave(doc: Record<string, unknown>) {
    if (!("save" in doc)) {
      Object.defineProperty(doc, "save", {
        value: () => Promise.resolve(doc),
        enumerable: false,
      });
    }
    return doc;
  }
  function find(filter: Record<string, unknown>) {
    return store.find((doc) =>
      Object.entries(filter).every(([k, v]) => doc[k] === v),
    );
  }
  return {
    findOne(filter: Record<string, unknown>) {
      const found = find(filter) ?? null;
      return {
        lean: () => Promise.resolve(found ? { ...found } : null),
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve(found ? attachSave(found) : null).then(resolve),
      };
    },
    create(fields: Record<string, unknown>) {
      const doc = attachSave({ ...fields });
      store.push(doc);
      return Promise.resolve(doc);
    },
    activeCount: () => store.filter((doc) => doc.status === "active").length,
  };
}

describe("Prompt 4 — campaign intelligence seed idempotency", () => {
  beforeEach(() => {
    Object.assign(process.env, baseEnv);
    resetEnvironmentCache();
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("../../models/campaign-policy.schema.js");
    vi.doUnmock("../../models/prompt-version.schema.js");
    resetEnvironmentCache();
  });

  it("seeds brand profile, campaign/platform/compliance policy, and glossary exactly once", async () => {
    const brandProfiles = makeSingletonModel();
    const campaignPolicies = makeSingletonModel();
    const platformPolicies = makeSingletonModel();
    const compliancePolicies = makeSingletonModel();
    const glossaries = makeSingletonModel();
    const prompts = makeSingletonModel();

    vi.doMock("../../models/campaign-policy.schema.js", () => ({
      BrandProfileModel: brandProfiles,
      CampaignPolicyModel: campaignPolicies,
      PlatformPolicyModel: platformPolicies,
      CompliancePolicyModel: compliancePolicies,
      TranslationGlossaryModel: glossaries,
    }));
    vi.doMock("../../models/prompt-version.schema.js", () => ({
      PromptVersionModel: prompts,
    }));

    const { CampaignSeedService } = await import("../campaign-seed.service.js");
    const service = new CampaignSeedService();

    const first = await service.seedAll();
    expect(first.brandProfileActivated).toBe(true);
    expect(first.campaignPolicyActivated).toBe(true);
    expect(first.platformPolicyActivated).toBe(true);
    expect(first.compliancePolicyActivated).toBe(true);
    expect(first.glossaryActivated).toBe(true);

    const second = await service.seedAll();
    expect(second.brandProfileActivated).toBe(false);
    expect(second.campaignPolicyActivated).toBe(false);
    expect(second.platformPolicyActivated).toBe(false);
    expect(second.compliancePolicyActivated).toBe(false);
    expect(second.glossaryActivated).toBe(false);

    expect(brandProfiles.activeCount()).toBe(1);
    expect(campaignPolicies.activeCount()).toBe(1);
    expect(platformPolicies.activeCount()).toBe(1);
    expect(compliancePolicies.activeCount()).toBe(1);
    expect(glossaries.activeCount()).toBe(1);

    const brand = await service.getActiveBrandProfileOrThrow();
    expect(brand.brandName).toBe("Miraaj.tech");
    expect(brand.protectedTerms).toContain("Miraaj.tech");
    expect(brand.protectedTerms).toContain("Tasks.cash");

    const compliance = await service.getActiveCompliancePolicyOrThrow();
    expect(compliance.paymentDisclosures).toHaveProperty("en");
    expect(compliance.paymentDisclosures).toHaveProperty("ar");
    expect(compliance.paymentDisclosures).toHaveProperty("fr");
    expect(compliance.regulatedDomains).toContain("dental_clinic");

    const platformPolicy = await service.getActivePlatformPolicyOrThrow();
    expect(platformPolicy.platforms.length).toBeGreaterThanOrEqual(13);

    const glossary = await service.getActiveGlossaryOrThrow();
    expect(glossary.protectedTerms).toEqual(["Miraaj.tech", "Tasks.cash"]);
  });
});
