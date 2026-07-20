/**
 * Prompt 4 — Campaign intelligence, multilingual transcreation, and campaign package contracts.
 * NestJS validation/approval is authoritative; AI providers only suggest content.
 */
import type { LanguageCode, LocaleCode, TextDirection } from "./language-registry.js";
import { PAYMENT_COMPLIANCE_DISCLAIMERS } from "./business-intelligence.js";

export const CAMPAIGN_OBJECTIVES = [
  "brand_awareness",
  "service_awareness",
  "product_awareness",
  "education",
  "thought_leadership",
  "engagement",
  "community_growth",
  "lead_generation",
  "consultation_request",
  "demo_request",
  "quote_request",
  "website_visit",
  "landing_page_visit",
  "whatsapp_contact",
  "phone_contact",
  "email_contact",
  "application_signup",
  "account_registration",
  "trial_request",
  "booking_request",
  "event_registration",
  "content_download",
  "retargeting",
  "customer_reactivation",
  "upsell",
  "cross_sell",
  "product_launch",
  "service_launch",
  "market_entry",
  "local_business_growth",
  "recruitment",
  "partnership_interest",
  "referral_interest",
  "unknown",
] as const;
export type CampaignObjective = (typeof CAMPAIGN_OBJECTIVES)[number];

export const FUNNEL_STAGES = [
  "awareness",
  "problem_awareness",
  "consideration",
  "solution_comparison",
  "decision",
  "conversion",
  "onboarding",
  "retention",
  "expansion",
  "reactivation",
  "advocacy",
] as const;
export type FunnelStage = (typeof FUNNEL_STAGES)[number];

export const CAMPAIGN_TYPES = [
  "single_service_campaign",
  "service_bundle_campaign",
  "industry_campaign",
  "market_campaign",
  "local_campaign",
  "multilingual_campaign",
  "educational_campaign",
  "lead_generation_campaign",
  "consultation_campaign",
  "product_launch_campaign",
  "service_launch_campaign",
  "comparison_campaign",
  "retargeting_campaign",
  "event_campaign",
  "content_series",
  "social_series",
  "short_video_series",
  "thought_leadership_series",
  "awareness_series",
  "conversion_series",
  "recruitment_campaign",
  "partnership_campaign",
] as const;
export type CampaignType = (typeof CAMPAIGN_TYPES)[number];

export const CAMPAIGN_PLATFORMS = [
  "facebook",
  "instagram",
  "linkedin",
  "tiktok",
  "youtube",
  "youtube_shorts",
  "x",
  "telegram",
  "whatsapp_status",
  "email",
  "website_blog",
  "website_service_page",
  "generic_social",
] as const;
export type CampaignPlatform = (typeof CAMPAIGN_PLATFORMS)[number];

export const CONTENT_FORMATS = [
  "short_post",
  "long_post",
  "text_thread",
  "article",
  "blog_outline",
  "service_page_outline",
  "email_subject",
  "email_body",
  "carousel",
  "carousel_slide",
  "story",
  "story_sequence",
  "reel",
  "short_video",
  "long_video",
  "video_script",
  "voiceover_script",
  "storyboard",
  "shot_list",
  "image_post",
  "image_brief",
  "thumbnail_brief",
  "infographic_brief",
  "poll",
  "question_post",
  "educational_post",
  "case_scenario",
  "faq_post",
  "comparison_post",
  "myth_fact_post",
  "checklist_post",
  "announcement",
  "launch_post",
  "testimonial_structure",
  "call_to_action",
  "hashtag_set",
  "keyword_set",
] as const;
export type ContentFormat = (typeof CONTENT_FORMATS)[number];

export const CTA_CODES = [
  "learn_more",
  "discover_service",
  "visit_website",
  "request_consultation",
  "request_demo",
  "request_quote",
  "contact_us",
  "contact_whatsapp",
  "call_now",
  "send_email",
  "book_discovery",
  "register_interest",
  "download_guide",
  "view_case_study",
  "compare_options",
  "start_project",
  "join_waitlist",
  "follow_page",
  "save_post",
  "share_post",
  "comment_question",
  "no_direct_cta",
] as const;
export type CtaCode = (typeof CTA_CODES)[number];

export const LOCALIZATION_MODES = [
  "source_language_only",
  "direct_translation",
  "localized_translation",
  "transcreation",
  "market_specific_generation",
  "bilingual_variant",
  "multilingual_package",
] as const;
export type LocalizationMode = (typeof LOCALIZATION_MODES)[number];

export const CLAIM_STATES = [
  "approved",
  "source_supported",
  "requires_evidence",
  "prohibited",
  "unknown",
  "human_review_required",
] as const;
export type ClaimState = (typeof CLAIM_STATES)[number];

