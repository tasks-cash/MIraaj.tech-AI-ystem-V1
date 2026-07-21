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
  AI_IMAGE_PROVIDER: "disabled",
  AI_VIDEO_PROVIDER: "disabled",
  AI_RENDER_PROVIDER: "local",
  AI_CREATIVE_WORKER_CONCURRENCY: "1",
  AI_CREATIVE_STALE_SECONDS: "1200",
  AI_CREATIVE_RECONCILE_INTERVAL_SECONDS: "60",
  AI_CREATIVE_MAX_RETRIES: "3",
  CREATIVE_MAX_TOTAL_ASSETS_PER_JOB: "40",
  CREATIVE_MAX_VARIANTS_PER_BRIEF: "4",
  CREATIVE_MAX_IMAGE_BYTES: "52428800",
  CREATIVE_MAX_VIDEO_BYTES: "1073741824",
  CREATIVE_AUTO_APPROVE_ENABLED: "false",
} as const;

interface FakeJobRecord {
  creativeJobId: string;
  campaignPackageId: string;
  campaignPackageRevision: number;
  status: string;
  selectedBriefIds: string[];
  selectedAssetTypes: string[];
  selectedPlatforms: string[];
  targetLanguages: string[];
  targetLocales: string[];
  imageProviderPreference: string;
  videoProviderPreference: string;
  renderProviderPreference: string;
  allowOverride?: boolean;
  generationFingerprint: string;
  correlationId: string;
  requestedBy: string;
  attempts: number;
  maxAttempts: number;
  reviewReasonCodes: string[];
  brandProfileVersion: number;
  platformPolicyVersion: number;
  compliancePolicyVersion: number;
  [key: string]: unknown;
}

function makeJobRecord(overrides: Partial<FakeJobRecord> = {}): FakeJobRecord {
  return {
    creativeJobId: "cjob-1",
    campaignPackageId: "pkg-1",
    campaignPackageRevision: 1,
    status: "queued",
    selectedBriefIds: ["img-1"],
    selectedAssetTypes: ["square_image"],
    selectedPlatforms: ["facebook"],
    targetLanguages: ["en"],
    targetLocales: ["en-US"],
    imageProviderPreference: "disabled",
    videoProviderPreference: "disabled",
    renderProviderPreference: "local",
    generationFingerprint: "fp-1",
    correlationId: "corr-1",
    requestedBy: "admin-1",
    attempts: 0,
    maxAttempts: 3,
    reviewReasonCodes: [],
    brandProfileVersion: 1,
    platformPolicyVersion: 1,
    compliancePolicyVersion: 1,
    ...overrides,
  };
}

function makeJobModel(job: FakeJobRecord) {
  const store = job;
  return {
    findOne(filter: Record<string, unknown>) {
      return Promise.resolve(
        store.creativeJobId === filter.creativeJobId ? store : null,
      );
    },
    findOneAndUpdate(
      filter: Record<string, unknown>,
      update: Record<string, unknown>,
    ) {
      const matches =
        store.creativeJobId === filter.creativeJobId &&
        (filter.status === undefined || store.status === filter.status);
      if (!matches) return Promise.resolve(null);
      Object.assign(store, update);
      return Promise.resolve({ ...store });
    },
    updateOne(filter: Record<string, unknown>, update: Record<string, unknown>) {
      if (store.creativeJobId === filter.creativeJobId) {
        Object.assign(store, update);
      }
      return Promise.resolve({ acknowledged: true });
    },
    find() {
      return { lean: () => Promise.resolve([]) };
    },
    snapshot: () => ({ ...store }),
  };
}

function makeCollector() {
  const items: Array<Record<string, unknown>> = [];
  return {
    create(fields: Record<string, unknown>) {
      const doc = { ...fields };
      items.push(doc);
      return Promise.resolve(doc);
    },
    updateOne() {
      return Promise.resolve({ acknowledged: true });
    },
    find() {
      return {
        limit: () => ({ lean: () => Promise.resolve([]) }),
        lean: () => Promise.resolve([]),
      };
    },
    items,
  };
}

