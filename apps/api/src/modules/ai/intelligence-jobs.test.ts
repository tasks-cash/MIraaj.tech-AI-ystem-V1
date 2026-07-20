import { beforeEach, describe, expect, it, vi } from "vitest";
import { BadRequestException } from "@nestjs/common";
import {
  assertSourceEligible,
  buildIntelligenceFingerprint,
} from "./intelligence/intelligence-job.service.js";
import { MatchingEngineService } from "./matching/matching-engine.service.js";
import type {
  MatchableCatalogItem,
  MatchableProfile,
  MatchingPolicyInput,
} from "./matching/matching-types.js";
import { CATALOG_SEED_SERVICES } from "./catalog/catalog-seed-data.js";
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

function profile(
  partial: Partial<MatchableProfile> &
    Pick<MatchableProfile, "businessType" | "audienceType" | "needs">,
): MatchableProfile {
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

describe("Prompt 3 — intelligence job eligibility", () => {
  it("rejects a source analysis result with rejected review status", () => {
    expect(() =>
      assertSourceEligible({ reviewStatus: "rejected", allowAwaitingReview: false }),
    ).toThrow(BadRequestException);
    try {
      assertSourceEligible({ reviewStatus: "rejected", allowAwaitingReview: false });
    } catch (error) {
      expect((error as BadRequestException).getResponse()).toMatchObject({
        code: "INTELLIGENCE_SOURCE_REJECTED",
      });
    }
  });

  it("allows completed/approved sources without an override flag", () => {
    expect(() =>
      assertSourceEligible({ reviewStatus: "approved", allowAwaitingReview: false }),
    ).not.toThrow();
    expect(() =>
      assertSourceEligible({ reviewStatus: "not_required", allowAwaitingReview: false }),
    ).not.toThrow();
  });

  it("blocks an awaiting-review source unless the override flag is set", () => {
    expect(() =>
      assertSourceEligible({ reviewStatus: "pending", allowAwaitingReview: false }),
    ).toThrow(BadRequestException);
    expect(() =>
      assertSourceEligible({ reviewStatus: "pending", allowAwaitingReview: true }),
    ).not.toThrow();
  });
});

describe("Prompt 3 — intelligence fingerprint reuse", () => {
  it("produces a stable fingerprint for identical inputs", () => {
    const first = buildIntelligenceFingerprint({
      analysisResultId: "analysis-1",
      catalogVersionId: "catalog-v1",
      matchingPolicyId: "policy-v1",
    });
    const second = buildIntelligenceFingerprint({
      analysisResultId: "analysis-1",
      catalogVersionId: "catalog-v1",
      matchingPolicyId: "policy-v1",
    });
    expect(first).toBe(second);
  });

  it("produces a different fingerprint when the catalog version changes", () => {
    const first = buildIntelligenceFingerprint({
      analysisResultId: "analysis-1",
      catalogVersionId: "catalog-v1",
      matchingPolicyId: "policy-v1",
    });
    const second = buildIntelligenceFingerprint({
      analysisResultId: "analysis-1",
      catalogVersionId: "catalog-v2",
      matchingPolicyId: "policy-v1",
    });
    expect(first).not.toBe(second);
  });
});

describe("Prompt 3 — matching score reproducibility", () => {
  it("returns an identical score/breakdown for identical inputs", () => {
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
});

describe("Prompt 3 — restaurant consumer vs owner", () => {
  it("excludes consumer diners from the restaurant management system", () => {
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
  });

  it("recommends the restaurant management system to the restaurant owner", () => {
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
});

describe("Prompt 3 — safe failure when catalog is unavailable", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("throws a BadRequestException with SERVICE_CATALOG_NO_ACTIVE_VERSION when no active version exists", async () => {
    vi.doMock("./models/service-catalog-version.schema.js", () => ({
      ServiceCatalogVersionModel: {
        findOne: () => Promise.resolve(null),
      },
    }));
    vi.doMock("./models/service-matching-policy.schema.js", () => ({
      ServiceMatchingPolicyModel: {
        findOne: () => Promise.resolve(null),
      },
    }));

    const { CatalogService } = await import("./catalog/catalog.service.js");
    const service = new CatalogService();

    await expect(service.getActiveVersionOrThrow()).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.getActiveVersionOrThrow()).rejects.toMatchObject({
      response: { code: "SERVICE_CATALOG_NO_ACTIVE_VERSION" },
    });
    await expect(service.getActiveMatchingPolicyOrThrow()).rejects.toMatchObject(
      { response: { code: "MATCHING_POLICY_NOT_FOUND" } },
    );

    vi.doUnmock("./models/service-catalog-version.schema.js");
    vi.doUnmock("./models/service-matching-policy.schema.js");
  });
});
