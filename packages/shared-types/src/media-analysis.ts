import type { LanguageCode, LocaleCode, TextDirection, WritingSystem } from "./language-registry.js";

export const MEDIA_KINDS = ["image", "pdf"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export const MEDIA_ASSET_STATUSES = [
  "pending_upload",
  "uploaded",
  "validating",
  "rejected",
  "normalized",
  "ready",
  "quarantined",
  "deleted",
  "failed",
] as const;
export type MediaAssetStatus = (typeof MEDIA_ASSET_STATUSES)[number];

export const UPLOAD_SESSION_STATUSES = [
  "created",
  "uploading",
  "uploaded",
  "validating",
  "completed",
  "expired",
  "rejected",
  "failed",
] as const;
export type UploadSessionStatus = (typeof UPLOAD_SESSION_STATUSES)[number];

export const DUPLICATE_STATUSES = [
  "none",
  "exact",
  "possible",
  "reviewed_distinct",
  "reviewed_duplicate",
] as const;
export type DuplicateStatus = (typeof DUPLICATE_STATUSES)[number];

export const ANALYSIS_PURPOSES = [
  "business_context",
  "social_post_context",
  "group_context",
  "document_context",
  "general_media_context",
] as const;
export type AnalysisPurpose = (typeof ANALYSIS_PURPOSES)[number];

export const ANALYSIS_JOB_STATUSES = [
  "created",
  "queued",
  "active",
  "preprocessing",
  "ocr",
  "vision",
  "merging",
  "scoring",
  "awaiting_review",
  "completed",
  "failed",
  "cancelled",
  "dead_letter",
  "reused",
] as const;
export type AnalysisJobStatus = (typeof ANALYSIS_JOB_STATUSES)[number];

export const ANALYSIS_STAGES = [
  "queued",
  "validate",
  "normalize",
  "ocr",
  "vision",
  "merge",
  "score",
  "persist",
  "complete",
] as const;
export type AnalysisStage = (typeof ANALYSIS_STAGES)[number];

export const PROMPT_VERSION_STATUSES = [
  "draft",
  "testing",
  "active",
  "deprecated",
  "archived",
] as const;
export type PromptVersionStatus = (typeof PROMPT_VERSION_STATUSES)[number];

export const REVIEW_DECISION_STATUSES = [
  "pending",
  "approved",
  "corrected",
  "rejected",
  "needs_reanalysis",
] as const;
export type ReviewDecisionStatus = (typeof REVIEW_DECISION_STATUSES)[number];

export const REVIEW_REASON_CODES = [
  "low_overall_confidence",
  "ocr_unavailable",
  "ocr_language_pack_missing",
  "mixed_language_ambiguous",
  "regulated_domain",
  "medical_context",
  "legal_context",
  "financial_context",
  "business_type_ambiguous",
  "audience_ambiguous",
  "provider_conflict",
  "provider_partial",
  "tier3_language",
  "untested_locale",
  "manual_review_requested",
  "vision_unavailable",
  "duplicate_uncertainty",
  "country_inferred_weak",
] as const;
export type ReviewReasonCode = (typeof REVIEW_REASON_CODES)[number];

export const AI_PROCESSING_ERROR_CODES = [
  "MEDIA_TYPE_UNSUPPORTED",
  "MEDIA_SIGNATURE_MISMATCH",
  "MEDIA_SIZE_EXCEEDED",
  "MEDIA_DIMENSIONS_EXCEEDED",
  "MEDIA_PIXEL_LIMIT_EXCEEDED",
  "MEDIA_DECODE_FAILED",
  "MEDIA_PDF_ENCRYPTED",
  "MEDIA_PDF_PAGE_LIMIT_EXCEEDED",
  "MEDIA_NORMALIZATION_FAILED",
  "MEDIA_STORAGE_FAILED",
  "MEDIA_DUPLICATE_CONFLICT",
  "ANALYSIS_MEDIA_NOT_READY",
  "ANALYSIS_PURPOSE_UNSUPPORTED",
  "ANALYSIS_JOB_ALREADY_EXISTS",
  "ANALYSIS_JOB_NOT_RETRYABLE",
  "ANALYSIS_JOB_CANCELLED",
  "OCR_ENGINE_UNAVAILABLE",
  "OCR_LANGUAGE_PACK_MISSING",
  "OCR_TIMEOUT",
  "OCR_FAILED",
  "LANGUAGE_DETECTION_AMBIGUOUS",
  "VISION_PROVIDER_DISABLED",
  "VISION_PROVIDER_UNAVAILABLE",
  "VISION_PROVIDER_TIMEOUT",
  "VISION_PROVIDER_RATE_LIMITED",
  "VISION_PROVIDER_INVALID_RESPONSE",
  "VISION_SCHEMA_VALIDATION_FAILED",
  "PROMPT_VERSION_NOT_FOUND",
  "PROMPT_VERSION_INACTIVE",
  "CONFIDENCE_REVIEW_REQUIRED",
  "INTERNAL_MEDIA_FETCH_REJECTED",
  "INTERNAL_SIGNATURE_INVALID",
  "INTERNAL_REPLAY_REJECTED",
] as const;
export type AIProcessingErrorCode = (typeof AI_PROCESSING_ERROR_CODES)[number];

export const BUSINESS_SIGNAL_LABELS = [
  "dental_clinic",
  "general_healthcare",
  "pharmacy",
  "education",
  "restaurant",
  "hotel",
  "real_estate",
  "construction",
  "logistics",
  "agriculture",
  "retail",
  "e_commerce",
  "legal_services",
  "accounting",
  "automotive",
  "salon",
  "gym",
  "travel",
  "software",
  "professional_services",
  "unknown",
] as const;
export type BusinessSignalLabel = (typeof BUSINESS_SIGNAL_LABELS)[number];

export const AUDIENCE_SIGNAL_LABELS = [
  "business_owner",
  "clinic_owner",
  "dentist",
  "doctor",
  "pharmacist",
  "school_manager",
  "restaurant_owner",
  "hotel_manager",
  "real_estate_professional",
  "consumer",
  "patient",
  "student",
  "parent",
  "employee",
  "general_public",
  "mixed",
  "unknown",
] as const;
export type AudienceSignalLabel = (typeof AUDIENCE_SIGNAL_LABELS)[number];

export const AI_MEDIA_QUEUE_NAMES = {
  VALIDATE: "miraaj.ai.media.validate",
  ANALYZE: "miraaj.ai.media.analyze",
  DEAD_LETTER: "miraaj.ai.media.dead-letter",
} as const;

export const AI_MEDIA_JOB_NAMES = {
  VALIDATE_MEDIA: "validate-media",
  NORMALIZE_MEDIA: "normalize-media",
  ANALYZE_MEDIA: "analyze-media",
  REANALYZE_MEDIA: "reanalyze-media",
} as const;

export interface MediaCapabilityDefinition {
  mimeType: string;
  extensions: readonly string[];
  binarySignatures: readonly string[];
  maxBytes: number;
  maxWidth?: number;
  maxHeight?: number;
  maxPixels?: number;
  maxPdfPages?: number;
  decoder: "pillow" | "pypdf" | "pymupdf";
  sanitizer: "image_strip" | "pdf_safe";
  ocrEligible: boolean;
  visionEligible: boolean;
  perceptualHashEligible: boolean;
  derivativeOutputFormat: "webp" | "png" | "none";
  enabled: boolean;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  unit: "px" | "normalized";
}

export interface VerifiedMediaMetadata {
  verifiedMime: string;
  kind: MediaKind;
  originalBytes: number;
  width?: number;
  height?: number;
  pageCount?: number;
  orientation?: number;
  colorSpace?: string;
  sha256: string;
}

export interface MediaValidationResult {
  accepted: boolean;
  metadata?: VerifiedMediaMetadata;
  warnings: readonly string[];
  errorCode?: AIProcessingErrorCode;
  safeMessage?: string;
}

export interface SanitizationResult {
  actions: readonly string[];
  warnings: readonly string[];
  metadataRemoved: boolean;
  normalizedBytes?: number;
  normalizedSha256?: string;
  normalizedWidth?: number;
  normalizedHeight?: number;
  normalizedMime?: string;
}

export interface DuplicateDetectionResult {
  duplicateStatus: DuplicateStatus;
  exactDuplicateOfMediaId?: string;
  possibleDuplicateMediaIds: readonly string[];
  perceptualHash?: string;
  perceptualHashAlgorithm?: string;
}

export interface ConfidenceBreakdown {
  mediaValidationConfidence: number;
  ocrConfidence: number;
  scriptConfidence: number;
  languageConfidence: number;
  visionSchemaConfidence: number;
  businessSignalConfidence: number;
  audienceSignalConfidence: number;
  contentPurposeConfidence: number;
  overallConfidence: number;
}

export type ConfidenceScorePayload = ConfidenceBreakdown;

export interface AnalysisJobProgress {
  stage: AnalysisStage;
  percent: number;
  message?: string;
  updatedAt: string;
}

export interface OCRWarning {
  code: string;
  message: string;
}

export interface OCRWord {
  text: string;
  confidence: number;
  boundingBox?: BoundingBox;
}

export interface OCRLine {
  text: string;
  confidence: number;
  boundingBox?: BoundingBox;
  words: readonly OCRWord[];
}

export interface OCRBlock {
  text: string;
  confidence: number;
  boundingBox?: BoundingBox;
  lines: readonly OCRLine[];
  words: readonly OCRWord[];
}

export interface OCRPage {
  page: number;
  width: number;
  height: number;
  rotation: number;
  blocks: readonly OCRBlock[];
  rawText: string;
  normalizedText: string;
  averageConfidence: number;
}

export interface OCRResult {
  provider: string;
  providerVersion: string;
  languagesRequested: readonly string[];
  languagesAvailable: readonly string[];
  languagesUnavailable: readonly string[];
  pages: readonly OCRPage[];
  rawText: string;
  normalizedText: string;
  detectedScripts: readonly WritingSystem[];
  languageDetection: LanguageDetectionSummary;
  averageConfidence: number;
  warnings: readonly OCRWarning[];
  requiresReview: boolean;
  processingMs: number;
}

export interface LanguageDetectionSummary {
  primaryLanguage?: LanguageCode;
  primaryLocale?: LocaleCode;
  detectedLanguages: readonly {
    language: LanguageCode;
    confidence: number;
    proportion?: number;
  }[];
  scripts: readonly WritingSystem[];
  direction: TextDirection | "mixed" | "unknown";
  isMixedLanguage: boolean;
  ambiguous: boolean;
  requiresReview: boolean;
  evidence: readonly string[];
}

export interface ScriptDetectionResult {
  scripts: readonly WritingSystem[];
  primaryScript?: WritingSystem;
  direction: TextDirection | "mixed" | "unknown";
  isMixed: boolean;
  confidence: number;
}

export interface EvidenceSignal<TLabel extends string = string> {
  label: TLabel;
  confidence: number;
  evidence: readonly string[];
  contradictingEvidence?: readonly string[];
  source: "ocr" | "vision_provider" | "user_hint" | "source_metadata" | "merged" | "human_review";
  inferred: boolean;
  requiresReview?: boolean;
}

export interface VisionAnalysisOutput {
  schemaVersion: string;
  provider: string;
  model: string;
  mediaSummary: string;
  contentType: string;
  contentPurpose: string;
  visibleTextSummary: string;
  inferredLanguages: readonly LanguageCode[];
  detectedScripts: readonly WritingSystem[];
  businessSignals: readonly EvidenceSignal<BusinessSignalLabel>[];
  audienceSignals: readonly EvidenceSignal<AudienceSignalLabel>[];
  contentSignals: readonly EvidenceSignal[];
  businessAudienceType?: string;
  professionalContext?: boolean;
  publicConsumerContext?: boolean;
  detectedContactSignals: readonly string[];
  detectedPriceSignals: readonly string[];
  detectedOfferSignals: readonly string[];
  detectedCallToActionSignals: readonly string[];
  locationSignals: readonly string[];
  platformSignals: readonly string[];
  regulatedDomainSignals: readonly string[];
  safetyWarnings: readonly string[];
  evidence: readonly string[];
  uncertainties: readonly string[];
  providerConfidenceSignals: readonly number[];
  requiresReview: boolean;
}

export interface AnalysisProviderMetadata {
  provider: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  imagesProcessed?: number;
  pagesProcessed?: number;
  processingMs?: number;
  retryCount?: number;
  estimatedCost?: number;
  currency?: string;
  costEstimationVersion?: string;
  costBasis: "actual" | "estimated" | "unavailable";
}

export const MEDIA_CAPABILITY_REGISTRY: readonly MediaCapabilityDefinition[] = [
  {
    mimeType: "image/jpeg",
    extensions: [".jpg", ".jpeg"],
    binarySignatures: ["ffd8ff"],
    maxBytes: 15_728_640,
    maxWidth: 12_000,
    maxHeight: 12_000,
    maxPixels: 50_000_000,
    decoder: "pillow",
    sanitizer: "image_strip",
    ocrEligible: true,
    visionEligible: true,
    perceptualHashEligible: true,
    derivativeOutputFormat: "webp",
    enabled: true,
  },
  {
    mimeType: "image/png",
    extensions: [".png"],
    binarySignatures: ["89504e470d0a1a0a"],
    maxBytes: 15_728_640,
    maxWidth: 12_000,
    maxHeight: 12_000,
    maxPixels: 50_000_000,
    decoder: "pillow",
    sanitizer: "image_strip",
    ocrEligible: true,
    visionEligible: true,
    perceptualHashEligible: true,
    derivativeOutputFormat: "webp",
    enabled: true,
  },
  {
    mimeType: "image/webp",
    extensions: [".webp"],
    binarySignatures: ["52494646"],
    maxBytes: 15_728_640,
    maxWidth: 12_000,
    maxHeight: 12_000,
    maxPixels: 50_000_000,
    decoder: "pillow",
    sanitizer: "image_strip",
    ocrEligible: true,
    visionEligible: true,
    perceptualHashEligible: true,
    derivativeOutputFormat: "webp",
    enabled: true,
  },
  {
    mimeType: "application/pdf",
    extensions: [".pdf"],
    binarySignatures: ["25504446"],
    maxBytes: 26_214_400,
    maxPdfPages: 25,
    decoder: "pymupdf",
    sanitizer: "pdf_safe",
    ocrEligible: true,
    visionEligible: true,
    perceptualHashEligible: false,
    derivativeOutputFormat: "none",
    enabled: true,
  },
] as const;
