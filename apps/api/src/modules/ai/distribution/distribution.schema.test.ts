/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { describe, expect, it } from "vitest";
import {
  DistributionAssignmentModel,
  ProofSubmissionModel,
  ProofVerificationAttemptModel,
} from "../models/distribution.schema.js";

describe("Prompt 6 distribution persistence", () => {
  it("hashes sensitive assignment material instead of modeling plaintext tokens", () => {
    const paths = DistributionAssignmentModel.schema.paths;
    expect(paths.assignmentTokenHash).toBeDefined();
    expect(paths.assignmentToken).toBeUndefined();
    expect(paths.assignmentTokenHash?.options.select).toBe(false);
  });

  it("keeps verification attempts immutable", () => {
    const attempt = new ProofVerificationAttemptModel({
      verificationAttemptId: "dva-test",
      proofSubmissionId: "dps-test",
      assignmentId: "das-test",
      attemptNumber: 1,
      decision: "needs_review",
      scores: {},
      mandatoryChecks: {},
      resultChecksum: "a".repeat(64),
      durationMs: 1,
      createdBy: "test",
      correlationId: "corr-test",
    });
    expect(attempt.immutable).toBe(true);
  });

  it("defines bounded proof retention and unique idempotency", () => {
    const indexes = ProofSubmissionModel.schema.indexes();
    expect(indexes).toEqual(
      expect.arrayContaining([
        [{ retentionExpiresAt: 1 }, expect.objectContaining({ expireAfterSeconds: 0 })],
        [{ idempotencyKeyHash: 1 }, expect.objectContaining({ unique: true })],
      ]),
    );
  });
});
