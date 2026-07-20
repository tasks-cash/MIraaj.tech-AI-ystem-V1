import type {
  LanguageCode,
  LocaleCode,
  TextDirection,
  WritingSystem,
  DetectedLanguageScore,
  LanguageDetectionResult,
  TranslationInput,
  TranslationOutput,
  TranslationProviderHealth,
} from "./language-registry.js";

export interface LanguageDetectionInput {
  userSelectedLanguage?: LanguageCode;
  userSelectedLocale?: LocaleCode;
  sourceMetadataLanguage?: LanguageCode;
  ocrText?: string;
  caption?: string;
  postBody?: string;
  groupName?: string;
  groupDescription?: string;
  imageText?: string;
  documentText?: string;
  countryCode?: string;
  campaignLanguage?: LanguageCode;
  campaignLocale?: LocaleCode;
}

export type LanguageDetectionOutput = LanguageDetectionResult;

/**
 * Provider-neutral translation contract.
 * Do not couple translation directly to Gemini.
 */
export interface TranslationProvider {
  readonly providerId: string;
  translate(input: TranslationInput): Promise<TranslationOutput>;
  detectLanguage?(
    input: LanguageDetectionInput,
  ): Promise<LanguageDetectionOutput>;
  healthCheck(): Promise<TranslationProviderHealth>;
}

export const TRANSLATION_GLOSSARY_STATUSES = [
  "draft",
  "approved",
  "deprecated",
] as const;
export type TranslationGlossaryStatus =
  (typeof TRANSLATION_GLOSSARY_STATUSES)[number];

export interface TranslationGlossary {
  key: string;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  locale: LocaleCode;
  sectorId?: string;
  businessTypeId?: string;
  sourceTerm: string;
  approvedTranslation: string;
  prohibitedTranslations: readonly string[];
  preserveOriginal: boolean;
  caseSensitive: boolean;
  status: TranslationGlossaryStatus;
  createdBy?: string;
  approvedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export const TRANSLATION_STRATEGIES = [
  "direct_translation",
  "transcreation",
  "human_translation",
  "glossary_assisted",
] as const;
export type TranslationStrategy = (typeof TRANSLATION_STRATEGIES)[number];

export const CAMPAIGN_LANGUAGE_VARIANT_STATUSES = [
  "draft",
  "pending_review",
  "approved",
  "rejected",
  "published",
  "archived",
] as const;
export type CampaignLanguageVariantStatus =
  (typeof CAMPAIGN_LANGUAGE_VARIANT_STATUSES)[number];

/** Persisted shape for future campaign generation — not operational yet. */
export interface CampaignLanguageVariant {
  campaignId: string;
  sourceVariantId?: string;
  language: LanguageCode;
  locale: LocaleCode;
  countryCode: string;
  translationStrategy: TranslationStrategy;
  headline: string;
  primaryText: string;
  shortText: string;
  cta: string;
  hashtags: readonly string[];
  keywords: readonly string[];
  visualText?: string;
  disclaimer?: string;
  provider: string;
  model: string;
  glossaryVersion?: string;
  status: CampaignLanguageVariantStatus;
  requiresReview: boolean;
  approvedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export const PROTECTED_BRAND_TERMS = [
  "Miraaj.tech",
  "Tasks.cash",
] as const;

export const GLOSSARY_SECTOR_IDS = [
  "dentistry",
  "healthcare",
  "legal",
  "finance",
  "ecommerce",
  "education",
  "cybersecurity",
  "construction",
  "real_estate",
  "hospitality",
  "agriculture",
  "logistics",
] as const;

export interface SpeechToTextProvider {
  readonly providerId: string;
}

export interface TextToSpeechProvider {
  readonly providerId: string;
}

export interface SpeechJobMetadata {
  language: LanguageCode;
  locale: LocaleCode;
  voiceId?: string;
  genderPresentation?: string;
  speakingStyle?: string;
  speed?: number;
  subtitleTimestamps?: readonly {
    startMs: number;
    endMs: number;
    text: string;
  }[];
  confidence?: number | null;
  provider: string;
  model: string;
  cost?: number | null;
  humanReviewStatus?: "not_required" | "pending" | "approved" | "rejected";
}

export interface BidirectionalIsolationHints {
  primaryDirection: TextDirection | "auto";
  isolateFragments: readonly (
    | "url"
    | "email"
    | "phone"
    | "iban"
    | "product_code"
    | "tracking_code"
    | "hashtag"
    | "username"
    | "price"
  )[];
}

export interface MultilingualSearchFields {
  originalText: string;
  normalizedSearchText: string;
  translatedSearchAliases: readonly string[];
  transliterationAliases: readonly string[];
  languageCode: LanguageCode;
  localeCode: LocaleCode;
  script?: WritingSystem | "Unknown";
}

export interface UnsupportedLanguageState {
  code: "UNSUPPORTED_LANGUAGE";
  requestedLanguage: LanguageCode;
  requestedLocale?: LocaleCode;
  fallbackLanguage?: LanguageCode;
  fallbackLocale?: LocaleCode;
  message: string;
  allowHumanTranslation: boolean;
  preserveOriginal: true;
}

export type DetectedLanguageList = readonly DetectedLanguageScore[];

export const OCR_BUNDLE_ENV_KEYS = [
  "OCR_LANGUAGES_DEFAULT",
  "OCR_LANGUAGES_INSTALLED",
  "OCR_MAX_LANGUAGES_PER_JOB",
] as const;

export interface OcrLanguageBundleConfig {
  defaultLanguages: string;
  installedLanguages: readonly string[];
  maxLanguagesPerJob: number;
}

export const DEFAULT_OCR_BUNDLE_CONFIG: OcrLanguageBundleConfig = {
  defaultLanguages: "ara+eng+fra",
  installedLanguages: [
    "ara",
    "eng",
    "fra",
    "spa",
    "deu",
    "por",
    "ita",
    "nld",
    "tur",
    "rus",
  ],
  maxLanguagesPerJob: 4,
};
