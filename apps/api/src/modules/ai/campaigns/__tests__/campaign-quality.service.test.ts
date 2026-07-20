import { describe, expect, it } from "vitest";
import { CampaignQualityService, type QualityScoringInput } from "../campaign-quality.service.js";
import type { PlatformVariantValidationResult } from "../campaign-validation.service.js";

const service = new CampaignQualityService();

function validResult(
  partial: Partial<PlatformVariantValidationResult> = {},
): PlatformVariantValidationResult {
  return {
    valid: true,
    reasonCodes: [],
    errorCodes: [],
    requiresPaymentReview: false,
    requiresRegulatedReview: false,
    normalizedCtaCode: "no_direct_cta",
    appliedDisclaimer: null,
    ...partial,
  };
}

function baseInput(
  partial: Partial<QualityScoringInput> = {},
): QualityScoringInput {
  return {
    sourceQualityScore: 0.9,
    audienceFitScore: 0.9,
    decisionMakerFitScore: 0.9,
    objectiveFitScore: 0.9,
    funnelStageFitScore: 0.9,
    validationResults: [validResult()],
    languageVariantScores: [{ semanticPreservationScore: 0.95, requiresReview: false }],
    ...partial,
  };
}

describe("Prompt 4 — CampaignQualityService deterministic scoring", () => {
  it("returns a high overall score for clean, fully valid input", () => {
    const breakdown = service.score(baseInput());

    expect(breakdown.overallQualityScore).toBeGreaterThan(0.8);
    expect(breakdown.claimSafetyScore).toBe(1);
    expect(breakdown.complianceScore).toBe(1);
  });

  it("is reproducible for identical input", () => {
    const first = service.score(baseInput());
    const second = service.score(baseInput());
    expect(second).toEqual(first);
  });

  it("penalizes claim safety and compliance when validation flags an unsupported claim", () => {
    const breakdown = service.score(
      baseInput({
        validationResults: [
          validResult({
            valid: false,
            errorCodes: ["CAMPAIGN_UNSUPPORTED_CLAIM"],
          }),
        ],
      }),
    );

    expect(breakdown.claimSafetyScore).toBe(0.2);
    expect(breakdown.serviceFactScore).toBe(0.3);
    expect(breakdown.complianceScore).toBe(0.3);
  });

  it("penalizes compliance when a payment disclosure is missing", () => {
    const breakdown = service.score(
      baseInput({
        validationResults: [
          validResult({
            valid: false,
            errorCodes: ["CAMPAIGN_MISSING_DISCLOSURE"],
          }),
        ],
      }),
    );

    expect(breakdown.complianceScore).toBe(0.3);
  });

  it("lowers language quality and cultural sensitivity when translation needs review", () => {
    const breakdown = service.score(
      baseInput({
        languageVariantScores: [
          { semanticPreservationScore: 0.6, requiresReview: true },
        ],
      }),
    );

    expect(breakdown.languageQualityScore).toBe(0.7);
    expect(breakdown.culturalSensitivityScore).toBe(0.75);
    expect(breakdown.semanticPreservationScore).toBeCloseTo(0.6);
  });
});