function dentalSource(overrides: Record<string, unknown> = {}) {
  return {
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
      reviewReasonCodes: ["regulated_domain"],
      selectedServices: ["dental_clinic_management"],
      correlationId: "corr-1",
      createdBy: "admin-1",
    },
    briefs: [
      {
        briefId: "img-1",
        briefType: "image" as const,
        textOverlay: "Modern dental clinic systems",
        expectedText: "Modern dental clinic systems",
      },
    ],
    reviewReasonCodes: ["medical_campaign"],
    ...overrides,
  };
}

async function loadWorker(input: {
  job: FakeJobRecord;
  source?: ReturnType<typeof dentalSource> | PromiseLike<never>;
  eligibilityReject?: Error;
}) {
  vi.resetModules();
  resetEnvironmentCache();
  Object.assign(process.env, baseEnv);

  const jobModel = makeJobModel(input.job);
  const attemptCollector = makeCollector();
  const assetCollector = makeCollector();
  const rightsCollector = makeCollector();
  const provenanceCollector = makeCollector();
  const variantCollector = makeCollector();

  vi.doMock("../../models/creative.schema.js", () => ({
    CreativeGenerationJobModel: jobModel,
    CreativeGenerationAttemptModel: attemptCollector,
    CreativeAssetModel: assetCollector,
    AssetRightsRecordModel: rightsCollector,
    CreativeProvenanceManifestModel: provenanceCollector,
    CreativeAssetVariantModel: variantCollector,
    CreativeRenderSpecificationModel: {
      find: () => ({
        limit: () => ({ lean: () => Promise.resolve([]) }),
      }),
    },
  }));

  const eligibility = {
    loadAndValidate: async () => {
      if (input.eligibilityReject) {
        throw input.eligibilityReject;
      }
      return input.source ?? dentalSource();
    },
  };

  const { CreativeWorkerService } = await import("../creative-worker.service.js");
  const { CreativeValidationService } = await import(
    "../creative-validation.service.js"
  );
  const { CreativeQualityService } = await import(
    "../creative-quality.service.js"
  );

  const worker = new CreativeWorkerService(
    {
      moveToDeadLetter: vi.fn(),
      enqueueBuildCreativeJob: vi.fn(),
    } as never,
    {
      postCreativeGenerateImage: vi.fn().mockResolvedValue({ ok: true }),
      postCreativeGenerateVideo: vi.fn().mockResolvedValue({ ok: true }),
      postCreativeValidateMedia: vi.fn().mockResolvedValue({ ok: true }),
      postCreativeOcrCheck: vi
        .fn()
        .mockResolvedValue({ ocrText: "Modern dental clinic systems" }),
      postCreativeRenderTextOverlay: vi.fn().mockResolvedValue({ ok: true }),
      postCreativeRenderSubtitles: vi.fn().mockResolvedValue({ ok: true }),
    } as never,
    eligibility as never,
    new CreativeValidationService(),
    new CreativeQualityService(),
    {
      bucket: "miraaj-test",
      buildAssetObjectKey: () => "creative/assets/x.png",
      buildVariantObjectKey: () => "creative/variants/x.png",
      putBinaryObject: vi.fn().mockResolvedValue(undefined),
    } as never,
  );

  return {
    worker,
    jobModel,
    assetCollector,
    rightsCollector,
    process: () =>
      (worker as unknown as { process: (job: { data: unknown }) => Promise<void> }).process({
        data: {
          creativeJobId: input.job.creativeJobId,
          campaignPackageId: input.job.campaignPackageId,
        },
      }),
  };
}

