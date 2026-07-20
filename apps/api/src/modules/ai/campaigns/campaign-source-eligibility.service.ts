import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  isConsumerAudience,
  isProfessionalAudience,
  type CampaignReviewReasonCode,
} from "@miraaj/shared-types";
import { BusinessProfileModel } from "../models/business-profile.schema.js";
import { ServiceCatalogItemModel } from "../models/service-catalog-item.schema.js";
import { ServiceRecommendationSetModel } from "../models/service-recommendation-set.schema.js";

const APPROVED_REC_STATUSES = new Set(["approved", "corrected"]);
const BLOCKED_PROMOTION = new Set(["unsuitable"]);
const REVIEW_PROMOTION = new Set(["review_required", "unknown"]);

// "employee" is intentionally excluded here: it is only blocked when the
// business profile lacks decision-maker evidence (handled below), per the
// "employee-only without decision-maker evidence" exclusion rule.
const B2B_BLOCKED_CONSUMER_AUDIENCES = new Set([
  "patient",
  "student",
  "restaurant_customer",
  "hotel_guest",
  "general_public",
  "consumer",
  "parent",
]);

export interface CampaignSourceContext {
  recommendationSet: {
    setId: string;
    status: string;
    revision?: number;
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
  };
  businessProfile: {
    profileId: string;
    status: string;
    audienceType: { code: string; confidence?: number };
    promotionEligibility: { code: string; confidence?: number };
    businessType: { code: string };
    decisionMakerConfidence: number;
    professionalContextConfidence: number;
    countryCode?: string | null;
  };
  selectedServices: Array<{
    itemSlug: string;
    state: string;
    isPaymentService: boolean;
    status?: string;
  }>;
  reviewReasonCodes: CampaignReviewReasonCode[];
}

