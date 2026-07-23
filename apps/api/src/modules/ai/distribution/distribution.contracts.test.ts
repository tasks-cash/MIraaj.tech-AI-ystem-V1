import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  callbackCanonical,
  assignmentPackageResponseSchema,
  canonicalJson,
  createDistributionAssignmentRequestSchema,
  createProofUploadSessionRequestSchema,
  proofStatusResponseSchema,
  proofResultChecksum,
  proofVerificationCompletedEventSchema,
  signProofCallback,
  signTasksCashRequest,
  tasksCashRequestCanonical,
} from "./distribution.contracts.js";

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`../../../../../../docs/contracts/miraaj-tasks-cash/v1/${name}`, import.meta.url), "utf8")) as unknown;

const assignment = {
  apiVersion: "v1", templateId: "dst_1", copyVariantId: "dcp_1", externalTaskId: "task_1",
  externalUserId: "user_1", externalAssignmentId: "assignment_1", targetUrl: "https://approved.example/path",
};

describe("Tasks.cash distribution v1 contracts", () => {
  it("strictly rejects missing versions, unknown fields, and invalid URLs", () => {
    expect(createDistributionAssignmentRequestSchema.safeParse({ ...assignment, apiVersion: undefined }).success).toBe(false);
    expect(createDistributionAssignmentRequestSchema.safeParse({ ...assignment, unknown: true }).success).toBe(false);
    expect(createDistributionAssignmentRequestSchema.safeParse({ ...assignment, targetUrl: "not-a-url" }).success).toBe(false);
    expect(createProofUploadSessionRequestSchema.safeParse({ apiVersion: "v1", externalAssignmentId: "a", externalUserId: "u", screenshotCount: 6 }).success).toBe(false);
  });

  it("validates the immutable cross-repository request and response fixtures", () => {
    expect(createDistributionAssignmentRequestSchema.safeParse(fixture("assignment-request.json")).success).toBe(true);
    expect(assignmentPackageResponseSchema.safeParse(fixture("assignment-response.json")).success).toBe(true);
    expect(createProofUploadSessionRequestSchema.safeParse(fixture("proof-upload-request.json")).success).toBe(true);
    expect(proofStatusResponseSchema.safeParse(fixture("proof-status-response.json")).success).toBe(true);
    expect(proofVerificationCompletedEventSchema.safeParse(fixture("proof-verification-completed.json")).success).toBe(true);
  });

  it("rejects unknown event versions", () => {
    const event = { eventId: "evt_1", eventVersion: 2, eventType: "proof.verification.completed", occurredAt: "2026-07-22T12:00:00.000Z", externalTaskId: "t", externalUserId: "u", externalAssignmentId: "a", proofSubmissionId: "p", verificationDecision: "verified", verificationConfidence: 0.98, rewardEligibilityRecommendation: "eligible", reasonCodes: [], resultChecksum: "a".repeat(64), correlationId: "corr_12345678" };
    expect(proofVerificationCompletedEventSchema.safeParse(event).success).toBe(false);
  });

  it("publishes a checksum reproducible from the public callback projection", () => {
    const event = fixture("proof-verification-completed.json") as {
      verificationDecision: string; verificationConfidence: number; reasonCodes: string[]; resultChecksum: string;
    };
    expect(proofResultChecksum({
      decision: event.verificationDecision,
      reasons: event.reasonCodes,
      scores: { overallVerificationScore: event.verificationConfidence },
    })).toBe(event.resultChecksum);
  });

  it("canonicalizes nested objects, arrays, Unicode and Arabic deterministically", () => {
    const left = { z: ["طبيب الأسنان", { b: "é", a: 1 }], a: { y: false, x: "مرحبا" } };
    const right = { a: { x: "مرحبا", y: false }, z: ["طبيب الأسنان", { a: 1, b: "é" }] };
    expect(canonicalJson(left)).toBe(canonicalJson(right));
    expect(proofResultChecksum({ decision: "needs_review", scores: { z: 0.5, a: 1 }, reasons: ["B", "A", "A"] }))
      .toBe("f4f7c955e18eabcc88b09b8cd4f6432bbc1a5fc68106b352d515f9334933b3f8");
    expect(proofResultChecksum({ reasons: ["A", "B"], scores: { a: 1, z: 0.5 }, decision: "needs_review" }))
      .toBe("f4f7c955e18eabcc88b09b8cd4f6432bbc1a5fc68106b352d515f9334933b3f8");
  });

  it("provides stable request and callback signing vectors including empty bodies", () => {
    const request = { method: "GET", path: "/api/integrations/tasks-cash/distribution/assignments/a", timestamp: 1_753_184_000_000, nonce: "nonce-123", body: {} };
    expect(tasksCashRequestCanonical(request)).toBe("GET\n/api/integrations/tasks-cash/distribution/assignments/a\n1753184000000\nnonce-123\n44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a");
    expect(signTasksCashRequest("vector-secret", request)).toMatch(/^[a-f0-9]{64}$/);
    const raw = JSON.stringify({ text: "أطباء الأسنان", nested: { b: 2, a: 1 }, array: [1, "é"] });
    expect(callbackCanonical(1_753_184_000_000, raw)).toBe(`1753184000000.${raw}`);
    expect(signProofCallback("vector-secret", 1_753_184_000_000, raw)).toMatch(/^[a-f0-9]{64}$/);
  });
});
