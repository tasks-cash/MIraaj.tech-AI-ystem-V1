import { describe, expect, it } from "vitest";
import {
  containsProhibitedPaymentClaim,
  isRegulatedBusinessType,
  PAYMENT_COMPLIANCE_DISCLAIMERS,
} from "@miraaj/shared-types";
import { MatchingEngineService } from "./matching/matching-engine.service.js";
import type {
  MatchableCatalogItem,
  MatchableProfile,
  MatchingPolicyInput,
} from "./matching/matching-types.js";
import { buildDeterministicProfileFromAnalysis } from "./intelligence/profile-builder.js";
import {
  CATALOG_SEED_SERVICES,
} from "./catalog/catalog-seed-data.js";
import {
  DEFAULT_MATCHING_PENALTIES,
  DEFAULT_MATCHING_WEIGHTS,
} from "./catalog/catalog-seed.service.js";

const matcher = new MatchingEngineService();

const policy: MatchingPolicyInput = {
  weights: { ...DEFAULT_MATCHING_WEIGHTS },
  penalties: { ...DEFAULT_MATCHING_PENALTIES },
  autoApproveMin: 0.55,
  reviewMin: 0.35,
  decisionMakerMin: 0.65,
  professionalContextMin: 0.65,
};

function toMatchableItem(slug: string): MatchableCatalogItem {
  const seed = CATALOG_SEED_SERVICES.find((item) => item.slug === slug);
  if (!seed) {
    throw new Error(`Missing seed ${slug}`);
  }
  return {
    slug: seed.slug,
    categoryCode: seed.categoryCode,
    supportedBusinessTypes: seed.supportedBusinessTypes,
    supportedAudienceTypes: seed.supportedAudienceTypes,
    targetNeeds: seed.targetNeeds,
    requiresProfessionalAudience: seed.requiresProfessionalAudience,
    requiresDecisionMakerEvidence: seed.requiresDecisionMakerEvidence,
    isPaymentService: seed.isPaymentService,
    isRegulatedDomainOnly: seed.isRegulatedDomainOnly,
    providerDependency: seed.providerDependency,
    prerequisiteSlugs: seed.prerequisiteSlugs,
    phase: seed.phase,
    availability: seed.availability,
  };
}

function profile(partial: Partial<MatchableProfile> & Pick<
  MatchableProfile,
  "businessType" | "audienceType" | "needs"
>): MatchableProfile {
  return {
    businessTypeConfidence: 0.9,
    organizationType: "small_business",
    businessStage: "operating",
    digitalMaturity: "basic",
    audienceConfidence: 0.9,
    groupSourceContext: "professional_group",
    painPoints: [],
    objectives: [],
    decisionMakerConfidence: 0.9,
    professionalContextConfidence: 0.9,
    countryCode: null,
    languages: ["en"],
    ...partial,
  };
}

describe("Prompt 3 matching engine", () => {
  it("seeds a comprehensive individual-service catalog", () => {
    expect(CATALOG_SEED_SERVICES.length).toBeGreaterThanOrEqual(150);
    expect(
      CATALOG_SEED_SERVICES.some((item) => item.slug === "dental_clinic_management"),
    ).toBe(true);
  });

  it("recommends dental management for professional dentist audiences", () => {
    const match = matcher.scoreItem(
      profile({
        businessType: "dental_clinic",
        audienceType: "dentist",
        needs: ["patient_management", "booking"],
        decisionMakerConfidence: 0.9,
        professionalContextConfidence: 0.9,
      }),
      toMatchableItem("dental_clinic_management"),
      policy,
    );
    expect(match.state).not.toBe("excluded");
    expect(match.score).toBeGreaterThan(0.4);
  });

  it("excludes dental management for patient audiences", () => {
    const match = matcher.scoreItem(
      profile({
        businessType: "dental_clinic",
        audienceType: "patient",
        needs: ["patient_management"],
        decisionMakerConfidence: 0.1,
        professionalContextConfidence: 0.1,
        groupSourceContext: "patient_group",
      }),
      toMatchableItem("dental_clinic_management"),
      policy,
    );
    expect(match.state).toBe("excluded");
    expect(match.reasonCodes).toContain("SERVICE_MATCH_AUDIENCE_INELIGIBLE");
  });

  it("excludes school management for student audiences", () => {
    const match = matcher.scoreItem(
      profile({
        businessType: "school",
        audienceType: "student",
        needs: ["student_management"],
        decisionMakerConfidence: 0.1,
        professionalContextConfidence: 0.1,
        groupSourceContext: "student_group",
      }),
      toMatchableItem("school_management"),
      policy,
    );
    expect(match.state).toBe("excluded");
  });

  it("attaches payment compliance disclaimers and blocks prohibited claims", () => {
    const payment = CATALOG_SEED_SERVICES.find((item) => item.isPaymentService);
    expect(payment).toBeTruthy();
    const match = matcher.scoreItem(
      profile({
        businessType: "ecommerce_business",
        audienceType: "ecommerce_operator",
        needs: ["online_checkout"],
      }),
      toMatchableItem(payment!.slug),
      policy,
    );
    expect(match.complianceDisclaimer?.en).toBe(PAYMENT_COMPLIANCE_DISCLAIMERS.en);
    expect(containsProhibitedPaymentClaim(match.complianceDisclaimer!.en)).toBe(
      false,
    );
    expect(containsProhibitedPaymentClaim("Guaranteed merchant approval")).toBe(
      true,
    );
  });

  it("builds consumer vs professional profiles from analysis evidence", () => {
    const patient = buildDeterministicProfileFromAnalysis({
      analysisResultId: "a1",
      mergedOutput: {
        businessSignals: [{ label: "dental_clinic", confidence: 0.9 }],
        audienceSignals: [{ label: "patient", confidence: 0.9 }],
      },
    });
    expect(patient.promotionEligibility.code).toBe("unsuitable");
    expect(patient.decisionMakerConfidence).toBeLessThan(0.5);

    const dentist = buildDeterministicProfileFromAnalysis({
      analysisResultId: "a2",
      mergedOutput: {
        businessSignals: [{ label: "dental_clinic", confidence: 0.9 }],
        audienceSignals: [{ label: "dentist", confidence: 0.9 }],
      },
    });
    expect(dentist.promotionEligibility.code).toBe("eligible_b2b");
    expect(isRegulatedBusinessType("dental_clinic")).toBe(true);
  });
});
