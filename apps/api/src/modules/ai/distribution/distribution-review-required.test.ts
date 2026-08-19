/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetEnvironmentCache } from "../../../environment.js";
import { DistributionAssignmentModel, IntegrationOutboxEventModel } from "../models/distribution.schema.js";
import { DistributionService } from "./distribution.service.js";
import {
  PROOF_VERIFICATION_EVENT_TYPE,
  PROOF_VERIFICATION_REVIEW_REQUIRED_EVENT_TYPE,
  proofVerificationCompletedEventSchema,
  proofVerificationReviewRequiredEventSchema,
  signProofCallback,
} from "./distribution.contracts.js";

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

describe("DistributionService review-required outbox event", () => {
  beforeEach(() => {
    Object.assign(process.env, baseEnv);
    resetEnvironmentCache();
    vi.clearAllMocks();
  });

  it("creates a proof.verification.review_required event for a needs_review decision", async () => {
    const service = new DistributionService(fakeAiClient as any, fakeStorage as any, fakeQueue as any);
    const assignment = { assignmentId: "a", externalAssignmentId: "ea", externalUserId: "u", externalTaskId: "t", tenantId: "tenant" };
    vi.spyOn(DistributionAssignmentModel, "findOne").mockReturnValue({ lean: () => Promise.resolve(assignment) } as any);
    const created: any[] = [];
    vi.spyOn(IntegrationOutboxEventModel, "create").mockImplementation((doc) => {
      created.push(doc);
      return Promise.resolve(doc) as unknown as Promise<any[]>;
    });
    const proof = { assignmentId: "a", proofSubmissionId: "dps-1", correlationId: "corr-1" };
    const attempt = { scores: { overallVerificationScore: 0.82 }, reasonCodes: ["HUMAN_REVIEW_REQUIRED"], resultChecksum: "abc" };
    await service.createOutboxEvent(proof, "needs_review", "pending_review", attempt, PROOF_VERIFICATION_REVIEW_REQUIRED_EVENT_TYPE);
    expect(fakeQueue.enqueueOutbox).toHaveBeenCalledWith(expect.stringMatching(/^evt_/));
    expect(created).toHaveLength(1);
    expect(created[0].eventType).toBe(PROOF_VERIFICATION_REVIEW_REQUIRED_EVENT_TYPE);
    const payload = created[0].payload;
    expect(payload.eventType).toBe(PROOF_VERIFICATION_REVIEW_REQUIRED_EVENT_TYPE);
    expect(payload.verificationDecision).toBe("needs_review");
    expect(payload.rewardEligibilityRecommendation).toBe("pending_review");
    expect(proofVerificationReviewRequiredEventSchema.safeParse(payload).success).toBe(true);
    expect(proofVerificationCompletedEventSchema.safeParse(payload).success).toBe(false);
  });

  it("keeps proof.verification.completed for verified decisions", async () => {
    const service = new DistributionService(fakeAiClient as any, fakeStorage as any, fakeQueue as any);
    const assignment = { assignmentId: "a", externalAssignmentId: "ea", externalUserId: "u", externalTaskId: "t", tenantId: "tenant" };
    vi.spyOn(DistributionAssignmentModel, "findOne").mockReturnValue({ lean: () => Promise.resolve(assignment) } as any);
    const created: any[] = [];
    vi.spyOn(IntegrationOutboxEventModel, "create").mockImplementation((doc) => {
      created.push(doc);
      return Promise.resolve(doc) as unknown as Promise<any[]>;
    });
    const proof = { assignmentId: "a", proofSubmissionId: "dps-2", correlationId: "corr-2" };
    const attempt = { scores: { overallVerificationScore: 0.95 }, reasonCodes: ["HUMAN_VERIFIED"], resultChecksum: "def" };
    await service.createOutboxEvent(proof, "verified", "eligible", attempt);
    expect(created).toHaveLength(1);
    expect(created[0].eventType).toBe(PROOF_VERIFICATION_EVENT_TYPE);
    expect(created[0].payload.eventType).toBe(PROOF_VERIFICATION_EVENT_TYPE);
    expect(created[0].payload.verificationDecision).toBe("verified");
    expect(proofVerificationCompletedEventSchema.safeParse(created[0].payload).success).toBe(true);
  });

  it("produces an HMAC-signed review_required payload that Tasks.cash can verify", () => {
    const secret = "tasks-cash-distribution-hmac-secret-at-least-32-characters";
    const timestamp = 1_753_184_000_000;
    const payload = proofVerificationReviewRequiredEventSchema.parse({
      eventId: "evt_1", eventVersion: 1, eventType: PROOF_VERIFICATION_REVIEW_REQUIRED_EVENT_TYPE,
      occurredAt: "2026-07-22T12:00:00.000Z", externalTaskId: "task_1", externalUserId: "user_1",
      externalAssignmentId: "ea_1", proofSubmissionId: "dps_1", verificationDecision: "needs_review",
      verificationConfidence: 0.72, rewardEligibilityRecommendation: "pending_review",
      reasonCodes: ["HUMAN_REVIEW_REQUIRED"], resultChecksum: "a".repeat(64), correlationId: "corr_1",
    });
    const rawBody = JSON.stringify(payload);
    const signature = signProofCallback(secret, timestamp, rawBody);
    const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
    expect(signature).toBe(expected);
  });
});
