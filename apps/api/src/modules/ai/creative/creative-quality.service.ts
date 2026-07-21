import { Injectable } from "@nestjs/common";
import type {
  CreativeQualityBreakdown,
  CreativeQualityPenalties,
} from "@miraaj/shared-types";
import type { CreativeValidationResult } from "./creative-validation.service.js";

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export interface CreativeQualityInput {
  sourceBriefQualityScore: number;
  providerOutputQualityScore: number;
  technicalQualityScore: number;
  validation: CreativeValidationResult;
  isRtl?: boolean;
  hasSubtitles?: boolean;
  rightsConfidence: number;
}

const QUALITY_WEIGHTS: Record<keyof CreativeQualityBreakdown, number> = {
  sourceBriefQualityScore: 0.06,
  providerOutputQualityScore: 0.08,
  technicalQualityScore: 0.08,
  compositionScore: 0.06,
  subjectClarityScore: 0.06,
  brandFitScore: 0.08,
  textAccuracyScore: 0.08,
  OCRAccuracyScore: 0.08,
  languageQualityScore: 0.05,
  RTLLayoutScore: 0.04,
  subtitleQualityScore: 0.04,
  platformFitScore: 0.05,
  accessibilityScore: 0.04,
  complianceScore: 0.1,
  rightsConfidenceScore: 0.06,
  originalityScore: 0.04,
  overallQualityScore: 0,
};

/**
 * Deterministic creative quality scoring. Providers never set these scores.
 */
@Injectable()
export class CreativeQualityService {
  score(input: CreativeQualityInput): {
    breakdown: CreativeQualityBreakdown;
    penalties: CreativeQualityPenalties;
  } {
    const hasOcrIssue = input.validation.errorCodes.includes(
      "CREATIVE_OCR_MISMATCH",
    );
    const hasComplianceIssue =
      input.validation.errorCodes.includes(
        "CREATIVE_COMPLIANCE_VALIDATION_FAILED",
      ) ||
      input.validation.errorCodes.includes("CREATIVE_DISCLOSURE_MISSING") ||
      input.validation.errorCodes.includes("CREATIVE_BRAND_VALIDATION_FAILED");
    const hasRightsIssue =
      input.validation.errorCodes.includes("CREATIVE_RIGHTS_UNKNOWN") ||
      input.validation.errorCodes.includes("CREATIVE_RIGHTS_RESTRICTED") ||
      input.validation.errorCodes.includes("CREATIVE_COPYRIGHT_RISK");
    const hasLikenessIssue = input.validation.errorCodes.includes(
      "CREATIVE_LIKENESS_AUTHORIZATION_REQUIRED",
    );

    const breakdown: CreativeQualityBreakdown = {
      sourceBriefQualityScore: clamp01(input.sourceBriefQualityScore),
      providerOutputQualityScore: clamp01(input.providerOutputQualityScore),
      technicalQualityScore: clamp01(input.technicalQualityScore),
      compositionScore: 0.85,
      subjectClarityScore: 0.85,
      brandFitScore: hasComplianceIssue ? 0.4 : 0.95,
      textAccuracyScore: hasOcrIssue ? 0.3 : 0.95,
      OCRAccuracyScore: hasOcrIssue ? 0.2 : 0.95,
      languageQualityScore: 0.9,
      RTLLayoutScore: input.isRtl ? 0.85 : 1,
      subtitleQualityScore: input.hasSubtitles ? 0.9 : 0.8,
      platformFitScore: 0.9,
      accessibilityScore: 0.85,
      complianceScore: hasComplianceIssue ? 0.25 : 0.98,
      rightsConfidenceScore: hasRightsIssue
        ? clamp01(input.rightsConfidence * 0.4)
        : clamp01(input.rightsConfidence),
      originalityScore: 0.9,
      overallQualityScore: 0,
    };

    const weightedSum = (
      Object.keys(QUALITY_WEIGHTS) as (keyof CreativeQualityBreakdown)[]
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
    breakdown.overallQualityScore = clamp01(
      weightedSum / Math.max(totalWeight, 0.0001),
    );

    const penalties: CreativeQualityPenalties = {
      lowResolutionPenalty: 0,
      aspectRatioPenalty: 0,
      cropPenalty: 0,
      durationPenalty: 0,
      frameRatePenalty: 0,
      textMismatchPenalty: hasOcrIssue ? 0.3 : 0,
      OCRMismatchPenalty: hasOcrIssue ? 0.4 : 0,
      protectedTermPenalty: 0,
      disclosurePenalty: input.validation.errorCodes.includes(
        "CREATIVE_DISCLOSURE_MISSING",
      )
        ? 0.35
        : 0,
      brandMismatchPenalty: input.validation.errorCodes.includes(
        "CREATIVE_BRAND_VALIDATION_FAILED",
      )
        ? 0.3
        : 0,
      logoMismatchPenalty: 0,
      unsafeContentPenalty: hasComplianceIssue ? 0.25 : 0,
      rightsUncertaintyPenalty: hasRightsIssue ? 0.4 : 0,
      likenessRiskPenalty: hasLikenessIssue ? 0.45 : 0,
      duplicateAssetPenalty: 0,
      providerWatermarkPenalty: 0,
      compressionArtifactPenalty: 0,
      subtitleReadabilityPenalty: 0,
      RTLFailurePenalty: 0,
      promptInjectionPenalty: 0,
    };

    return { breakdown, penalties };
  }
}
