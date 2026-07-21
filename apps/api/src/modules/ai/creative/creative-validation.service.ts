import { Injectable } from "@nestjs/common";
import {
  containsProhibitedCampaignClaim,
  containsProhibitedCreativeVisualClaim,
  type CreativeErrorCode,
  type CreativeReviewReasonCode,
  type CreativeRightsStatus,
} from "@miraaj/shared-types";

const LIKENESS_PATTERN =
  /\b(real\s+person|likeness|celebrity|patient\s+photo|before\s+and\s+after)\b/i;

const BRAND_NAME = "Miraaj.tech";

export interface CreativeValidationInput {
  brandName?: string | null;
  textOverlay?: string | null;
  expectedText?: string | null;
  ocrText?: string | null;
  disclosureText?: string | null;
  altText?: string | null;
  involvesPayment: boolean;
  paymentDisclosureRequired: string | null;
  isMedicalOrLegal: boolean;
  rightsStatus: CreativeRightsStatus;
  likenessDetected?: boolean;
}

export interface CreativeValidationResult {
  valid: boolean;
  reasonCodes: CreativeReviewReasonCode[];
  errorCodes: CreativeErrorCode[];
  requiresReview: boolean;
}

/**
 * Deterministic creative media validation — brand, prohibited visual claims,
 * payment disclosures, likeness flags, OCR mismatch, and rights status.
 */
@Injectable()
export class CreativeValidationService {
  validate(input: CreativeValidationInput): CreativeValidationResult {
    const reasonCodes = new Set<CreativeReviewReasonCode>();
    const errorCodes = new Set<CreativeErrorCode>();

    const combinedText = [
      input.textOverlay,
      input.expectedText,
      input.ocrText,
      input.altText,
      input.disclosureText,
    ]
      .filter((value): value is string => Boolean(value))
      .join(" ");

    if (input.brandName && input.brandName !== BRAND_NAME) {
      reasonCodes.add("compliance_warning");
      errorCodes.add("CREATIVE_BRAND_VALIDATION_FAILED");
    }

    if (
      containsProhibitedCreativeVisualClaim(combinedText) ||
      containsProhibitedCampaignClaim(combinedText)
    ) {
      reasonCodes.add("prohibited_element_warning");
      reasonCodes.add("fake_testimonial_risk");
      errorCodes.add("CREATIVE_COMPLIANCE_VALIDATION_FAILED");
    }

    if (/fake\s+testimonial/i.test(combinedText)) {
      reasonCodes.add("fake_testimonial_risk");
    }

    if (input.involvesPayment) {
      reasonCodes.add("payment_campaign");
      const disclosure =
        input.disclosureText?.trim() || input.paymentDisclosureRequired?.trim();
      if (!disclosure) {
        reasonCodes.add("altered_disclosure");
        errorCodes.add("CREATIVE_DISCLOSURE_MISSING");
      }
    }

    if (input.isMedicalOrLegal) {
      reasonCodes.add(
        input.isMedicalOrLegal ? "medical_campaign" : "legal_campaign",
      );
      reasonCodes.add("manual_review_requested");
    }

    if (input.likenessDetected || LIKENESS_PATTERN.test(combinedText)) {
      reasonCodes.add("real_person_likeness");
      reasonCodes.add("likeness_authorization_required");
      errorCodes.add("CREATIVE_LIKENESS_AUTHORIZATION_REQUIRED");
    }

    if (
      input.expectedText &&
      input.ocrText &&
      normalizeText(input.expectedText) !== normalizeText(input.ocrText)
    ) {
      reasonCodes.add("ocr_mismatch");
      errorCodes.add("CREATIVE_OCR_MISMATCH");
    }

    if (input.rightsStatus === "unknown") {
      reasonCodes.add("rights_uncertainty");
      errorCodes.add("CREATIVE_RIGHTS_UNKNOWN");
    }
    if (input.rightsStatus === "restricted") {
      reasonCodes.add("rights_uncertainty");
      errorCodes.add("CREATIVE_RIGHTS_RESTRICTED");
    }
    if (input.rightsStatus === "prohibited") {
      reasonCodes.add("copyright_risk");
      errorCodes.add("CREATIVE_COPYRIGHT_RISK");
    }

    const valid = errorCodes.size === 0;
    return {
      valid,
      reasonCodes: [...reasonCodes],
      errorCodes: [...errorCodes],
      requiresReview: true,
    };
  }
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}
