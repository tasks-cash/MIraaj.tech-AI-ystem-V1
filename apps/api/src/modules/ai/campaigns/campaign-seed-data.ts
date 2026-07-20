import {
  CAMPAIGN_PAYMENT_DISCLOSURES,
  CAMPAIGN_PLATFORMS,
  PROHIBITED_CAMPAIGN_CLAIM_PATTERNS,
  PROTECTED_CAMPAIGN_TERMS,
  REGULATED_BUSINESS_TYPES,
  type CampaignPlatform,
} from "@miraaj/shared-types";

export const BRAND_PROFILE_SEED_VERSION_NUMBER = 1;
export const CAMPAIGN_POLICY_SEED_VERSION_NUMBER = 1;
export const PLATFORM_POLICY_SEED_VERSION_NUMBER = 1;
export const COMPLIANCE_POLICY_SEED_VERSION_NUMBER = 1;
export const TRANSLATION_GLOSSARY_SEED_VERSION_NUMBER = 1;

/**
 * Prompt 4 initial Miraaj.tech brand voice — factual, non-hype, no fake
 * urgency, no guaranteed outcomes. AI providers must operate strictly
 * within these boundaries; NestJS validation is authoritative regardless.
 */
export const MIRAAJ_BRAND_PROFILE_SEED = {
  brandName: "Miraaj.tech",
  primaryDomain: "miraaj.tech",
  brandAliases: ["Miraaj", "Miraaj Tech"],
  protectedTerms: [...PROTECTED_CAMPAIGN_TERMS],
  prohibitedSpellings: ["Mirage.tech", "Meraaj.tech", "Miraj.tech"],
  toneAttributes: [
    "professional",
    "clear",
    "factual",
    "consultative",
    "respectful",
    "practical",
  ],
  toneRestrictions: [
    "no_fear_tactics",
    "no_fake_urgency",
    "no_guaranteed_outcomes",
    "no_hype_language",
    "no_unverifiable_statistics",
    "no_comparative_superiority_claims",
  ],
  approvedValuePropositions: [
    "Practical digital systems matched to approved service recommendations",
    "Operational clarity for day-to-day business workflows",
    "Structured onboarding support for licensed third-party providers",
  ],
  approvedCapabilities: [
    "workflow_systems",
    "digital_presence",
    "operational_tooling",
    "payment_integration_support",
  ],
  approvedProofTypes: ["capability_description", "process_explanation", "service_scope"],
  prohibitedClaims: PROHIBITED_CAMPAIGN_CLAIM_PATTERNS.map((pattern) => pattern.source),
  approvedDisclosures: { payment: CAMPAIGN_PAYMENT_DISCLOSURES },
  contactPolicies: { allowDirectPhoneInAds: false, allowWhatsappCta: true },
  platformToneOverrides: {},
  languageToneOverrides: {},
  terminologyGlossary: [],
  visualLanguageGuidance: [
    "Professional business context showing workflow tools.",
    "No fake logos, fake awards, or real person likeness.",
  ],
  imageRestrictions: ["no_fake_awards", "no_fake_client_logos", "no_real_person_likeness"],
  videoRestrictions: ["no_fake_testimonials", "no_guaranteed_results"],
  accessibilityGuidance: ["Provide alt text for all image creatives."],
  complianceRules: [
    "Payment-related content must always carry the payment compliance disclosure.",
    "Regulated-domain content always requires human review before approval.",
  ],
  createdBy: "system-seed",
};

/** Conservative structural length limits per platform (characters). */
export const PLATFORM_LENGTH_LIMITS: Record<
  CampaignPlatform,
  { headline: number; primaryText: number; shortText: number }
> = {
  facebook: { headline: 40, primaryText: 2_200, shortText: 125 },
  instagram: { headline: 40, primaryText: 2_200, shortText: 125 },
  linkedin: { headline: 70, primaryText: 3_000, shortText: 150 },
  tiktok: { headline: 40, primaryText: 2_200, shortText: 100 },
  youtube: { headline: 100, primaryText: 5_000, shortText: 150 },
  youtube_shorts: { headline: 100, primaryText: 1_000, shortText: 100 },
  x: { headline: 70, primaryText: 280, shortText: 280 },
  telegram: { headline: 100, primaryText: 4_096, shortText: 200 },
  whatsapp_status: { headline: 40, primaryText: 700, shortText: 200 },
  email: { headline: 78, primaryText: 5_000, shortText: 150 },
  website_blog: { headline: 120, primaryText: 20_000, shortText: 300 },
  website_service_page: { headline: 120, primaryText: 10_000, shortText: 300 },
  generic_social: { headline: 60, primaryText: 2_200, shortText: 150 },
};

export const PLATFORM_POLICY_SEED = CAMPAIGN_PLATFORMS.map((platform) => ({
  platformId: platform,
  version: 1,
  status: "active" as const,
  supportedCampaignObjectives: [],
  supportedContentFormats: [],
  supportedLanguages: ["ar", "en", "fr"],
  textFieldDefinitions: {},
  maximumConfiguredLengths: PLATFORM_LENGTH_LIMITS[platform],
  recommendedConfiguredLengths: PLATFORM_LENGTH_LIMITS[platform],
  hashtagSupport: !["email", "website_blog", "website_service_page"].includes(platform),
  linkSupport: true,
  titleSupport: true,
  descriptionSupport: true,
  captionSupport: true,
  threadSupport: platform === "x",
  carouselSupport: ["facebook", "instagram", "linkedin"].includes(platform),
  storySupport: ["facebook", "instagram", "whatsapp_status"].includes(platform),
  shortVideoSupport: ["tiktok", "instagram", "youtube_shorts"].includes(platform),
  longVideoSupport: ["youtube", "facebook"].includes(platform),
  thumbnailSupport: ["youtube", "youtube_shorts", "tiktok"].includes(platform),
  ctaSupport: true,
  accessibilityRequirements: ["alt_text_required_for_images"],
  complianceNotes: [],
  versionSource: "miraaj-platform-policy-v1",
}));

export const COMPLIANCE_POLICY_SEED = {
  paymentDisclosures: CAMPAIGN_PAYMENT_DISCLOSURES,
  regulatedDomains: [...REGULATED_BUSINESS_TYPES],
  prohibitedClaimPatterns: PROHIBITED_CAMPAIGN_CLAIM_PATTERNS.map(
    (pattern) => pattern.source,
  ),
  alwaysRequireReviewFor: ["payment", "regulated"],
  createdBy: "system-seed",
};

export const TRANSLATION_GLOSSARY_SEED = {
  protectedTerms: [...PROTECTED_CAMPAIGN_TERMS],
  entries: PROTECTED_CAMPAIGN_TERMS.map((term) => ({
    term,
    doNotTranslate: true,
    notes: "Brand/product name — preserve verbatim in every language.",
  })),
  createdBy: "system-seed",
};
