/**
 * Prompt 5 — Creative media generation, validation, and rendering contracts.
 * NestJS owns approval authority; FastAPI providers only generate/render media.
 */

export const CREATIVE_ASSET_TYPES = [
  "image_post",
  "square_image",
  "portrait_image",
  "landscape_image",
  "story_frame",
  "carousel_slide",
  "carousel_cover",
  "thumbnail",
  "banner",
  "infographic",
  "product_mockup",
  "interface_mockup",
  "short_video",
  "vertical_video",
  "landscape_video",
  "square_video",
  "reel",
  "short",
  "story_video",
  "explainer_video",
  "product_demo_video",
  "animated_graphic",
  "motion_graphic",
  "video_thumbnail",
  "poster_frame",
  "subtitle_file",
  "caption_file",
  "transcript_file",
  "preview_image",
  "preview_video",
] as const;
export type CreativeAssetType = (typeof CREATIVE_ASSET_TYPES)[number];

export const CREATIVE_GENERATION_JOB_STATUSES = [
  "created",
  "queued",
  "active",
  "loading_source",
  "validating_briefs",
  "generating",
  "provider_pending",
  "retrieving",
  "validating_media",
  "normalizing",
  "rendering_variants",
  "validating_text",
  "scoring",
  "awaiting_review",
  "completed",
  "failed",
  "cancelled",
  "dead_letter",
  "reused",
  "provider_unavailable",
] as const;
export type CreativeGenerationJobStatus =
  (typeof CREATIVE_GENERATION_JOB_STATUSES)[number];

export const CREATIVE_ASSET_STATUSES = [
  "created",
  "generating",
  "provider_pending",
  "downloading",
  "validating",
  "normalizing",
  "rendering",
  "awaiting_review",
  "approved",
  "corrected",
  "rejected",
  "failed",
  "cancelled",
  "superseded",
  "quarantined",
  "provider_unavailable",
] as const;
export type CreativeAssetStatus = (typeof CREATIVE_ASSET_STATUSES)[number];

export const CREATIVE_REVIEW_STATUSES = [
  "pending",
  "approved",
  "corrected",
  "rejected",
  "needs_regeneration",
  "needs_rights_review",
  "needs_compliance_review",
  "needs_language_review",
  "quarantined",
] as const;
export type CreativeReviewStatus = (typeof CREATIVE_REVIEW_STATUSES)[number];

export const CREATIVE_RIGHTS_STATUSES = [
  "verified",
  "review_required",
  "restricted",
  "prohibited",
  "unknown",
] as const;
export type CreativeRightsStatus = (typeof CREATIVE_RIGHTS_STATUSES)[number];

export const CREATIVE_REVIEW_REASON_CODES = [
  "generated_image",
  "generated_video",
  "real_person_likeness",
  "uploaded_reference",
  "medical_campaign",
  "legal_campaign",
  "payment_campaign",
  "financial_claim",
  "security_claim",
  "education_minor_context",
  "government_context",
  "tier3_language",
  "untested_locale",
  "ocr_mismatch",
  "compliance_warning",
  "prohibited_element_warning",
  "rights_uncertainty",
  "provider_watermark",
  "logo_use",
  "music_use",
  "low_quality",
  "altered_disclosure",
  "prompt_injection_indicator",
  "manual_review_requested",
  "fake_testimonial_risk",
  "copyright_risk",
  "likeness_authorization_required",
] as const;
export type CreativeReviewReasonCode =
  (typeof CREATIVE_REVIEW_REASON_CODES)[number];

