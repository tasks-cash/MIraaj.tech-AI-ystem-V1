/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BadRequestException, ConflictException } from "@nestjs/common";
import { resetEnvironmentCache } from "../../../environment.js";
import { DistributionAssignmentModel, ProofSubmissionModel } from "../models/distribution.schema.js";
import { DistributionService } from "./distribution.service.js";

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
const mockAssignment = (overrides: Record<string, unknown> = {}) => ({ assignmentId: "a", externalAssignmentId: "ea-1", tenantId: "t", externalUserId: "u", status: "active", proofDeadlineAt: new Date(Date.now() + 60_000), occurrenceId: "occ-1", ...overrides });

describe("DistributionService proof upload session", () => {
  beforeEach(() => {
    Object.assign(process.env, baseEnv);
    resetEnvironmentCache();
    vi.clearAllMocks();
  });

  it("rejects when browser proof upload is disabled", async () => {
    process.env.CAMPAIGN_TASK_BROWSER_PROOF_UPLOAD_ENABLED = "false";
    resetEnvironmentCache();
    const service = new DistributionService(fakeAiClient as any, fakeStorage as any, fakeQueue as any);
    await expect(service.createProofUploadSession({ externalAssignmentId: "a", tenantId: "t", externalUserId: "u", screenshotCount: 1 }, "actor", "idem")).rejects.toThrow(ConflictException);
  });

  it("rejects invalid screenshot count", async () => {
    const service = new DistributionService(fakeAiClient as any, fakeStorage as any, fakeQueue as any);
    vi.spyOn(DistributionAssignmentModel, "findOne").mockReturnValue({ lean: () => Promise.resolve({ assignmentId: "a", tenantId: "t" }) } as any);
    await expect(service.createProofUploadSession({ externalAssignmentId: "a", tenantId: "t", externalUserId: "u", screenshotCount: 10 }, "actor", "idem")).rejects.toThrow(BadRequestException);
  });

  it("rejects unsupported file type and oversized file", async () => {
    const service = new DistributionService(fakeAiClient as any, fakeStorage as any, fakeQueue as any);
    vi.spyOn(DistributionAssignmentModel, "findOne").mockReturnValue({ lean: () => Promise.resolve({ assignmentId: "a", tenantId: "t" }) } as any);
    vi.spyOn(ProofSubmissionModel, "findOne").mockReturnValue({ lean: () => Promise.resolve(null) } as any);
    await expect(service.createProofUploadSession({ externalAssignmentId: "a", tenantId: "t", externalUserId: "u", screenshotCount: 1, files: [{ contentType: "image/gif" }] }, "actor", "idem")).rejects.toThrow(BadRequestException);
    await expect(service.createProofUploadSession({ externalAssignmentId: "a", tenantId: "t", externalUserId: "u", screenshotCount: 1, files: [{ contentType: "image/png", contentLength: 50_000_000 }] }, "actor", "idem")).rejects.toThrow(BadRequestException);
  });

  it("accepts matching occurrence id", async () => {
    const service = new DistributionService(fakeAiClient as any, fakeStorage as any, fakeQueue as any);
    vi.spyOn(DistributionAssignmentModel, "findOne").mockReturnValue({ lean: () => Promise.resolve(mockAssignment()) } as any);
    vi.spyOn(ProofSubmissionModel, "findOne").mockReturnValue({ lean: () => Promise.resolve(null) } as any);
    vi.spyOn(ProofSubmissionModel, "create").mockResolvedValue({ proofSubmissionId: "dps-1" } as any);
    const result = await service.createProofUploadSession({ externalAssignmentId: "a", tenantId: "t", externalUserId: "u", screenshotCount: 1, contentLength: 1000, occurrenceId: "occ-1" }, "actor", "idem");
    expect(result.proofSubmissionId).toBeDefined();
  });

  it("rejects mismatched occurrence id", async () => {
    const service = new DistributionService(fakeAiClient as any, fakeStorage as any, fakeQueue as any);
    vi.spyOn(DistributionAssignmentModel, "findOne").mockReturnValue({ lean: () => Promise.resolve(mockAssignment()) } as any);
    await expect(service.createProofUploadSession({ externalAssignmentId: "a", tenantId: "t", externalUserId: "u", screenshotCount: 1, occurrenceId: "occ-2" }, "actor", "idem")).rejects.toThrow(BadRequestException);
  });

  it("rejects occurrence id for non-recurring assignment", async () => {
    const service = new DistributionService(fakeAiClient as any, fakeStorage as any, fakeQueue as any);
    vi.spyOn(DistributionAssignmentModel, "findOne").mockReturnValue({ lean: () => Promise.resolve(mockAssignment({ occurrenceId: null })) } as any);
    await expect(service.createProofUploadSession({ externalAssignmentId: "a", tenantId: "t", externalUserId: "u", screenshotCount: 1, occurrenceId: "occ-1" }, "actor", "idem")).rejects.toThrow(BadRequestException);
  });

  it("preserves occurrence id when adding evidence", async () => {
    const service = new DistributionService(fakeAiClient as any, fakeStorage as any, fakeQueue as any);
    const proof = { proofSubmissionId: "dps-1", assignmentId: "a", occurrenceId: "occ-1", status: "more_evidence_required", evidenceRevision: 1, evidence: [], evidenceAttempts: [], save: vi.fn() };
    vi.spyOn(ProofSubmissionModel, "findOne").mockResolvedValueOnce(proof as any);
    vi.spyOn(DistributionAssignmentModel, "findOne").mockReturnValue({ lean: () => Promise.resolve(mockAssignment()) } as any);
    const result = await service.addEvidence("dps-1", { tenantId: "t", screenshotCount: 1, files: [{ contentType: "image/png", contentLength: 1000 }], occurrenceId: "occ-1" }, "u");
    expect(result.evidenceRevision).toBe(2);
  });

  it("throws on cross-occurrence additional evidence", async () => {
    const service = new DistributionService(fakeAiClient as any, fakeStorage as any, fakeQueue as any);
    const proof = { proofSubmissionId: "dps-1", assignmentId: "a", occurrenceId: "occ-1", status: "more_evidence_required", evidenceRevision: 1, evidence: [], evidenceAttempts: [], save: vi.fn() };
    vi.spyOn(ProofSubmissionModel, "findOne").mockResolvedValueOnce(proof as any);
    vi.spyOn(DistributionAssignmentModel, "findOne").mockReturnValue({ lean: () => Promise.resolve(mockAssignment()) } as any);
    await expect(service.addEvidence("dps-1", { tenantId: "t", screenshotCount: 1, files: [{ contentType: "image/png", contentLength: 1000 }], occurrenceId: "occ-2" }, "u")).rejects.toThrow(BadRequestException);
  });

  it("reconciles occurrence binding mismatches", async () => {
    const service = new DistributionService(fakeAiClient as any, fakeStorage as any, fakeQueue as any);
    vi.spyOn(ProofSubmissionModel, "find").mockReturnValueOnce({ select: () => ({ lean: () => Promise.resolve([{ proofSubmissionId: "dps-1", assignmentId: "a", occurrenceId: "occ-1" }]) }) } as any);
    vi.spyOn(DistributionAssignmentModel, "findOne").mockReturnValue({ lean: () => Promise.resolve({ assignmentId: "a", occurrenceId: "occ-2" }) } as any);
    const result = await service.reconcileOccurrenceBindings("t");
    expect(result.mismatches).toBe(1);
    expect(result.items[0]?.status).toBe("mismatch");
  });
});
