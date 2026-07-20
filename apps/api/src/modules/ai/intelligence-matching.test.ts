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
    expect(CATALOG_SEED_SERVICES.length).toBeGreaterThanOrEqual(280);
    expect(
      CATALOG_SEED_SERVICES.some((item) => item.slug === "dental_clinic_management"),
    ).toBe(true);
    expect(
      CATALOG_SEED_SERVICES.some((item) => item.slug === "stripe_integration"),
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

  it("recommends restaurant management for restaurant owners", () => {
    const match = matcher.scoreItem(
      profile({
        businessType: "restaurant",
        audienceType: "restaurant_owner",
        needs: ["restaurant_management", "booking"],
      }),
      toMatchableItem("restaurant_management"),
      policy,
    );
    expect(match.state).not.toBe("excluded");
    expect(match.score).toBeGreaterThan(0.4);
  });

  it("excludes restaurant management for consumer diners", () => {
    const match = matcher.scoreItem(
      profile({
        businessType: "restaurant",
        audienceType: "consumer",
        needs: ["restaurant_management"],
        decisionMakerConfidence: 0.1,
        professionalContextConfidence: 0.1,
        groupSourceContext: "consumer_group",
      }),
      toMatchableItem("restaurant_management"),
      policy,
    );
    expect(match.state).toBe("excluded");
    expect(match.reasonCodes).toContain("SERVICE_MATCH_AUDIENCE_INELIGIBLE");
  });

  it("recommends hotel management for hotel managers", () => {
    const match = matcher.scoreItem(
      profile({
        businessType: "hotel",
        audienceType: "hotel_manager",
        needs: ["hotel_management", "booking"],
      }),
      toMatchableItem("hotel_management"),
      policy,
    );
    expect(match.state).not.toBe("excluded");
    expect(match.score).toBeGreaterThan(0.4);
  });

  it("excludes hotel management for guest or consumer audiences", () => {
    const match = matcher.scoreItem(
      profile({
        businessType: "hotel",
        audienceType: "consumer",
        needs: ["hotel_management"],
        decisionMakerConfidence: 0.1,
        professionalContextConfidence: 0.1,
        groupSourceContext: "consumer_group",
      }),
      toMatchableItem("hotel_management"),
      policy,
    );
    expect(match.state).toBe("excluded");
  });

  it("recommends school management for school managers", () => {
    const match = matcher.scoreItem(
      profile({
        businessType: "school",
        audienceType: "school_manager",
        needs: ["student_management", "attendance"],
      }),
      toMatchableItem("school_management"),
      policy,
    );
    expect(match.state).not.toBe("excluded");
    expect(match.score).toBeGreaterThan(0.4);
  });

  it("prefers multi-branch platform for multi-branch profiles", () => {
    const multiBranchProfile = profile({
      businessType: "restaurant",
      organizationType: "multi_branch_business",
      audienceType: "restaurant_owner",
      needs: ["multi_branch_platform", "reporting"],
      decisionMakerConfidence: 0.9,
    });
    const platform = matcher.scoreItem(
      multiBranchProfile,
      toMatchableItem("multi_branch_platform_build"),
      policy,
    );
    const website = matcher.scoreItem(
      multiBranchProfile,
      toMatchableItem("corporate_website"),
      policy,
    );
    expect(platform.score).toBeGreaterThan(website.score);
    expect(platform.state).not.toBe("excluded");
  });

  it("defers advanced phase-3 AI for low digital-maturity small businesses", () => {
    const lowMaturityProfile = profile({
      businessType: "general_business",
      organizationType: "small_business",
      audienceType: "business_owner",
      digitalMaturity: "none",
      needs: ["corporate_website"],
      decisionMakerConfidence: 0.9,
    });
    const advancedAi = matcher.scoreItem(
      lowMaturityProfile,
      toMatchableItem("ai_workflow_orchestration"),
      policy,
    );
    const foundation = matcher.scoreItem(
      lowMaturityProfile,
      toMatchableItem("corporate_website"),
      policy,
    );
    expect(advancedAi.phase).toBeGreaterThanOrEqual(2);
    expect(foundation.score).toBeGreaterThan(advancedAi.score);
    if (advancedAi.state === "recommended") {
      expect(advancedAi.score).toBeLessThan(foundation.score);
    } else {
      expect(["future_phase", "blocked", "optional"]).toContain(advancedAi.state);
    }
  });

  it("keeps mobile applications lower priority than foundation web for basic maturity", () => {
    const basicProfile = profile({
      businessType: "general_business",
      organizationType: "small_business",
      audienceType: "business_owner",
      digitalMaturity: "basic",
      needs: ["corporate_website"],
    });
    const mobile = matcher.scoreItem(
      basicProfile,
      toMatchableItem("mobile_app_ios_android"),
      policy,
    );
    const website = matcher.scoreItem(
      basicProfile,
      toMatchableItem("corporate_website"),
      policy,
    );
    expect(mobile.phase).toBeGreaterThanOrEqual(2);
    expect(website.score).toBeGreaterThan(mobile.score);
  });

  it("returns identical scores for identical inputs", () => {
    const dentistProfile = profile({
      businessType: "dental_clinic",
      audienceType: "dentist",
      needs: ["patient_management", "booking"],
    });
    const item = toMatchableItem("dental_clinic_management");
    const first = matcher.scoreItem(dentistProfile, item, policy);
    const second = matcher.scoreItem(dentistProfile, item, policy);
    expect(second.score).toBe(first.score);
    expect(second.state).toBe(first.state);
    expect(second.breakdown).toEqual(first.breakdown);
    expect(second.penalties).toEqual(first.penalties);
  });

  it("maps restaurant owner and consumer profiles from analysis evidence", () => {
    const owner = buildDeterministicProfileFromAnalysis({
      analysisResultId: "r-owner",
      mergedOutput: {
        businessSignals: [{ label: "restaurant", confidence: 0.9 }],
        audienceSignals: [{ label: "restaurant_owner", confidence: 0.9 }],
      },
    });
    expect(owner.promotionEligibility.code).toBe("eligible_b2b");
    expect(owner.audienceType.code).toBe("restaurant_owner");

    const consumer = buildDeterministicProfileFromAnalysis({
      analysisResultId: "r-consumer",
      mergedOutput: {
        businessSignals: [{ label: "restaurant", confidence: 0.9 }],
        audienceSignals: [{ label: "consumer", confidence: 0.9 }],
      },
    });
    expect(consumer.promotionEligibility.code).toBe("unsuitable");
    expect(consumer.groupSourceContext.code).toBe("consumer_group");
  });

  it("maps hotel manager and guest-like consumer profiles from analysis evidence", () => {
    const manager = buildDeterministicProfileFromAnalysis({
      analysisResultId: "h-manager",
      mergedOutput: {
        businessSignals: [{ label: "hotel", confidence: 0.9 }],
        audienceSignals: [{ label: "hotel_manager", confidence: 0.9 }],
      },
    });
    expect(manager.promotionEligibility.code).toBe("eligible_b2b");
    expect(manager.audienceType.code).toBe("hotel_manager");

    const guest = buildDeterministicProfileFromAnalysis({
      analysisResultId: "h-guest",
      mergedOutput: {
        businessSignals: [{ label: "hotel", confidence: 0.9 }],
        audienceSignals: [{ label: "consumer", confidence: 0.9 }],
      },
    });
    expect(guest.promotionEligibility.code).toBe("unsuitable");
  });
});