export const CREATIVE_FEEDBACK_CATEGORIES = [
  "concept_correction",
  "composition_correction",
  "subject_correction",
  "environment_correction",
  "brand_correction",
  "logo_correction",
  "text_overlay_correction",
  "language_correction",
  "locale_correction",
  "RTL_correction",
  "subtitle_correction",
  "disclosure_correction",
  "compliance_correction",
  "rights_correction",
  "quality_correction",
  "crop_correction",
  "aspect_ratio_correction",
  "duration_correction",
  "color_correction",
  "accessibility_correction",
  "prohibited_element_removal",
  "likeness_rejection",
  "asset_approved",
  "asset_rejected",
] as const;
export type CreativeFeedbackCategory =
  (typeof CREATIVE_FEEDBACK_CATEGORIES)[number];

export const CREATIVE_PROMPT_PURPOSES = [
  "creative.image-generation",
  "creative.video-generation",
  "creative.image-variation",
  "creative.video-variation",
  "creative.text-overlay",
  "creative.thumbnail",
  "creative.story-frame",
  "creative.carousel-slide",
  "creative.quality-check",
  "creative.brand-check",
  "creative.compliance-check",
] as const;
export type CreativePromptPurpose = (typeof CREATIVE_PROMPT_PURPOSES)[number];

export const CREATIVE_ERROR_CODES = [
  "CREATIVE_SOURCE_NOT_FOUND",
  "CREATIVE_SOURCE_NOT_APPROVED",
  "CREATIVE_SOURCE_REVISION_INVALID",
  "CREATIVE_BRIEF_NOT_FOUND",
  "CREATIVE_BRIEF_NOT_APPROVED",
  "CREATIVE_ASSET_TYPE_INVALID",
  "CREATIVE_PLATFORM_UNSUPPORTED",
  "CREATIVE_LANGUAGE_UNSUPPORTED",
  "CREATIVE_LOCALE_INVALID",
  "CREATIVE_RENDER_SPEC_NOT_FOUND",
  "CREATIVE_PROVIDER_DISABLED",
  "CREATIVE_PROVIDER_UNAVAILABLE",
  "CREATIVE_PROVIDER_TIMEOUT",
  "CREATIVE_PROVIDER_RATE_LIMITED",
  "CREATIVE_PROVIDER_INVALID_RESPONSE",
  "CREATIVE_PROVIDER_JOB_FAILED",
  "CREATIVE_PROVIDER_JOB_CANCELLED",
  "CREATIVE_PROVIDER_OUTPUT_UNSAFE",
  "CREATIVE_PROVIDER_OUTPUT_DOWNLOAD_FAILED",
  "CREATIVE_PROVIDER_OUTPUT_TOO_LARGE",
  "CREATIVE_MEDIA_SIGNATURE_INVALID",
  "CREATIVE_MEDIA_DECODE_FAILED",
  "CREATIVE_MEDIA_DIMENSIONS_INVALID",
  "CREATIVE_MEDIA_DURATION_INVALID",
  "CREATIVE_MEDIA_FRAME_RATE_INVALID",
  "CREATIVE_MEDIA_CODEC_UNSUPPORTED",
  "CREATIVE_MEDIA_CORRUPTED",
  "CREATIVE_MEDIA_QUARANTINED",
  "CREATIVE_TEXT_VALIDATION_FAILED",
  "CREATIVE_OCR_MISMATCH",
  "CREATIVE_PROTECTED_TERM_CHANGED",
  "CREATIVE_DISCLOSURE_MISSING",
  "CREATIVE_BRAND_VALIDATION_FAILED",
  "CREATIVE_COMPLIANCE_VALIDATION_FAILED",
  "CREATIVE_RIGHTS_UNKNOWN",
  "CREATIVE_RIGHTS_RESTRICTED",
  "CREATIVE_LIKENESS_AUTHORIZATION_REQUIRED",
  "CREATIVE_COPYRIGHT_RISK",
  "CREATIVE_UNSAFE_CONTENT",
  "CREATIVE_QUALITY_REVIEW_REQUIRED",
  "CREATIVE_JOB_ALREADY_EXISTS",
  "CREATIVE_JOB_NOT_RETRYABLE",
  "CREATIVE_JOB_CANCELLED",
  "CREATIVE_ASSET_NOT_FOUND",
  "CREATIVE_REVISION_CONFLICT",
  "CREATIVE_REVIEW_REQUIRED",
  "CREATIVE_REJECTED",
  "CREATIVE_GENERATION_LIMIT_EXCEEDED",
] as const;
export type CreativeErrorCode = (typeof CREATIVE_ERROR_CODES)[number];