export const CAMPAIGN_JOB_STATUSES = [
  "created",
  "queued",
  "active",
  "loading_source",
  "building_brief",
  "building_strategy",
  "generating_master",
  "generating_platforms",
  "transcreating",
  "validating",
  "scoring",
  "awaiting_review",
  "completed",
  "failed",
  "cancelled",
  "dead_letter",
  "reused",
] as const;
export type CampaignJobStatus = (typeof CAMPAIGN_JOB_STATUSES)[number];

export const CAMPAIGN_PACKAGE_STATUSES = [
  "generated",
  "awaiting_review",
  "approved",
  "corrected",
  "rejected",
  "superseded",
  "failed",
] as const;
export type CampaignPackageStatus = (typeof CAMPAIGN_PACKAGE_STATUSES)[number];

export const CAMPAIGN_BRIEF_STATUSES = [
  "draft",
  "generated",
  "awaiting_review",
  "approved",
  "corrected",
  "rejected",
  "superseded",
  "failed",
] as const;
export type CampaignBriefStatus = (typeof CAMPAIGN_BRIEF_STATUSES)[number];

export const CAMPAIGN_REVIEW_STATUSES = [
  "pending",
  "approved",
  "corrected",
  "rejected",
  "needs_regeneration",
  "needs_translation_review",
  "needs_compliance_review",
] as const;
export type CampaignReviewStatus = (typeof CAMPAIGN_REVIEW_STATUSES)[number];

export const CAMPAIGN_REVIEW_REASON_CODES = [
  "source_review_required",
  "audience_ambiguous",
  "decision_maker_uncertain",
  "promotion_eligibility_uncertain",
  "unsuitable_target",
  "regulated_domain",
  "payment_service",
  "provider_dependency",
  "country_availability_unknown",
  "tier3_language",
  "untested_locale",
  "translation_unavailable",
  "low_translation_confidence",
  "semantic_drift",
  "protected_term_changed",
  "missing_disclosure",
  "unsupported_claim",
  "evidence_required",
  "invalid_destination",
  "platform_policy_unverified",
  "low_brand_score",
  "low_compliance_score",
  "low_language_score",
  "low_overall_quality",
  "prompt_injection_detected",
  "service_message_conflict",
  "multilingual_variant_failed",
  "manual_review_requested",
] as const;
export type CampaignReviewReasonCode =
  (typeof CAMPAIGN_REVIEW_REASON_CODES)[number];

export const CAMPAIGN_ERROR_CODES = [
  "CAMPAIGN_SOURCE_NOT_FOUND",
  "CAMPAIGN_SOURCE_NOT_APPROVED",
  "CAMPAIGN_SOURCE_REVISION_INVALID",
  "CAMPAIGN_SOURCE_SUPERSEDED",
  "CAMPAIGN_SERVICE_NOT_RECOMMENDED",
  "CAMPAIGN_SERVICE_INACTIVE",
  "CAMPAIGN_AUDIENCE_INELIGIBLE",
  "CAMPAIGN_PROMOTION_UNSUITABLE",
  "CAMPAIGN_OBJECTIVE_INVALID",
  "CAMPAIGN_FUNNEL_STAGE_INVALID",
  "CAMPAIGN_TYPE_INVALID",
  "CAMPAIGN_PLATFORM_UNSUPPORTED",
  "CAMPAIGN_FORMAT_UNSUPPORTED",
  "CAMPAIGN_LANGUAGE_UNSUPPORTED",
  "CAMPAIGN_LOCALE_INVALID",
  "CAMPAIGN_COUNTRY_INVALID",
  "CAMPAIGN_TOO_MANY_PLATFORMS",
  "CAMPAIGN_TOO_MANY_LANGUAGES",
  "CAMPAIGN_TOO_MANY_SERVICES",
  "CAMPAIGN_DESTINATION_INVALID",
  "CAMPAIGN_JOB_ALREADY_EXISTS",
  "CAMPAIGN_JOB_NOT_RETRYABLE",
  "CAMPAIGN_JOB_CANCELLED",
  "CAMPAIGN_PROVIDER_DISABLED",
  "CAMPAIGN_PROVIDER_UNAVAILABLE",
  "CAMPAIGN_PROVIDER_TIMEOUT",
  "CAMPAIGN_PROVIDER_RATE_LIMITED",
  "CAMPAIGN_PROVIDER_INVALID_RESPONSE",
  "CAMPAIGN_SCHEMA_VALIDATION_FAILED",
  "CAMPAIGN_PROMPT_INJECTION_DETECTED",
  "CAMPAIGN_UNSUPPORTED_CLAIM",
  "CAMPAIGN_EVIDENCE_REQUIRED",
  "CAMPAIGN_MISSING_DISCLOSURE",
  "CAMPAIGN_PAYMENT_REVIEW_REQUIRED",
  "CAMPAIGN_REGULATED_REVIEW_REQUIRED",
  "CAMPAIGN_BRAND_VALIDATION_FAILED",
  "CAMPAIGN_COMPLIANCE_VALIDATION_FAILED",
  "CAMPAIGN_PLATFORM_VALIDATION_FAILED",
  "CAMPAIGN_QUALITY_REVIEW_REQUIRED",
  "CAMPAIGN_TRANSLATION_PROVIDER_DISABLED",
  "CAMPAIGN_TRANSLATION_PROVIDER_UNAVAILABLE",
  "CAMPAIGN_TRANSLATION_FAILED",
  "CAMPAIGN_TRANSLATION_LOW_CONFIDENCE",
  "CAMPAIGN_TRANSCREATION_FAILED",
  "CAMPAIGN_SEMANTIC_DRIFT",
  "CAMPAIGN_PROTECTED_TERM_CHANGED",
  "CAMPAIGN_LANGUAGE_VARIANT_FAILED",
  "CAMPAIGN_PACKAGE_NOT_FOUND",
  "CAMPAIGN_REVISION_CONFLICT",
  "CAMPAIGN_REVIEW_REQUIRED",
  "CAMPAIGN_REJECTED",
  "BRAND_PROFILE_NOT_FOUND",
  "BRAND_PROFILE_INACTIVE",
  "PLATFORM_POLICY_NOT_FOUND",
  "PLATFORM_POLICY_INACTIVE",
  "COMPLIANCE_POLICY_NOT_FOUND",
  "GLOSSARY_NOT_FOUND",
  "GLOSSARY_INACTIVE",
] as const;
export type CampaignErrorCode = (typeof CAMPAIGN_ERROR_CODES)[number];

