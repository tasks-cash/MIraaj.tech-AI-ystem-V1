import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetEnvironmentCache } from "../../environment.js";

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

/** Minimal in-memory upsert collection keyed by a unique field. */
function makeUpsertModel(key: string) {
  const store = new Map<string, Record<string, unknown>>();
  return {
    updateOne(
      filter: Record<string, unknown>,
      update: { $setOnInsert?: Record<string, unknown>; $set?: Record<string, unknown> },
    ) {
      const id = String(filter[key]);
      const existing = store.get(id) ?? { ...(update.$setOnInsert ?? {}) };
      Object.assign(existing, update.$set ?? {});
      store.set(id, existing);
      return Promise.resolve({ acknowledged: true });
    },
    countDocuments(filter: Record<string, unknown> = {}) {
      return Promise.resolve(
        [...store.values()].filter((doc) =>
          Object.entries(filter).every(([k, v]) => doc[k] === v),
        ).length,
      );
    },
    size: () => store.size,
  };
}

/** Minimal in-memory single-active-document collection (catalog version / policy). */
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

describe("Prompt 3 — catalog seed idempotency", () => {
  beforeEach(() => {
    Object.assign(process.env, baseEnv);
    resetEnvironmentCache();
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("./models/service-category.schema.js");
    vi.doUnmock("./models/service-catalog-item.schema.js");
    vi.doUnmock("./models/service-catalog-version.schema.js");
    vi.doUnmock("./models/service-matching-policy.schema.js");
    vi.doUnmock("./models/service-bundle-definition.schema.js");
    resetEnvironmentCache();
  });

  it("produces the same category/item/bundle counts when run twice", async () => {
    const categories = makeUpsertModel("code");
    const items = makeUpsertModel("slug");
    const bundles = makeUpsertModel("code");
    const versions = makeSingletonModel();
    const policies = makeSingletonModel();

    vi.doMock("./models/service-category.schema.js", () => ({
      ServiceCategoryModel: categories,
    }));
    vi.doMock("./models/service-catalog-item.schema.js", () => ({
      ServiceCatalogItemModel: items,
    }));
    vi.doMock("./models/service-catalog-version.schema.js", () => ({
      ServiceCatalogVersionModel: versions,
    }));
    vi.doMock("./models/service-matching-policy.schema.js", () => ({
      ServiceMatchingPolicyModel: policies,
    }));
    vi.doMock("./models/service-bundle-definition.schema.js", () => ({
      ServiceBundleDefinitionModel: bundles,
    }));

    const { CatalogSeedService } = await import(
      "./catalog/catalog-seed.service.js"
    );
    const { CATALOG_SEED_SERVICES, CATALOG_SEED_CATEGORIES, CATALOG_SEED_BUNDLES } =
      await import("./catalog/catalog-seed-data.js");

    const service = new CatalogSeedService();

    const first = await service.seedAll();
    expect(first.items).toBe(CATALOG_SEED_SERVICES.length);
    expect(first.categories).toBe(CATALOG_SEED_CATEGORIES.length);
    expect(first.bundles).toBe(CATALOG_SEED_BUNDLES.length);
    expect(first.catalogVersionActivated).toBe(true);
    expect(first.policyActivated).toBe(true);

    const second = await service.seedAll();
    expect(second.items).toBe(first.items);
    expect(second.categories).toBe(first.categories);
    expect(second.bundles).toBe(first.bundles);
    // Already active on the second pass — no duplicate activation.
    expect(second.catalogVersionActivated).toBe(false);
    expect(second.policyActivated).toBe(false);

    expect(items.size()).toBe(CATALOG_SEED_SERVICES.length);
    expect(categories.size()).toBe(CATALOG_SEED_CATEGORIES.length);
    expect(bundles.size()).toBe(CATALOG_SEED_BUNDLES.length);
    expect(versions.activeCount()).toBe(1);
    expect(policies.activeCount()).toBe(1);
  });

  it("declares 280+ unique service slugs across categories with no duplicates", async () => {
    const { CATALOG_SEED_SERVICES } = await import(
      "./catalog/catalog-seed-data.js"
    );
    expect(CATALOG_SEED_SERVICES.length).toBeGreaterThanOrEqual(280);
    const slugs = CATALOG_SEED_SERVICES.map((item) => item.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
