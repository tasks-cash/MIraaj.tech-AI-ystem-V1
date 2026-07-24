import { describe, expect, it } from "vitest";
import {
  assertTemplateTransition,
  classifyTimestamp,
  normalizeProofText,
  retentionDays,
  TEMPLATE_TRANSITIONS,
} from "./distribution-operations.js";

describe("distribution production operations", () => {
  it("enforces the bounded template lifecycle", () => {
    expect(TEMPLATE_TRANSITIONS.draft).toContain("awaiting_review");
    expect(() => assertTemplateTransition("approved", "active")).not.toThrow();
    expect(() => assertTemplateTransition("paused", "active")).not.toThrow();
    expect(() => assertTemplateTransition("archived", "active")).toThrow(
      "DISTRIBUTION_TEMPLATE_TRANSITION_INVALID",
    );
  });

  it("normalizes Arabic, French and English proof text deterministically", () => {
    expect(normalizeProofText("إِدَارَةُ العِيَادَة")).toBe("اداره العياده");
    expect(normalizeProofText("  GÉRER   LA Clinique ")).toBe("gérer la clinique");
    expect(normalizeProofText("  Manage   THE clinic ")).toBe("manage the clinic");
  });

  it("classifies bounded timestamp evidence without rejecting absent optional timestamps", () => {
    const assignmentCreatedAt = new Date("2026-07-22T10:00:00.000Z");
    const submittedAt = new Date("2026-07-22T12:00:00.000Z");
    expect(classifyTimestamp({ assignmentCreatedAt, submittedAt, required: false })).toBe("timestamp_unreadable");
    expect(classifyTimestamp({ assignmentCreatedAt, submittedAt, extractedAt: new Date("2026-07-22T11:00:00.000Z"), required: true })).toBe("timestamp_confirmed");
    expect(classifyTimestamp({ assignmentCreatedAt, submittedAt, extractedAt: new Date("2026-07-23T11:00:00.000Z"), required: true })).toBe("timestamp_conflict");
  });

  it("applies differentiated proof retention", () => {
    const policy = { accepted: 90, rejected: 30, duplicate: 60, fraud: 180 };
    expect(retentionDays("accepted", policy)).toBe(90);
    expect(retentionDays("rejected", policy)).toBe(30);
    expect(retentionDays("duplicate", policy)).toBe(60);
    expect(retentionDays("fraud", policy)).toBe(180);
  });

  it("contains no financial or settlement state", () => {
    const source = [
      assertTemplateTransition,
      classifyTimestamp,
      normalizeProofText,
      retentionDays,
    ].map((item) => item.toString()).join(" ");
    expect(source).not.toMatch(/wallet|withdrawal|settlement|rewardAmount|currency/i);
  });
});
