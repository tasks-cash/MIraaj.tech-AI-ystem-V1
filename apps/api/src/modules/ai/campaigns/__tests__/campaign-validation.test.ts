import { describe, expect, it } from "vitest";
import { CampaignValidationService } from "../campaign-validation.service.js";

const validation = new CampaignValidationService();

const baseContext = {
  involvesPayment: false,
  isRegulatedDomain: false,
  brandProhibitedPhrases: ["number one in the region"],
  verifiedStatistics: [] as string[],
  paymentDisclosureText: null,
  platformLimits: {
    maxHeadlineChars: 60,
    maxPrimaryTextChars: 200,
    maxShortTextChars: 100,
    maxHashtags: 5,
    maxKeywords: 10,
  },
};

const baseVariant = {
  platform: "facebook" as const,
  headline: "Practical systems for clinics",
  primaryText: "Miraaj.tech helps clinics explore approved digital systems.",
  shortText: "Explore approved digital systems.",
  hashtags: ["#Miraaj"],
  keywords: ["clinic_management"],
  ctaCode: "request_consultation" as const,
  destinationUrl: "https://miraaj.tech/contact",
};

describe("Prompt 4 — CampaignValidationService platform/brand/CTA layers", () => {
  it("passes a clean, compliant platform variant", () => {
    const result = validation.validatePlatformVariant(baseVariant, baseContext);
    expect(result.valid).toBe(true);
    expect(result.reasonCodes).toHaveLength(0);
    expect(result.normalizedCtaCode).toBe("request_consultation");
  });

  it("always flags regulated domains for human review, even when otherwise valid", () => {
    const result = validation.validatePlatformVariant(baseVariant, {
      ...baseContext,
      isRegulatedDomain: true,
    });
    expect(result.valid).toBe(true);
    expect(result.requiresRegulatedReview).toBe(true);
    expect(result.reasonCodes).toContain("regulated_domain");
  });

  it("rejects brand-prohibited phrases from the active brand profile", () => {
    const result = validation.validatePlatformVariant(
      { ...baseVariant, primaryText: "We are the number one in the region." },
      baseContext,
    );
    expect(result.valid).toBe(false);
    expect(result.errorCodes).toContain("CAMPAIGN_BRAND_VALIDATION_FAILED");
  });

  it("rejects content exceeding platform structural limits (Scenario length overflow)", () => {
    const result = validation.validatePlatformVariant(
      { ...baseVariant, primaryText: "x".repeat(500) },
      baseContext,
    );
    expect(result.valid).toBe(false);
    expect(result.errorCodes).toContain("CAMPAIGN_PLATFORM_VALIDATION_FAILED");
  });

  it("downgrades the CTA to no_direct_cta when the destination is missing (Scenario I)", () => {
    const result = validation.validatePlatformVariant(
      { ...baseVariant, destinationUrl: null },
      baseContext,
    );
    expect(result.normalizedCtaCode).toBe("no_direct_cta");
    expect(result.reasonCodes).toContain("invalid_destination");
    expect(result.errorCodes).toContain("CAMPAIGN_DESTINATION_INVALID");
  });

  it("downgrades the CTA when the destination is not a valid http(s) URL", () => {
    const result = validation.validatePlatformVariant(
      { ...baseVariant, destinationUrl: "not-a-url" },
      baseContext,
    );
    expect(result.normalizedCtaCode).toBe("no_direct_cta");
  });

  it("does not require a destination for CTAs that carry no direct link", () => {
    const result = validation.validatePlatformVariant(
      { ...baseVariant, ctaCode: "follow_page", destinationUrl: null },
      baseContext,
    );
    expect(result.normalizedCtaCode).toBe("follow_page");
    expect(result.reasonCodes).not.toContain("invalid_destination");
  });

  it("is deterministic — identical input always yields identical output", () => {
    const first = validation.validatePlatformVariant(baseVariant, baseContext);
    const second = validation.validatePlatformVariant(baseVariant, baseContext);
    expect(second).toEqual(first);
  });
});
