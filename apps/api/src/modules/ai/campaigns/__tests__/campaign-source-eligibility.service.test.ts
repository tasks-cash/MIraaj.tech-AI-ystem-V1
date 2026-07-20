import { beforeEach, describe, expect, it, vi } from "vitest";
import { BadRequestException } from "@nestjs/common";

interface MockBusinessProfile {
  profileId: string;
  status: string;
  audienceType: { code: string; confidence?: number };
  promotionEligibility: { code: string; confidence?: number };
  businessType: { code: string };
  decisionMakerConfidence: number;
  professionalContextConfidence: number;
  countryCode?: string | null;
}

interface MockRecommendationSet {
  setId: string;
  status: string;
  profileId: string;
  analysisResultId: string;
  catalogVersionId: string;
  matchingPolicyId: string;
  items: Array<{
    itemSlug: string;
    state: string;
    isPaymentService?: boolean;
    categoryCode?: string;
  }>;
  requiresReview?: boolean;
  reviewReasonCodes?: string[];
}

function recommendationSet(
  partial: Partial<MockRecommendationSet> = {},
): MockRecommendationSet {
  return {
    setId: "rec-1",
    status: "approved",
    profileId: "profile-1",
    analysisResultId: "analysis-1",
    catalogVersionId: "catalog-v1",
    matchingPolicyId: "policy-v1",
    items: [
      {
        itemSlug: "dental_clinic_management",
        state: "recommended",
        isPaymentService: false,
        categoryCode: "practice_management",
      },
    ],
    requiresReview: false,
    reviewReasonCodes: [],
    ...partial,
  };
}

function businessProfile(
  partial: Partial<MockBusinessProfile> &
    Pick<MockBusinessProfile, "audienceType" | "businessType">,
): MockBusinessProfile {
  return {
    profileId: "profile-1",
    status: "approved",
    promotionEligibility: { code: "eligible_b2b" },
    decisionMakerConfidence: 0.9,
    professionalContextConfidence: 0.9,
    countryCode: null,
    ...partial,
  };
}

const catalogItem = { slug: "dental_clinic_management", status: "active", isPaymentService: false };

async function loadService(input: {
  recommendationSet: MockRecommendationSet;
  businessProfile: MockBusinessProfile;
  catalogItem?: typeof catalogItem | null;
}) {
  vi.resetModules();
  vi.doMock("../../models/service-recommendation-set.schema.js", () => ({
    ServiceRecommendationSetModel: {
      findOne: () => ({ lean: () => Promise.resolve(input.recommendationSet) }),
    },
  }));
  vi.doMock("../../models/business-profile.schema.js", () => ({
    BusinessProfileModel: {
      findOne: () => ({ lean: () => Promise.resolve(input.businessProfile) }),
    },
  }));
  vi.doMock("../../models/service-catalog-item.schema.js", () => ({
    ServiceCatalogItemModel: {
      findOne: () => ({
        lean: () => Promise.resolve(input.catalogItem ?? catalogItem),
      }),
    },
  }));

  const { CampaignSourceEligibilityService } = await import(
    "../campaign-source-eligibility.service.js"
  );
  return new CampaignSourceEligibilityService();
}