export const AI_CREATIVE_QUEUE_NAMES = {
  CREATIVE: "miraaj.ai.creative-generation",
  DEAD_LETTER: "miraaj.ai.creative-generation.dead-letter",
} as const;

export const AI_CREATIVE_JOB_NAMES = {
  GENERATE_IMAGE: "generate-image",
  GENERATE_VIDEO: "generate-video",
  RETRIEVE_PROVIDER_ASSET: "retrieve-provider-asset",
  VALIDATE_CREATIVE_ASSET: "validate-creative-asset",
  NORMALIZE_CREATIVE_ASSET: "normalize-creative-asset",
  RENDER_PLATFORM_VARIANTS: "render-platform-variants",
  VALIDATE_RENDERED_TEXT: "validate-rendered-text",
  REGENERATE_CREATIVE_ASSET: "regenerate-creative-asset",
  BUILD_CREATIVE_JOB: "build-creative-job",
} as const;

export const CREATIVE_IMAGE_PROVIDERS = ["disabled", "mock"] as const;
export type CreativeImageProvider = (typeof CREATIVE_IMAGE_PROVIDERS)[number];

export const CREATIVE_VIDEO_PROVIDERS = ["disabled", "mock"] as const;
export type CreativeVideoProvider = (typeof CREATIVE_VIDEO_PROVIDERS)[number];

export const CREATIVE_RENDER_PROVIDERS = ["local", "disabled"] as const;
export type CreativeRenderProvider = (typeof CREATIVE_RENDER_PROVIDERS)[number];

export const PROHIBITED_CREATIVE_VISUAL_PATTERNS = [
  /fake\s+testimonial/i,
  /before\s+and\s+after/i,
  /guaranteed\s+(results?|approval|cure)/i,
  /celebrity\s+(endorsement|likeness)/i,
  /deepfake/i,
  /unhackable/i,
] as const;

export function containsProhibitedCreativeVisualClaim(text: string): boolean {
  return PROHIBITED_CREATIVE_VISUAL_PATTERNS.some((pattern) =>
    pattern.test(text),
  );
}

export interface CreativeQualityBreakdown {
  sourceBriefQualityScore: number;
  providerOutputQualityScore: number;
  technicalQualityScore: number;
  compositionScore: number;
  subjectClarityScore: number;
  brandFitScore: number;
  textAccuracyScore: number;
  OCRAccuracyScore: number;
  languageQualityScore: number;
  RTLLayoutScore: number;
  subtitleQualityScore: number;
  platformFitScore: number;
  accessibilityScore: number;
  complianceScore: number;
  rightsConfidenceScore: number;
  originalityScore: number;
  overallQualityScore: number;
}

export interface CreativeQualityPenalties {
  lowResolutionPenalty: number;
  aspectRatioPenalty: number;
  cropPenalty: number;
  durationPenalty: number;
  frameRatePenalty: number;
  textMismatchPenalty: number;
  OCRMismatchPenalty: number;
  protectedTermPenalty: number;
  disclosurePenalty: number;
  brandMismatchPenalty: number;
  logoMismatchPenalty: number;
  unsafeContentPenalty: number;
  rightsUncertaintyPenalty: number;
  likenessRiskPenalty: number;
  duplicateAssetPenalty: number;
  providerWatermarkPenalty: number;
  compressionArtifactPenalty: number;
  subtitleReadabilityPenalty: number;
  RTLFailurePenalty: number;
  promptInjectionPenalty: number;
}