export const AI_CAMPAIGN_QUEUE_NAMES = {
  CAMPAIGNS: "miraaj.ai.campaigns",
  DEAD_LETTER: "miraaj.ai.campaigns.dead-letter",
} as const;

export const AI_CAMPAIGN_JOB_NAMES = {
  BUILD_CAMPAIGN_BRIEF: "build-campaign-brief",
  GENERATE_CAMPAIGN_STRATEGY: "generate-campaign-strategy",
  GENERATE_CAMPAIGN_PACKAGE: "generate-campaign-package",
  TRANSCREATE_CAMPAIGN: "transcreate-campaign",
  VALIDATE_CAMPAIGN: "validate-campaign",
  REGENERATE_CAMPAIGN: "regenerate-campaign",
} as const;

export const CAMPAIGN_PROMPT_PURPOSES = [
  "campaign.strategy",
  "campaign.master-message",
  "campaign.platform-copy",
  "campaign.image-brief",
  "campaign.video-brief",
  "campaign.carousel",
  "campaign.story",
  "campaign.transcreation",
  "campaign.quality-check",
  "campaign.compliance-check",
] as const;
export type CampaignPromptPurpose = (typeof CAMPAIGN_PROMPT_PURPOSES)[number];

export const PROHIBITED_CAMPAIGN_CLAIM_PATTERNS = [
  /guaranteed\s+(merchant\s+)?approval/i,
  /guaranteed\s+results?/i,
  /increase\s+revenue\s+by\s+\d+/i,
  /no\s+kyc/i,
  /no\s+kyb/i,
  /anonymous\s+(business\s+)?bank/i,
  /unhackable/i,
  /perfect\s+security/i,
  /number\s+one\b/i,
  /300\s*%/i,
] as const;

export function containsProhibitedCampaignClaim(text: string): boolean {
  return PROHIBITED_CAMPAIGN_CLAIM_PATTERNS.some((pattern) => pattern.test(text));
}

export const CAMPAIGN_PAYMENT_DISCLOSURES = PAYMENT_COMPLIANCE_DISCLAIMERS;

export const PROTECTED_CAMPAIGN_TERMS = [
  "Miraaj.tech",
  "Tasks.cash",
] as const;

export interface CampaignQualityBreakdown {
  sourceQualityScore: number;
  audienceFitScore: number;
  decisionMakerFitScore: number;
  objectiveFitScore: number;
  funnelStageFitScore: number;
  serviceFactScore: number;
  valuePropositionScore: number;
  brandVoiceScore: number;
  messageClarityScore: number;
  claimSafetyScore: number;
  complianceScore: number;
  platformFitScore: number;
  formatFitScore: number;
  ctaFitScore: number;
  languageQualityScore: number;
  semanticPreservationScore: number;
  transcreationQualityScore: number;
  culturalSensitivityScore: number;
  accessibilityScore: number;
  contentOriginalityScore: number;
  overallQualityScore: number;
}

export interface CampaignLocaleMeta {
  language: LanguageCode;
  locale: LocaleCode;
  direction: TextDirection | "auto" | "mixed";
}
