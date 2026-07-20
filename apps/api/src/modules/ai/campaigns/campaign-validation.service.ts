import { Injectable } from "@nestjs/common";
import {
  containsProhibitedCampaignClaim,
  type CampaignErrorCode,
  type CampaignPlatform,
  type CampaignReviewReasonCode,
  type CtaCode,
} from "@miraaj/shared-types";

/** CTA codes that require a concrete destination before publication review. */
const DESTINATION_REQUIRED_CTA_CODES: ReadonlySet<CtaCode> = new Set([
  "discover_service",
  "visit_website",
  "request_consultation",
  "request_demo",
  "request_quote",
  "book_discovery",
  "register_interest",
  "download_guide",
  "view_case_study",
  "compare_options",
  "start_project",
  "join_waitlist",
]);

/** Matches bare percentage/multiplier statistics such as "45%" or "3x". */
const NUMERIC_STATISTIC_PATTERN = /\b\d{1,4}(?:\.\d+)?\s*(?:%|x\b|percent\b)/gi;

/** Matches common prompt-injection attempts embedded in generated/source text. */
const PROMPT_INJECTION_PATTERN =
  /ignore (all|previous) (rules|instructions)|guarantee approval|publish now/i;

export interface PlatformLimits {
  maxHeadlineChars: number;
  maxPrimaryTextChars: number;
  maxShortTextChars: number;
  maxHashtags: number;
  maxKeywords: number;
}

export interface PlatformVariantValidationInput {
  platform: CampaignPlatform;
  headline: string;
  primaryText: string;
  shortText: string;
  hashtags: readonly string[];
  keywords: readonly string[];
  ctaCode: CtaCode;
  destinationUrl: string | null;
}

export interface CampaignValidationContext {
  involvesPayment: boolean;
  isRegulatedDomain: boolean;
  brandProhibitedPhrases: readonly string[];
  /** Statistics explicitly present in the brief's verified key messages/evidence. */
  verifiedStatistics: readonly string[];
  paymentDisclosureText: string | null;
  platformLimits: PlatformLimits | null;
}

export interface PlatformVariantValidationResult {
  valid: boolean;
  reasonCodes: CampaignReviewReasonCode[];
  errorCodes: CampaignErrorCode[];
  requiresPaymentReview: boolean;
  requiresRegulatedReview: boolean;
  normalizedCtaCode: CtaCode;
  appliedDisclaimer: string | null;
}

function isValidHttpUrl(value: string | null): boolean {
  if (!value) {
    return false;
  }
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function findUnverifiedStatistics(
  text: string,
  verifiedStatistics: readonly string[],
): string[] {
  const matches = text.match(NUMERIC_STATISTIC_PATTERN) ?? [];
  const verifiedSet = new Set(verifiedStatistics.map((value) => value.toLowerCase()));
  return matches.filter((match) => !verifiedSet.has(match.toLowerCase()));
}

/**
 * Deterministic validation layers for a single platform variant — claims,
 * disclosures, brand, platform structural limits, and CTA destination. Pure
 * and reproducible: given the same input it always returns the same result.
 */
@Injectable()
export class CampaignValidationService {
  /** Detects prompt-injection / instruction-override attempts in a batch of texts. */
  detectPromptInjection(texts: readonly string[]): boolean {
    return texts.some((text) => PROMPT_INJECTION_PATTERN.test(text));
  }

  validatePlatformVariant(
    input: PlatformVariantValidationInput,
    context: CampaignValidationContext,
  ): PlatformVariantValidationResult {
    const reasonCodes = new Set<CampaignReviewReasonCode>();
    const errorCodes = new Set<CampaignErrorCode>();
    const combinedText = `${input.headline} ${input.primaryText} ${input.shortText}`;

    // 1. Claims — prohibited patterns and fabricated/unverified statistics.
    if (containsProhibitedCampaignClaim(combinedText)) {
      reasonCodes.add("unsupported_claim");
      errorCodes.add("CAMPAIGN_UNSUPPORTED_CLAIM");
    }
    const unverifiedStats = findUnverifiedStatistics(
      combinedText,
      context.verifiedStatistics,
    );
    if (unverifiedStats.length > 0) {
      reasonCodes.add("unsupported_claim");
      reasonCodes.add("evidence_required");
      errorCodes.add("CAMPAIGN_EVIDENCE_REQUIRED");
    }

    // 2. Disclosures — payment involvement must always carry the compliance disclosure.
    let appliedDisclaimer: string | null = null;
    if (context.involvesPayment) {
      appliedDisclaimer = context.paymentDisclosureText;
      if (!context.paymentDisclosureText) {
        reasonCodes.add("missing_disclosure");
        errorCodes.add("CAMPAIGN_MISSING_DISCLOSURE");
      }
    }
    const requiresPaymentReview = context.involvesPayment;
    if (requiresPaymentReview) {
      reasonCodes.add("payment_service");
    }
    const requiresRegulatedReview = context.isRegulatedDomain;
    if (requiresRegulatedReview) {
      reasonCodes.add("regulated_domain");
    }

    // 3. Brand — prohibited phrases from the active brand profile.
    const lowerText = combinedText.toLowerCase();
    const brandViolation = context.brandProhibitedPhrases.some((phrase) =>
      lowerText.includes(phrase.toLowerCase()),
    );
    if (brandViolation) {
      reasonCodes.add("low_brand_score");
      errorCodes.add("CAMPAIGN_BRAND_VALIDATION_FAILED");
    }

    // 4. Platform structural limits.
    if (context.platformLimits) {
      const limits = context.platformLimits;
      const overLimit =
        input.headline.length > limits.maxHeadlineChars ||
        input.primaryText.length > limits.maxPrimaryTextChars ||
        input.shortText.length > limits.maxShortTextChars ||
        input.hashtags.length > limits.maxHashtags ||
        input.keywords.length > limits.maxKeywords;
      if (overLimit) {
        reasonCodes.add("platform_policy_unverified");
        errorCodes.add("CAMPAIGN_PLATFORM_VALIDATION_FAILED");
      }
    }

    // 5. CTA destination — downgrade to a safe fallback instead of publishing a dead link.
    let normalizedCtaCode = input.ctaCode;
    if (
      DESTINATION_REQUIRED_CTA_CODES.has(input.ctaCode) &&
      !isValidHttpUrl(input.destinationUrl)
    ) {
      normalizedCtaCode = "no_direct_cta";
      reasonCodes.add("invalid_destination");
      errorCodes.add("CAMPAIGN_DESTINATION_INVALID");
    }

    const valid =
      !errorCodes.has("CAMPAIGN_UNSUPPORTED_CLAIM") &&
      !errorCodes.has("CAMPAIGN_MISSING_DISCLOSURE") &&
      !errorCodes.has("CAMPAIGN_BRAND_VALIDATION_FAILED") &&
      !errorCodes.has("CAMPAIGN_PLATFORM_VALIDATION_FAILED");

    return {
      valid,
      reasonCodes: [...reasonCodes],
      errorCodes: [...errorCodes],
      requiresPaymentReview,
      requiresRegulatedReview,
      normalizedCtaCode,
      appliedDisclaimer,
    };
  }
}