describe("Prompt 5 — CreativeWorkerService scenarios", () => {
  beforeEach(() => {
    resetEnvironmentCache();
    Object.assign(process.env, baseEnv);
  });

  afterEach(() => {
    resetEnvironmentCache();
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("A — dental/medical package always requires medical review reasons", async () => {
    const { process, jobModel, assetCollector } = await loadWorker({
      job: makeJobRecord(),
      source: dentalSource(),
    });
    await process();
    const snap = jobModel.snapshot();
    expect(snap.status).toBe("provider_unavailable");
    expect(snap.reviewReasonCodes).toContain("medical_campaign");
    expect(assetCollector.items[0]?.requiresReview).toBe(true);
  });

  it("B — patient exclusion via unapproved package fails closed", async () => {
    const { BadRequestException } = await import("@nestjs/common");
    const { process, jobModel } = await loadWorker({
      job: makeJobRecord(),
      eligibilityReject: new BadRequestException({
        code: "CREATIVE_SOURCE_NOT_APPROVED",
        message: "Only approved packages allowed.",
      }),
    });
    await expect(process()).rejects.toBeInstanceOf(BadRequestException);
    expect(jobModel.snapshot().status).toBe("failed");
  });

  it("C — restaurant brief creates awaiting stubs when providers disabled", async () => {
    const { process, assetCollector } = await loadWorker({
      job: makeJobRecord(),
      source: dentalSource({
        campaignPackage: {
          ...dentalSource().campaignPackage,
          selectedServices: ["restaurant_management"],
          reviewReasonCodes: [],
        },
        briefs: [
          {
            briefId: "img-1",
            briefType: "image",
            textOverlay: "Restaurant operations with Miraaj.tech",
          },
        ],
        reviewReasonCodes: [],
      }),
    });
    await process();
    expect(assetCollector.items[0]?.status).toBe("provider_unavailable");
    expect(assetCollector.items[0]?.objectKey).toBeUndefined();
  });

  it("E — payment disclosure missing is flagged on assets", async () => {
    const { process, assetCollector } = await loadWorker({
      job: makeJobRecord(),
      source: dentalSource({
        campaignPackage: {
          ...dentalSource().campaignPackage,
          reviewReasonCodes: ["payment_service"],
          requiredDisclosures: {},
        },
        briefs: [
          {
            briefId: "img-1",
            briefType: "image",
            textOverlay: "Accept payments with Tasks.cash",
          },
        ],
        reviewReasonCodes: ["payment_campaign"],
      }),
    });
    await process();
    expect(assetCollector.items[0]?.reviewReasonCodes).toEqual(
      expect.arrayContaining(["payment_campaign"]),
    );
  });

  it("I — provider disabled sets job provider_unavailable without inventing bytes", async () => {
    const { process, jobModel, assetCollector, rightsCollector } =
      await loadWorker({
        job: makeJobRecord({ imageProviderPreference: "disabled" }),
      });
    await process();
    expect(jobModel.snapshot().status).toBe("provider_unavailable");
    expect(assetCollector.items[0]?.status).toBe("provider_unavailable");
    expect(assetCollector.items[0]?.objectKey).toBeUndefined();
    expect(rightsCollector.items[0]?.status).toBe("unknown");
  });

  it("K — fake testimonial text is flagged", async () => {
    const { process, assetCollector } = await loadWorker({
      job: makeJobRecord(),
      source: dentalSource({
        briefs: [
          {
            briefId: "img-1",
            briefType: "image",
            textOverlay: "A fake testimonial from our best patient",
          },
        ],
      }),
    });
    await process();
    expect(assetCollector.items[0]?.reviewReasonCodes).toEqual(
      expect.arrayContaining(["fake_testimonial_risk"]),
    );
  });

  it("M — OCR mismatch is recorded when expected/ocr differ", async () => {
    // Direct validation path used by worker for OCR mismatch.
    const { CreativeValidationService } = await import(
      "../creative-validation.service.js"
    );
    const result = new CreativeValidationService().validate({
      brandName: "Miraaj.tech",
      expectedText: "Book with Miraaj.tech",
      ocrText: "Different OCR text",
      involvesPayment: false,
      paymentDisclosureRequired: null,
      isMedicalOrLegal: false,
      rightsStatus: "verified",
    });
    expect(result.errorCodes).toContain("CREATIVE_OCR_MISMATCH");
  });

  it("N — unknown rights are always created for disabled provider stubs", async () => {
    const { process, rightsCollector } = await loadWorker({
      job: makeJobRecord({ imageProviderPreference: "disabled" }),
    });
    await process();
    expect(rightsCollector.items[0]?.status).toBe("unknown");
    expect(rightsCollector.items[0]?.ownershipType).toBe("unknown");
  });
});
