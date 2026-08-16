/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetEnvironmentCache } from "../../../environment.js";
import { DistributionAssignmentModel, ProofSubmissionModel, TrackedLinkModel } from "../models/distribution.schema.js";
import { DistributionService } from "./distribution.service.js";
import { TASKS_CASH_DISTRIBUTION_API_VERSION } from "./distribution.contracts.js";

const baseEnv = {
  NODE_ENV: "test", APP_ENV: "test", LOG_LEVEL: "error",
  MONGODB_URI: "mongodb://localhost:27020/miraaj_test", REDIS_URL: "redis://localhost:6383",
  S3_ENDPOINT: "http://localhost:9200", S3_REGION: "us-east-1", S3_BUCKET: "miraaj-test",
  S3_ACCESS_KEY_ID: "test-key", S3_SECRET_ACCESS_KEY: "test-secret-value-with-enough-chars", S3_FORCE_PATH_STYLE: "true",
  ENCRYPTION_KEY_ID: "test-v1", ENCRYPTION_MASTER_KEY: "test-only-encryption-key-with-32-characters",
  API_HOST: "127.0.0.1", API_PORT: "4200", AI_SERVICE_URL: "http://127.0.0.1:8200",
  AI_SERVICE_HOST: "127.0.0.1", AI_SERVICE_PORT: "8200", AI_SERVICE_ID: "miraaj-api",
  AI_SERVICE_INTERNAL_SECRET: "test-only-internal-secret-with-32-characters",
  AI_SERVICE_REQUEST_TIMEOUT_MS: "5000", AI_SERVICE_REPLAY_WINDOW_SECONDS: "120", AI_SERVICE_VERSION: "0.1.0",
  TEMPORARY_ADMIN_TOKEN_ENABLED: "true", ALLOW_TEMPORARY_ADMIN_TOKEN_IN_PRODUCTION: "false",
  ADMIN_API_TOKEN: "test-only-admin-token-with-32-characters!!",
  CAMPAIGN_TASK_PARTICIPANT_API_TOKEN: "test-only-participant-token-with-32-chars",
  DISTRIBUTION_ASSIGNMENT_CREATION_ENABLED: "true", DISTRIBUTION_EMERGENCY_ASSIGNMENT_STOP: "false",
  DISTRIBUTION_PROOF_PROCESSING_ENABLED: "true", DISTRIBUTION_EMERGENCY_PROOF_STOP: "false",
  CAMPAIGN_TASK_BROWSER_PROOF_UPLOAD_ENABLED: "true", DISTRIBUTION_MAX_SCREENSHOTS: "5",
  DISTRIBUTION_MAX_SCREENSHOT_BYTES: "20971520", DISTRIBUTION_PROOF_RETENTION_DAYS: "90",
} as const;

const fakeStorage = {
  createPresignedUpload: vi.fn().mockResolvedValue({ uploadUrl: "http://localhost/upload", expiresAt: new Date().toISOString() }),
  headObject: vi.fn(),
  deletePrivateObject: vi.fn(),
};

const fakeAiClient = { getHealth: vi.fn(), getReady: vi.fn(), getVersion: vi.fn(), getOcrStatus: vi.fn(), getProvidersStatus: vi.fn() };
const fakeQueue = { enqueueProof: vi.fn(), enqueueOutbox: vi.fn(), onModuleDestroy: vi.fn() };

describe("DistributionService Tasks.cash idempotency", () => {
  beforeEach(() => {
    Object.assign(process.env, baseEnv);
    resetEnvironmentCache();
    vi.clearAllMocks();
  });

  it("returns a safe proof upload session on repeated idempotency-key", async () => {
    const service = new DistributionService(fakeAiClient as any, fakeStorage as any, fakeQueue as any);
    const assignment = { assignmentId: "a", tenantId: "t", externalAssignmentId: "ea", externalUserId: "u", status: "active", proofDeadlineAt: new Date(Date.now() + 60_000), occurrenceId: "occ-1" };
    vi.spyOn(DistributionAssignmentModel, "findOne").mockReturnValue({ lean: () => Promise.resolve(assignment) } as any);
    const existing = { proofSubmissionId: "dps-existing", evidence: [{ evidenceId: "ev-1", kind: "screenshot", contentType: "image/png", uploadUrl: "http://upload", uploadExpiresAt: new Date().toISOString() }] };
    vi.spyOn(ProofSubmissionModel, "findOne").mockReturnValue({ lean: () => Promise.resolve(existing) } as any);
    const result = await service.createProofUploadSession({ externalAssignmentId: "ea", tenantId: "t", externalUserId: "u", screenshotCount: 1, contentLength: 1000, occurrenceId: "occ-1" }, "actor", "idem-key");
    expect(result.proofSubmissionId).toBe("dps-existing");
    expect(result.apiVersion).toBe(TASKS_CASH_DISTRIBUTION_API_VERSION);
    expect(result.evidence[0]?.uploadUrl).toBe("http://upload");
    expect(result.evidence[0]).not.toHaveProperty("objectKey");
  });

  it("cancels an assignment idempotently", async () => {
    const service = new DistributionService(fakeAiClient as any, fakeStorage as any, fakeQueue as any);
    const existing = { assignmentId: "a", externalAssignmentId: "ea", externalUserId: "u", status: "cancelled", rewardEligibilityRecommendation: "not_eligible" };
    vi.spyOn(DistributionAssignmentModel, "findOneAndUpdate").mockResolvedValue(null);
    vi.spyOn(DistributionAssignmentModel, "findOne").mockReturnValue({ lean: () => Promise.resolve(existing) } as any);
    vi.spyOn(TrackedLinkModel, "updateOne").mockResolvedValue({} as any);
    const result = await service.cancelAssignment("ea", "u");
    expect(result.status).toBe("cancelled");
    expect(result.externalAssignmentId).toBe("ea");
  });

  it("completes a proof idempotently after it is already queued", async () => {
    const service = new DistributionService(fakeAiClient as any, fakeStorage as any, fakeQueue as any);
    const proof = { proofSubmissionId: "dps-1", externalAssignmentId: "ea", externalUserId: "u", status: "queued", submittedAt: new Date().toISOString() };
    vi.spyOn(ProofSubmissionModel, "findOne").mockResolvedValue(proof as any);
    const result = await service.completeProof("dps-1", "u");
    expect(result.proofSubmissionId).toBe("dps-1");
    expect(result.status).toBe("queued");
  });
});
