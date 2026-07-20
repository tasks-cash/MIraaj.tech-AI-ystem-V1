import { Injectable } from "@nestjs/common";
import type { CampaignQualityBreakdown } from "@miraaj/shared-types";
import type { PlatformVariantValidationResult } from "./campaign-validation.service.js";

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export interface QualityScoringInput {
  sourceQualityScore: number;
  audienceFitScore: number;
  decisionMakerFitScore: number;
  objectiveFitScore: number;
  funnelStageFitScore: number;
  validationResults: readonly PlatformVariantValidationResult[];
  languageVariantScores: readonly {
    semanticPreservationScore: number | null;
    requiresReview: boolean;
  }[];
}

/** Weighted contribution of each score to the overall quality score. */
const QUALITY_WEIGHTS: Record<keyof CampaignQualityBreakdown, number> = {
  sourceQualityScore: 0.04,
  audienceFitScore: 0.08,
  decisionMakerFitScore: 0.05,
  objectiveFitScore: 0.05,
  funnelStageFitScore: 0.03,
  serviceFactScore: 0.06,
  valuePropositionScore: 0.05,
  brandVoiceScore: 0.08,
  messageClarityScore: 0.05,
  claimSafetyScore: 0.1,
  complianceScore: 0.12,
  platformFitScore: 0.06,
  formatFitScore: 0.03,
  ctaFitScore: 0.05,
  languageQualityScore: 0.04,
  semanticPreservationScore: 0.05,
  transcreationQualityScore: 0.03,
  culturalSensitivityScore: 0.03,
  accessibilityScore: 0.02,
  contentOriginalityScore: 0.02,
  overallQualityScore: 0,
};

/**
 * Deterministic quality scoring (Prompt 4 §43-44) — combines brief fit,
 * deterministic validation outcomes, and transcreation fidelity into a
 * single reproducible breakdown. AI providers never set these scores.
 */
@Injectable()
export class CampaignQualityService {
  score(input: QualityScoringInput): CampaignQualityBreakdown {
    const hasClaimIssue = input.validationResults.some((result) =>
      result.errorCodes.includes("CAMPAIGN_UNSUPPORTED_CLAIM"),
    );
    const hasComplianceIssue = input.validationResults.some(
      (result) =>
        result.errorCodes.includes("CAMPAIGN_MISSING_DISCLOSURE") ||
        !result.valid,
    );
    const hasBrandIssue = input.validationResults.some((result) =>
      result.errorCodes.includes("CAMPAIGN_BRAND_VALIDATION_FAILED"),
    );
    const hasPlatformIssue = input.validationResults.some((result) =>
      result.errorCodes.includes("CAMPAIGN_PLATFORM_VALIDATION_FAILED"),
    );
    const hasDestinationIssue = input.validationResults.some((result) =>
      result.errorCodes.includes("CAMPAIGN_DESTINATION_INVALID"),
    );

    const semanticScores = input.languageVariantScores
      .map((variant) => variant.semanticPreservationScore)
      .filter((score): score is number => score !== null);
    const averageSemanticScore =
      semanticScores.length === 0
        ? 1
        : semanticScores.reduce((sum, score) => sum + score, 0) / semanticScores.length;
    const anyTranslationReviewNeeded = input.languageVariantScores.some(
      (variant) => variant.requiresReview,
    );

    const breakdown: CampaignQualityBreakdown = {
      sourceQualityScore: clamp01(input.sourceQualityScore),
      audienceFitScore: clamp01(input.audienceFitScore),
      decisionMakerFitScore: clamp01(input.decisionMakerFitScore),
      objectiveFitScore: clamp01(input.objectiveFitScore),
      funnelStageFitScore: clamp01(input.funnelStageFitScore),
      serviceFactScore: hasClaimIssue ? 0.3 : 1,
      valuePropositionScore: 0.9,
      brandVoiceScore: hasBrandIssue ? 0.4 : 1,
      messageClarityScore: 0.9,
      claimSafetyScore: hasClaimIssue ? 0.2 : 1,
      complianceScore: hasComplianceIssue ? 0.3 : 1,
      platformFitScore: hasPlatformIssue ? 0.4 : 1,
      formatFitScore: 0.95,
      ctaFitScore: hasDestinationIssue ? 0.6 : 1,
      languageQualityScore: anyTranslationReviewNeeded ? 0.7 : 0.95,
      semanticPreservationScore: clamp01(averageSemanticScore),
      transcreationQualityScore: clamp01(averageSemanticScore),
      culturalSensitivityScore: anyTranslationReviewNeeded ? 0.75 : 0.95,
      accessibilityScore: 0.9,
      contentOriginalityScore: 0.9,
      overallQualityScore: 0,
    };

    const weightedSum = (
      Object.keys(QUALITY_WEIGHTS) as (keyof CampaignQualityBreakdown)[]
    ).reduce((sum, key) => {
      if (key === "overallQualityScore") {
        return sum;
      }
      return sum + breakdown[key] * QUALITY_WEIGHTS[key];
    }, 0);
    const totalWeight = Object.values(QUALITY_WEIGHTS).reduce(
      (sum, weight) => sum + weight,
      0,
    );
    breakdown.overallQualityScore = clamp01(weightedSum / Math.max(totalWeight, 0.0001));

    return breakdown;
  }
}
