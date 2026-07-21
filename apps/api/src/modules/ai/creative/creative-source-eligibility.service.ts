import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { CreativeReviewReasonCode } from "@miraaj/shared-types";
import { CampaignPackageModel } from "../models/campaign.schema.js";

const APPROVED_PACKAGE_STATUSES = new Set(["approved", "corrected"]);
const REJECTED_PACKAGE_STATUSES = new Set([
  "draft",
  "awaiting_review",
  "rejected",
  "superseded",
  "generated",
]);

export interface CreativeBriefRef {
  briefId: string;
  briefType: "image" | "video" | "carousel" | "story";
  platform?: string;
  language?: string;
  locale?: string;
  textOverlay?: string;
  expectedText?: string;
  disclosureText?: string;
  assetHints?: string[];
}

export interface CreativeSourceContext {
  campaignPackage: {
    campaignPackageId: string;
    campaignId: string;
    campaignBriefId: string;
    status: string;
    currentRevision: number;
    brandProfileId: string;
    brandProfileVersion: number;
    platformPolicyVersion: number;
    compliancePolicyVersion: number;
    selectedPlatforms: string[];
    targetLanguages: string[];
    targetLocales: string[];
    requiredDisclosures: Record<string, unknown>;
    reviewReasonCodes: string[];
    selectedServices: string[];
    correlationId: string;
    createdBy: string;
  };
  briefs: CreativeBriefRef[];
  reviewReasonCodes: CreativeReviewReasonCode[];
}

function asBriefArray(
  value: unknown,
  briefType: CreativeBriefRef["briefType"],
): CreativeBriefRef[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item, index) => {
    const record = (item ?? {}) as Record<string, unknown>;
    const briefId =
      typeof record.briefId === "string"
        ? record.briefId
        : typeof record.id === "string"
          ? record.id
          : `${briefType}-brief-${index + 1}`;
    return {
      briefId,
      briefType,
      ...(typeof record.platform === "string" ? { platform: record.platform } : {}),
      ...(typeof record.language === "string" ? { language: record.language } : {}),
      ...(typeof record.locale === "string" ? { locale: record.locale } : {}),
      ...(typeof record.textOverlay === "string"
        ? { textOverlay: record.textOverlay }
        : {}),
      ...(typeof record.expectedText === "string"
        ? { expectedText: record.expectedText }
        : {}),
      ...(typeof record.disclosureText === "string"
        ? { disclosureText: record.disclosureText }
        : {}),
      ...(Array.isArray(record.assetHints)
        ? { assetHints: record.assetHints.filter((h): h is string => typeof h === "string") }
        : {}),
    };
  });
}

/**
 * Creative generation is only allowed from an approved/corrected campaign
 * package. NestJS pins brand/policy versions and collects creative briefs;
 * providers never decide source eligibility.
 */
@Injectable()
export class CreativeSourceEligibilityService {
  async loadAndValidate(input: {
    campaignPackageId: string;
    campaignPackageRevision?: number;
    selectedBriefIds?: string[];
    allowOverride?: boolean;
  }): Promise<CreativeSourceContext> {
    const campaignPackage = await CampaignPackageModel.findOne({
      campaignPackageId: input.campaignPackageId,
    }).lean();
    if (!campaignPackage) {
      throw new NotFoundException({
        code: "CREATIVE_SOURCE_NOT_FOUND",
        message: "Campaign package was not found.",
      });
    }

    const currentRevision = campaignPackage.currentRevision ?? 1;
    const requestedRevision = input.campaignPackageRevision ?? currentRevision;
    if (requestedRevision !== currentRevision && !input.allowOverride) {
      throw new BadRequestException({
        code: "CREATIVE_SOURCE_REVISION_INVALID",
        message:
          "Campaign package revision does not match the current revision.",
      });
    }

    if (
      !APPROVED_PACKAGE_STATUSES.has(campaignPackage.status) &&
      !input.allowOverride
    ) {
      throw new BadRequestException({
        code: "CREATIVE_SOURCE_NOT_APPROVED",
        message:
          "Only approved or corrected campaign packages can generate creative assets.",
      });
    }

    if (
      REJECTED_PACKAGE_STATUSES.has(campaignPackage.status) &&
      !APPROVED_PACKAGE_STATUSES.has(campaignPackage.status) &&
      !input.allowOverride
    ) {
      throw new BadRequestException({
        code: "CREATIVE_SOURCE_NOT_APPROVED",
        message: `Campaign package status '${campaignPackage.status}' cannot generate creative assets.`,
      });
    }

    const reviewReasonCodes: CreativeReviewReasonCode[] = [];
    const packageReasons = campaignPackage.reviewReasonCodes ?? [];
    if (packageReasons.includes("regulated_domain")) {
      reviewReasonCodes.push("medical_campaign");
    }
    if (packageReasons.includes("payment_service")) {
      reviewReasonCodes.push("payment_campaign");
    }
    if (campaignPackage.requiresReview) {
      reviewReasonCodes.push("manual_review_requested");
    }

    const allBriefs: CreativeBriefRef[] = [
      ...asBriefArray(campaignPackage.imageCreativeBriefs, "image"),
      ...asBriefArray(campaignPackage.videoCreativeBriefs, "video"),
      ...asBriefArray(campaignPackage.carouselBriefs, "carousel"),
      ...asBriefArray(campaignPackage.storySequences, "story"),
    ];

    let briefs = allBriefs;
    if (input.selectedBriefIds && input.selectedBriefIds.length > 0) {
      const selected = new Set(input.selectedBriefIds);
      briefs = allBriefs.filter((brief) => selected.has(brief.briefId));
      for (const briefId of input.selectedBriefIds) {
        if (!allBriefs.some((brief) => brief.briefId === briefId)) {
          throw new BadRequestException({
            code: "CREATIVE_BRIEF_NOT_FOUND",
            message: `Creative brief ${briefId} was not found on the campaign package.`,
          });
        }
      }
    }

    if (briefs.length === 0) {
      throw new BadRequestException({
        code: "CREATIVE_BRIEF_NOT_FOUND",
        message: "No creative briefs are available on the campaign package.",
      });
    }

    return {
      campaignPackage: {
        campaignPackageId: campaignPackage.campaignPackageId,
        campaignId: campaignPackage.campaignId,
        campaignBriefId: campaignPackage.campaignBriefId,
        status: campaignPackage.status,
        currentRevision,
        brandProfileId: campaignPackage.brandProfileId,
        brandProfileVersion: campaignPackage.brandProfileVersion,
        platformPolicyVersion: campaignPackage.platformPolicyVersion,
        compliancePolicyVersion: campaignPackage.compliancePolicyVersion,
        selectedPlatforms: campaignPackage.selectedPlatforms ?? [],
        targetLanguages: campaignPackage.targetLanguages ?? [],
        targetLocales: campaignPackage.targetLocales ?? [],
        requiredDisclosures:
          (campaignPackage.requiredDisclosures as Record<string, unknown>) ?? {},
        reviewReasonCodes: packageReasons,
        selectedServices: campaignPackage.selectedServices ?? [],
        correlationId: campaignPackage.correlationId,
        createdBy: campaignPackage.createdBy,
      },
      briefs,
      reviewReasonCodes: [...new Set(reviewReasonCodes)],
    };
  }
}