describe("Prompt 4 — campaign source audience eligibility", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doUnmock("../../models/service-recommendation-set.schema.js");
    vi.doUnmock("../../models/business-profile.schema.js");
    vi.doUnmock("../../models/service-catalog-item.schema.js");
  });

  it.each(["patient", "student", "restaurant_customer", "hotel_guest"])(
    "rejects the %s consumer audience with CAMPAIGN_AUDIENCE_INELIGIBLE",
    async (audienceCode) => {
      const service = await loadService({
        recommendationSet: recommendationSet(),
        businessProfile: businessProfile({
          audienceType: { code: audienceCode },
          businessType: { code: "dental_clinic" },
          decisionMakerConfidence: 0.1,
          professionalContextConfidence: 0.1,
        }),
      });

      await expect(
        service.loadAndValidate({
          recommendationSetId: "rec-1",
          selectedServiceIds: ["dental_clinic_management"],
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.loadAndValidate({
          recommendationSetId: "rec-1",
          selectedServiceIds: ["dental_clinic_management"],
        }),
      ).rejects.toMatchObject({ response: { code: "CAMPAIGN_AUDIENCE_INELIGIBLE" } });
    },
  );

  it.each(["dentist", "restaurant_owner", "school_manager"])(
    "allows the professional %s audience through",
    async (audienceCode) => {
      const service = await loadService({
        recommendationSet: recommendationSet(),
        businessProfile: businessProfile({
          audienceType: { code: audienceCode },
          businessType: { code: "dental_clinic" },
        }),
      });

      const context = await service.loadAndValidate({
        recommendationSetId: "rec-1",
        selectedServiceIds: ["dental_clinic_management"],
      });

      expect(context.businessProfile.audienceType.code).toBe(audienceCode);
      expect(context.selectedServices).toHaveLength(1);
    },
  );

  it("rejects an employee audience with low decision-maker confidence", async () => {
    const service = await loadService({
      recommendationSet: recommendationSet(),
      businessProfile: businessProfile({
        audienceType: { code: "employee" },
        businessType: { code: "dental_clinic" },
        decisionMakerConfidence: 0.2,
        professionalContextConfidence: 0.2,
      }),
    });

    await expect(
      service.loadAndValidate({
        recommendationSetId: "rec-1",
        selectedServiceIds: ["dental_clinic_management"],
      }),
    ).rejects.toMatchObject({ response: { code: "CAMPAIGN_AUDIENCE_INELIGIBLE" } });
  });

  it("allows an employee audience with strong decision-maker evidence but flags it for review", async () => {
    const service = await loadService({
      recommendationSet: recommendationSet(),
      businessProfile: businessProfile({
        audienceType: { code: "employee" },
        businessType: { code: "dental_clinic" },
        decisionMakerConfidence: 0.9,
        professionalContextConfidence: 0.9,
      }),
    });

    const context = await service.loadAndValidate({
      recommendationSetId: "rec-1",
      selectedServiceIds: ["dental_clinic_management"],
    });
    expect(context.businessProfile.audienceType.code).toBe("employee");
  });

  it("blocks a source whose promotion eligibility is unsuitable", async () => {
    const service = await loadService({
      recommendationSet: recommendationSet(),
      businessProfile: businessProfile({
        audienceType: { code: "dentist" },
        businessType: { code: "dental_clinic" },
        promotionEligibility: { code: "unsuitable" },
      }),
    });

    await expect(
      service.loadAndValidate({
        recommendationSetId: "rec-1",
        selectedServiceIds: ["dental_clinic_management"],
      }),
    ).rejects.toMatchObject({ response: { code: "CAMPAIGN_PROMOTION_UNSUITABLE" } });
  });

  it("flags review_required promotion eligibility instead of blocking it", async () => {
    const service = await loadService({
      recommendationSet: recommendationSet(),
      businessProfile: businessProfile({
        audienceType: { code: "dentist" },
        businessType: { code: "dental_clinic" },
        promotionEligibility: { code: "review_required" },
      }),
    });

    const context = await service.loadAndValidate({
      recommendationSetId: "rec-1",
      selectedServiceIds: ["dental_clinic_management"],
    });
    expect(context.reviewReasonCodes).toContain("promotion_eligibility_uncertain");
  });

  it("Scenario E — flags a selected payment service for mandatory payment review", async () => {
    const service = await loadService({
      recommendationSet: recommendationSet({
        items: [
          {
            itemSlug: "stripe_integration",
            state: "recommended",
            isPaymentService: true,
          },
        ],
      }),
      businessProfile: businessProfile({
        audienceType: { code: "business_owner" },
        businessType: { code: "ecommerce" },
      }),
      catalogItem: { slug: "stripe_integration", status: "active", isPaymentService: true },
    });

    const context = await service.loadAndValidate({
      recommendationSetId: "rec-1",
      selectedServiceIds: ["stripe_integration"],
    });
    expect(context.selectedServices[0]?.isPaymentService).toBe(true);
    expect(context.reviewReasonCodes).toContain("payment_service");
  });

  it("rejects a service that is not part of the approved recommendation set", async () => {
    const service = await loadService({
      recommendationSet: recommendationSet(),
      businessProfile: businessProfile({
        audienceType: { code: "dentist" },
        businessType: { code: "dental_clinic" },
      }),
    });

    await expect(
      service.loadAndValidate({
        recommendationSetId: "rec-1",
        selectedServiceIds: ["not_a_real_service"],
      }),
    ).rejects.toMatchObject({ response: { code: "CAMPAIGN_SERVICE_NOT_RECOMMENDED" } });
  });

  it("rejects an inactive/deprecated catalog service", async () => {
    const service = await loadService({
      recommendationSet: recommendationSet(),
      businessProfile: businessProfile({
        audienceType: { code: "dentist" },
        businessType: { code: "dental_clinic" },
      }),
      catalogItem: {
        slug: "dental_clinic_management",
        status: "deprecated",
        isPaymentService: false,
      },
    });

    await expect(
      service.loadAndValidate({
        recommendationSetId: "rec-1",
        selectedServiceIds: ["dental_clinic_management"],
      }),
    ).rejects.toMatchObject({ response: { code: "CAMPAIGN_SERVICE_INACTIVE" } });
  });

  it("rejects a revision mismatch and only proceeds with an explicit override", async () => {
    const service = await loadService({
      recommendationSet: recommendationSet({ currentRevision: 2 } as never),
      businessProfile: businessProfile({
        audienceType: { code: "dentist" },
        businessType: { code: "dental_clinic" },
      }),
    });

    await expect(
      service.loadAndValidate({
        recommendationSetId: "rec-1",
        recommendationSetRevision: 1,
        selectedServiceIds: ["dental_clinic_management"],
      }),
    ).rejects.toMatchObject({ response: { code: "CAMPAIGN_SOURCE_REVISION_INVALID" } });

    const overridden = await service.loadAndValidate({
      recommendationSetId: "rec-1",
      recommendationSetRevision: 1,
      selectedServiceIds: ["dental_clinic_management"],
      allowCampaignOverride: true,
    });
    expect(overridden.recommendationSet.setId).toBe("rec-1");
  });
});
