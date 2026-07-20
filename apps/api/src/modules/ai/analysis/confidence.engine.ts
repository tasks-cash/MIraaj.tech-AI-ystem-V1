import type { ConfidenceBreakdown, ReviewReasonCode } from "@miraaj/shared-types";

export interface ConfidenceDecision {
  requiresReview: boolean;
  reviewReasonCodes: ReviewReasonCode[];
  autoComplete: boolean;
}

export function evaluateConfidence(input: {
  confidence: ConfidenceBreakdown;
  autoCompleteMin: number;
  reviewMin: number;
  lowBelow: number;
  ocrRequiresReview?: boolean;
  visionRequiresReview?: boolean;
}): ConfidenceDecision {
  const reviewReasonCodes: ReviewReasonCode[] = [];
  if (input.confidence.overallConfidence < input.reviewMin) {
    reviewReasonCodes.push("low_overall_confidence");
  }
  if (input.confidence.overallConfidence < input.lowBelow) {
    reviewReasonCodes.push("low_overall_confidence");
  }
  if (input.ocrRequiresReview) {
    reviewReasonCodes.push("ocr_unavailable");
  }
  if (input.visionRequiresReview) {
    reviewReasonCodes.push("provider_partial");
  }
  const uniqueReasons = [...new Set(reviewReasonCodes)];
  const requiresReview =
    uniqueReasons.length > 0 ||
    input.confidence.overallConfidence < input.autoCompleteMin;
  return {
    requiresReview,
    reviewReasonCodes: uniqueReasons,
    autoComplete:
      !requiresReview && input.confidence.overallConfidence >= input.autoCompleteMin,
  };
}
