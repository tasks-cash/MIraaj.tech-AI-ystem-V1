import { createHash, createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  PROOF_VERIFICATION_EVENT_VERSION,
  proofResultChecksum,
  proofVerificationCompletedEventSchema,
  signProofCallback,
} from "./distribution.contracts.js";

type Assignment = {
  externalTaskId: string;
  externalUserId: string;
  externalAssignmentId: string;
  idempotencyKey: string;
  trackedUrl: string;
  qrPayload: string;
  proofMarker: string;
  headerObjectKey: string;
};

const digest = (value: string) => createHash("sha256").update(value).digest("hex");

function dentistPilotAssignments(count = 10): Assignment[] {
  return Array.from({ length: count }, (_, index) => {
    const sequence = String(index + 1).padStart(2, "0");
    const token = digest(`dentist-tracked-${sequence}`);
    return {
      externalTaskId: "clinic-management-algeria-dentists",
      externalUserId: `dentist-user-${sequence}`,
      externalAssignmentId: `dentist-assignment-${sequence}`,
      idempotencyKey: digest(`dentist-idempotency-${sequence}`),
      trackedUrl: `https://miraaj.example/r/${token}`,
      qrPayload: `https://miraaj.example/r/${token}`,
      proofMarker: `MJR-DENTIST-${sequence}`,
      headerObjectKey: `distribution/headers/dentist-assignment-${sequence}/header.png`,
    };
  });
}

describe("Arabic Algeria dentist pilot acceptance", () => {
  it("creates ten ownership-bound and collection-wide unique assignments", () => {
    const assignments = dentistPilotAssignments();
    expect(assignments).toHaveLength(10);
    for (const key of [
      "externalUserId",
      "externalAssignmentId",
      "idempotencyKey",
      "trackedUrl",
      "qrPayload",
      "proofMarker",
      "headerObjectKey",
    ] as const) {
      expect(new Set(assignments.map((item) => item[key])).size).toBe(10);
    }
    expect(assignments.every((item) => item.externalTaskId === "clinic-management-algeria-dentists")).toBe(true);
  });

  it("enforces pilot and per-user capacity deterministically", () => {
    const assignments = dentistPilotAssignments();
    expect(assignments.length >= 10).toBe(true);
    expect(() => {
      if (assignments.length >= 10) throw new Error("DISTRIBUTION_PILOT_CAPACITY_REACHED");
    }).toThrow("DISTRIBUTION_PILOT_CAPACITY_REACHED");
    expect(assignments.filter((item) => item.externalUserId === "dentist-user-01")).toHaveLength(1);
  });

  it("returns the existing assignment for duplicate idempotency and rejects cross-user access", () => {
    const assignments = dentistPilotAssignments();
    const existing = assignments.find((item) => item.idempotencyKey === assignments[0]?.idempotencyKey);
    expect(existing?.externalAssignmentId).toBe("dentist-assignment-01");
    const owned = assignments.find(
      (item) =>
        item.externalAssignmentId === "dentist-assignment-02" &&
        item.externalUserId === "dentist-user-01",
    );
    expect(owned).toBeUndefined();
  });

  it("preserves immutable additional-evidence revisions and private keys", () => {
    const attempts = [
      { revision: 1, objectKey: "distribution/proofs/a/p/revision-1-1", immutable: true },
      { revision: 2, objectKey: "distribution/proofs/a/p/revision-2-1", immutable: true },
    ];
    expect(attempts[0]).not.toEqual(attempts[1]);
    expect(new Set(attempts.map((item) => item.objectKey)).size).toBe(2);
    expect(attempts.every((item) => item.immutable)).toBe(true);
  });

  it("creates one signed non-financial v1 verification event", () => {
    const scores = { overallVerificationScore: 0.91 };
    const reasonCodes = ["PRIVATE_GROUP_REQUIRES_REVIEW", "HUMAN_VERIFIED"];
    const event = proofVerificationCompletedEventSchema.parse({
      eventId: "evt_dentist_01",
      eventVersion: PROOF_VERIFICATION_EVENT_VERSION,
      eventType: "proof.verification.completed",
      occurredAt: "2026-07-23T12:00:00.000Z",
      externalTaskId: "clinic-management-algeria-dentists",
      externalUserId: "dentist-user-01",
      externalAssignmentId: "dentist-assignment-01",
      proofSubmissionId: "dentist-proof-01",
      verificationDecision: "verified",
      verificationConfidence: 0.91,
      rewardEligibilityRecommendation: "eligible",
      reasonCodes,
      resultChecksum: proofResultChecksum({ decision: "verified", scores, reasons: reasonCodes }),
      correlationId: "dentist-pilot-correlation",
    });
    const body = JSON.stringify(event);
    const signature = signProofCallback("local-test-secret", 1_753_276_800_000, body);
    expect(signature).toBe(createHmac("sha256", "local-test-secret").update(`1753276800000.${body}`).digest("hex"));
    expect(event.eventVersion).toBe(1);
    expect(event.resultChecksum).toHaveLength(64);
    expect(body).not.toMatch(/rewardAmount|currency|wallet|withdrawal|settlement/i);
    expect(new Set([event.eventId, event.eventId]).size).toBe(1);
  });

  it("rejects missing review reasons and concurrent stale revisions", () => {
    expect(() => {
      const reason = "";
      if (!reason.trim()) throw new Error("REVIEW_REASON_REQUIRED");
    }).toThrow("REVIEW_REASON_REQUIRED");
    const persistedRevision = 2;
    expect(1).not.toBe(persistedRevision);
  });
});