@Injectable()
export class CampaignSourceEligibilityService {
  async loadAndValidate(input: {
    recommendationSetId: string;
    recommendationSetRevision?: number;
    selectedServiceIds: string[];
    allowCampaignOverride?: boolean;
  }): Promise<CampaignSourceContext> {
    const recommendationSet = await ServiceRecommendationSetModel.findOne({
      setId: input.recommendationSetId,
    }).lean();
    if (!recommendationSet) {
      throw new NotFoundException({
        code: "CAMPAIGN_SOURCE_NOT_FOUND",
        message: "Recommendation set was not found.",
      });
    }

    const revision = input.recommendationSetRevision ?? 1;
    const currentRevision =
      (recommendationSet as { currentRevision?: number }).currentRevision ?? 1;
    if (revision !== currentRevision && !input.allowCampaignOverride) {
      throw new BadRequestException({
        code: "CAMPAIGN_SOURCE_REVISION_INVALID",
        message: "Recommendation set revision does not match the current revision.",
      });
    }

    if (recommendationSet.status === "superseded") {
      throw new BadRequestException({
        code: "CAMPAIGN_SOURCE_SUPERSEDED",
        message:
          "Superseded recommendation sets cannot be used without explicit revision selection.",
      });
    }

    if (
      !APPROVED_REC_STATUSES.has(recommendationSet.status) &&
      !input.allowCampaignOverride
    ) {
      throw new BadRequestException({
        code: "CAMPAIGN_SOURCE_NOT_APPROVED",
        message: "Only approved recommendation sets can generate campaigns.",
      });
    }

    const businessProfile = await BusinessProfileModel.findOne({
      profileId: recommendationSet.profileId,
    }).lean();
    if (!businessProfile) {
      throw new NotFoundException({
        code: "CAMPAIGN_SOURCE_NOT_FOUND",
        message: "Linked business profile was not found.",
      });
    }

    const reviewReasonCodes: CampaignReviewReasonCode[] = [];
    const promotionCode = businessProfile.promotionEligibility?.code ?? "unknown";
    const audienceCode = businessProfile.audienceType?.code ?? "unknown";

    if (BLOCKED_PROMOTION.has(promotionCode)) {
      throw new BadRequestException({
        code: "CAMPAIGN_PROMOTION_UNSUITABLE",
        message: "Promotion eligibility is unsuitable for campaign generation.",
      });
    }

    if (REVIEW_PROMOTION.has(promotionCode)) {
      reviewReasonCodes.push("promotion_eligibility_uncertain");
    }

    if (
      isConsumerAudience(audienceCode as never) ||
      B2B_BLOCKED_CONSUMER_AUDIENCES.has(audienceCode)
    ) {
      if (!isProfessionalAudience(audienceCode as never)) {
        throw new BadRequestException({
          code: "CAMPAIGN_AUDIENCE_INELIGIBLE",
          message:
            "Consumer or non-decision-maker audiences cannot receive B2B management campaigns.",
        });
      }
    }

    if ((businessProfile.decisionMakerConfidence ?? 0) < 0.65) {
      if (audienceCode === "employee") {
        throw new BadRequestException({
          code: "CAMPAIGN_AUDIENCE_INELIGIBLE",
          message:
            "Employee audiences require decision-maker evidence for B2B campaigns.",
        });
      }
      reviewReasonCodes.push("decision_maker_uncertain");
    }

    if (recommendationSet.requiresReview) {
      reviewReasonCodes.push("source_review_required");
    }

    const selected: CampaignSourceContext["selectedServices"] = [];
    for (const slug of input.selectedServiceIds) {
      const rec = recommendationSet.items.find((item) => item.itemSlug === slug);
      if (!rec) {
        throw new BadRequestException({
          code: "CAMPAIGN_SERVICE_NOT_RECOMMENDED",
          message: `Service ${slug} is not in the approved recommendation set.`,
        });
      }
      if (
        !["recommended", "recommended_with_prerequisites", "optional"].includes(
          rec.state,
        )
      ) {
        throw new BadRequestException({
          code: "CAMPAIGN_SERVICE_NOT_RECOMMENDED",
          message: `Service ${slug} is not in an approved recommendation state.`,
        });
      }
      const catalogItem = await ServiceCatalogItemModel.findOne({ slug }).lean();
      if (
        !catalogItem ||
        catalogItem.status === "deprecated" ||
        catalogItem.status === "archived" ||
        catalogItem.status === "paused"
      ) {
        throw new BadRequestException({
          code: "CAMPAIGN_SERVICE_INACTIVE",
          message: `Service ${slug} is inactive or unavailable in the catalog.`,
        });
      }
      if (rec.isPaymentService || catalogItem.isPaymentService) {
        reviewReasonCodes.push("payment_service");
      }
      selected.push({
        itemSlug: slug,
        state: rec.state,
        isPaymentService: Boolean(
          rec.isPaymentService || catalogItem.isPaymentService,
        ),
        status: catalogItem.status,
      });
    }

    return {
      recommendationSet: {
        setId: recommendationSet.setId,
        status: recommendationSet.status,
        revision: currentRevision,
        profileId: recommendationSet.profileId,
        analysisResultId: recommendationSet.analysisResultId,
        catalogVersionId: recommendationSet.catalogVersionId,
        matchingPolicyId: recommendationSet.matchingPolicyId,
        items: recommendationSet.items.map((item) => ({
          itemSlug: item.itemSlug,
          state: item.state,
          isPaymentService: item.isPaymentService,
          categoryCode: item.categoryCode,
        })),
        requiresReview: recommendationSet.requiresReview,
        reviewReasonCodes: recommendationSet.reviewReasonCodes,
      },
      businessProfile: {
        profileId: businessProfile.profileId,
        status: businessProfile.status,
        audienceType: businessProfile.audienceType,
        promotionEligibility: businessProfile.promotionEligibility,
        businessType: businessProfile.businessType,
        decisionMakerConfidence: businessProfile.decisionMakerConfidence,
        professionalContextConfidence:
          businessProfile.professionalContextConfidence,
        countryCode: businessProfile.countryCode ?? null,
      },
      selectedServices: selected,
      reviewReasonCodes: [...new Set(reviewReasonCodes)],
    };
  }
}
