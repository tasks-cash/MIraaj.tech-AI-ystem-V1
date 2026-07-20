import { describe, expect, it } from "vitest";
import {
  CAMPAIGN_OBJECTIVES,
  FUNNEL_STAGES,
  CAMPAIGN_TYPES,
  CAMPAIGN_PLATFORMS,
  CONTENT_FORMATS,
  CTA_CODES,
  CAMPAIGN_REVIEW_REASON_CODES,
  CAMPAIGN_ERROR_CODES,
  AI_CAMPAIGN_QUEUE_NAMES,
  AI_CAMPAIGN_JOB_NAMES,
  CAMPAIGN_PROMPT_PURPOSES,
  CAMPAIGN_PAYMENT_DISCLOSURES,
  PROTECTED_CAMPAIGN_TERMS,
  containsProhibitedCampaignClaim,
} from "./campaign-intelligence.js";
import {
  asLanguageCode,
  asLocaleCode,
  getLanguageDefinition,
  isRtlLanguage,
} from "./language-registry.js";

describe("campaign-intelligence contracts", () => {
  it("defines controlled campaign taxonomies", () => {
    expect(CAMPAIGN_OBJECTIVES).toContain("consultation_request");
    expect(FUNNEL_STAGES).toContain("awareness");
    expect(CAMPAIGN_TYPES).toContain("multilingual_campaign");
    expect(CAMPAIGN_PLATFORMS).toContain("linkedin");
    expect(CONTENT_FORMATS).toContain("image_brief");
    expect(CTA_CODES).toContain("request_demo");
    expect(CAMPAIGN_REVIEW_REASON_CODES).toContain("payment_service");
  });

  it("uses Miraaj campaign queue and job names", () => {
    expect(AI_CAMPAIGN_QUEUE_NAMES.CAMPAIGNS).toBe("miraaj.ai.campaigns");
    expect(AI_CAMPAIGN_QUEUE_NAMES.DEAD_LETTER).toBe(
      "miraaj.ai.campaigns.dead-letter",
    );
    expect(AI_CAMPAIGN_JOB_NAMES.GENERATE_CAMPAIGN_PACKAGE).toBe(
      "generate-campaign-package",
    );
    expect(CAMPAIGN_PROMPT_PURPOSES).toContain("campaign.transcreation");
  });

  it("blocks prohibited claims and preserves payment disclosures", () => {
    expect(
      containsProhibitedCampaignClaim("Our customers increase revenue by 300%"),
    ).toBe(true);
    expect(
      containsProhibitedCampaignClaim("Guaranteed merchant approval"),
    ).toBe(true);
    expect(
      containsProhibitedCampaignClaim(CAMPAIGN_PAYMENT_DISCLOSURES.en),
    ).toBe(false);
    expect(CAMPAIGN_PAYMENT_DISCLOSURES.ar).toContain("Miraaj.tech");
    expect(CAMPAIGN_PAYMENT_DISCLOSURES.fr).toContain("Miraaj.tech");
    expect(PROTECTED_CAMPAIGN_TERMS).toContain("Miraaj.tech");
    expect(PROTECTED_CAMPAIGN_TERMS).toContain("Tasks.cash");
  });

  it("exposes stable campaign error codes", () => {
    expect(CAMPAIGN_ERROR_CODES).toContain("CAMPAIGN_AUDIENCE_INELIGIBLE");
    expect(CAMPAIGN_ERROR_CODES).toContain("CAMPAIGN_UNSUPPORTED_CLAIM");
    expect(CAMPAIGN_ERROR_CODES).toContain("CAMPAIGN_PROMPT_INJECTION_DETECTED");
  });

  it("keeps locale helpers and RTL metadata available for campaigns", () => {
    expect(asLocaleCode("en-US")).toBe("en-US");
    expect(asLanguageCode("ar")).toBe("ar");
    expect(isRtlLanguage("ar")).toBe(true);
    expect(isRtlLanguage("en")).toBe(false);
    expect(getLanguageDefinition("fr")?.supportTier).toBe(1);
  });
});
