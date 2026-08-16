import { createHmac, timingSafeEqual } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { signProofCallback } from "./distribution.contracts.js";

const secret = "tasks-cash-distribution-hmac-secret-at-least-32-characters";
const timestamp = 1_753_184_000_000;

function tasksCashVerifyCallback(providedSecret: string, providedTimestamp: number, rawBody: string, signature: string): boolean {
  const expected = createHmac("sha256", providedSecret)
    .update(`${providedTimestamp}.${rawBody}`)
    .digest("hex");
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

describe("Miraaj callback HMAC compatibility (Miraaj signer -> Tasks.cash verifier)", () => {
  let payload: string;

  beforeEach(() => {
    payload = JSON.stringify({
      eventId: "evt_550e8400-e29b-41d4-a716-446655440000",
      eventType: "proof.verification.completed",
      proofSubmissionId: "dps_123",
      verificationDecision: "verified",
    });
  });

  it("accepts a valid callback signature", () => {
    const signature = signProofCallback(secret, timestamp, payload);
    expect(tasksCashVerifyCallback(secret, timestamp, payload, signature)).toBe(true);
  });

  it("rejects the wrong HMAC secret", () => {
    const signature = signProofCallback(secret, timestamp, payload);
    expect(tasksCashVerifyCallback("wrong-secret-at-least-32-characters-!!", timestamp, payload, signature)).toBe(false);
  });

  it("rejects a modified callback body", () => {
    const signature = signProofCallback(secret, timestamp, payload);
    const modifiedPayload = payload.replace("verified", "rejected");
    expect(tasksCashVerifyCallback(secret, timestamp, modifiedPayload, signature)).toBe(false);
  });

  it("rejects a timestamp violation", () => {
    const signature = signProofCallback(secret, timestamp, payload);
    expect(tasksCashVerifyCallback(secret, timestamp + 1, payload, signature)).toBe(false);
  });

  it("preserves stable event identity across retry while re-signing with a new timestamp", () => {
    const eventId = "evt_550e8400-e29b-41d4-a716-446655440000";
    const retryPayload = JSON.stringify({
      eventId,
      eventType: "proof.verification.completed",
      proofSubmissionId: "dps_123",
      verificationDecision: "verified",
    });
    const firstSignature = signProofCallback(secret, timestamp, retryPayload);
    const retryTimestamp = timestamp + 5_000;
    const retrySignature = signProofCallback(secret, retryTimestamp, retryPayload);

    expect(firstSignature).not.toBe(retrySignature);
    expect(tasksCashVerifyCallback(secret, timestamp, retryPayload, firstSignature)).toBe(true);
    expect(tasksCashVerifyCallback(secret, retryTimestamp, retryPayload, retrySignature)).toBe(true);

    const parsed = JSON.parse(retryPayload) as { eventId: string };
    expect(parsed.eventId).toBe(eventId);
  });

  it("reuses the same signed business payload for a retry", () => {
    const retryTimestamp = timestamp + 5_000;
    const firstSignature = signProofCallback(secret, timestamp, payload);
    const retrySignature = signProofCallback(secret, retryTimestamp, payload);
    expect(firstSignature).not.toBe(retrySignature);
    expect(tasksCashVerifyCallback(secret, retryTimestamp, payload, retrySignature)).toBe(true);
  });
});
