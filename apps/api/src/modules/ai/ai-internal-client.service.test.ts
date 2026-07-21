import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetEnvironmentCache } from "../../environment.js";
import { AiInternalClientService } from "./ai-internal-client.service.js";
import {
  AiServiceTimeoutError,
  AiServiceUnavailableError,
} from "./types/ai-errors.js";
import { AiHealthService } from "./ai-health.service.js";

vi.mock("./models/analysis-job.schema.js", () => ({
  AnalysisJobModel: {
    countDocuments: vi.fn().mockResolvedValue(0),
  },
}));

vi.mock("./models/analysis-result.schema.js", () => ({
  AnalysisResultModel: {
    countDocuments: vi.fn().mockResolvedValue(0),
  },
}));

vi.mock("../../s3-client.js", () => ({
  createS3Client: vi.fn(() => ({
    send: vi.fn().mockRejectedValue(new Error("minio unavailable")),
  })),
}));

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

describe("AI internal client", () => {
  beforeEach(() => {
    Object.assign(process.env, baseEnv);
    resetEnvironmentCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetEnvironmentCache();
  });

  it("propagates request and correlation IDs on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          status: "ok",
          service: "miraaj-ai-service",
          version: "0.1.0",
          environment: "test",
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = new AiInternalClientService();
    const result = await client.getHealth({
      requestId: "23a9022a-6d80-4a1e-b6a8-ea13bea7371e",
      correlationId: "corr-23a9022a",
    });

    expect(result.status).toBe("ok");
    const call = fetchMock.mock.calls[0] as
      | [string, { headers: Record<string, string> }]
      | undefined;
    const headers = call?.[1].headers;
    expect(headers?.["x-miraaj-request-id"]).toBe(
      "23a9022a-6d80-4a1e-b6a8-ea13bea7371e",
    );
    expect(headers?.["x-miraaj-correlation-id"]).toBe("corr-23a9022a");
    expect(headers?.["x-miraaj-signature"]).toMatch(/^[a-f0-9]{64}$/);
  });

  it("maps timeouts to a safe error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_url: string, init?: { signal?: AbortSignal }) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const error = new Error("Aborted");
            error.name = "AbortError";
            reject(error);
          });
        });
      }),
    );
    const client = new AiInternalClientService();
    await expect(client.getHealth()).rejects.toBeInstanceOf(AiServiceTimeoutError);
  });

  it("maps unavailable responses to a safe error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: () => Promise.resolve({}),
      }),
    );
    const client = new AiInternalClientService();
    await expect(client.getReady()).rejects.toBeInstanceOf(
      AiServiceUnavailableError,
    );
  });
});

describe("AI health service", () => {
  beforeEach(() => {
    Object.assign(process.env, baseEnv);
    resetEnvironmentCache();
  });

  it("returns a safe unavailable status without secrets", async () => {
    const client = {
      getHealth: vi.fn().mockRejectedValue(new AiServiceUnavailableError()),
      getReady: vi.fn(),
      getVersion: vi.fn(),
    };
    const service = new AiHealthService(
      client as unknown as AiInternalClientService,
      {
        dependencyStatus: () =>
          Promise.resolve({ mongo: "ready" as const, redis: "ready" as const }),
      } as never,
      {
        getQueueStats: () =>
          Promise.resolve({
            validate: { waiting: 0, active: 0, completed: 0, failed: 0 },
            analyze: { waiting: 0, active: 0, completed: 0, failed: 0 },
            deadLetter: { waiting: 0, active: 0, completed: 0, failed: 0 },
          }),
      } as never,
      {
        getQueueStats: () =>
          Promise.resolve({
            intelligence: {
              waiting: 0,
              active: 0,
              completed: 0,
              failed: 0,
              delayed: 0,
            },
            deadLetter: { waiting: 0, active: 0, completed: 0, failed: 0 },
          }),
        deadLetterQueue: {
          getFailedCount: () => Promise.resolve(0),
          getWaitingCount: () => Promise.resolve(0),
        },
      } as never,
      {
        reconcileStaleJobs: () => Promise.resolve(0),
      } as never,
      {
        getQueueStats: () =>
          Promise.resolve({
            campaigns: { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 },
            deadLetter: { waiting: 0, active: 0, completed: 0, failed: 0 },
          }),
      } as never,
      {
        getActiveBrandProfileOrThrow: () => Promise.reject(new Error("not found")),
        getActiveCampaignPolicyOrThrow: () => Promise.reject(new Error("not found")),
        getActivePlatformPolicyOrThrow: () => Promise.reject(new Error("not found")),
        getActiveCompliancePolicyOrThrow: () => Promise.reject(new Error("not found")),
        getActiveGlossaryOrThrow: () => Promise.reject(new Error("not found")),
      } as never,
      {
        getQueueStats: () =>
          Promise.resolve({
            creative: { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 },
            deadLetter: { waiting: 0, active: 0, completed: 0, failed: 0 },
          }),
      } as never,
      {
        getActiveModelPolicyOrThrow: () => Promise.reject(new Error("not found")),
      } as never,
      {
        getStatus: () => ({
          state: "ready",
          droppedAuditWrites: 0,
          traceExporterState: "disabled",
          metricsExporterState: "disabled",
        }),
      } as never,
    );
    const status = await service.getSystemStatus();
    expect(status.error?.code).toBe("AI_SERVICE_UNAVAILABLE");
    expect(JSON.stringify(status)).not.toContain(
      baseEnv.AI_SERVICE_INTERNAL_SECRET,
    );
    expect(JSON.stringify(status)).not.toContain(baseEnv.ADMIN_API_TOKEN);
  });
});
