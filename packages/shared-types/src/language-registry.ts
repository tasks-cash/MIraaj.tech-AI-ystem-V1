/**
 * Central Miraaj.tech AI language registry.
 * All AI applications must import language definitions from this module.
 * Do not scatter language arrays across services.
 */

export type LanguageCode = string & { readonly __brand: "LanguageCode" };
export type LocaleCode = string & { readonly __brand: "LocaleCode" };
export type ScriptName = string & { readonly __brand: "ScriptName" };

export const LANGUAGE_SUPPORT_TIERS = [1, 2, 3] as const;
export type LanguageSupportTier = (typeof LANGUAGE_SUPPORT_TIERS)[number];

export const TEXT_DIRECTIONS = ["ltr", "rtl"] as const;
export type TextDirection = (typeof TEXT_DIRECTIONS)[number];

export const WRITING_SYSTEMS = [
  "Latin",
  "Arabic",
  "Cyrillic",
  "Greek",
  "Hebrew",
  "Devanagari",
  "Bengali",
  "Chinese",
  "Japanese",
  "Korean",
  "Thai",
] as const;
export type WritingSystem = (typeof WRITING_SYSTEMS)[number];

export const TRANSLATION_STATUSES = [
  "not_requested",
  "pending",
  "completed",
  "failed",
  "requires_review",
  "approved",
  "rejected",
] as const;
export type TranslationStatus = (typeof TRANSLATION_STATUSES)[number];

export interface LanguageCapabilityFlags {
  detectionSupported: boolean;
  understandingSupported: boolean;
  generationSupported: boolean;
  translationSupported: boolean;
  ocrSupported: boolean;
  speechToTextSupported: boolean;
  textToSpeechSupported: boolean;
}

export interface LanguageDefinition extends LanguageCapabilityFlags {
  languageCode: LanguageCode;
  localeCode: LocaleCode;
  englishName: string;
  nativeName: string;
  script: WritingSystem;
  direction: TextDirection;
  supportTier: LanguageSupportTier;
  enabled: boolean;
  defaultCountryCodes: readonly string[];
  fallbackLocale: LocaleCode;
  fallbackLanguage: LanguageCode;
  numberFormatLocale: LocaleCode;
  dateFormatLocale: LocaleCode;
  currencyFormatLocale: LocaleCode;
  preferredProviders: readonly string[];
  requiredReview: boolean;
  minimumConfidence: number;
  tested: boolean;
  testedAt: string | null;
  notes: string;
  ocrPack?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DetectedLanguageScore {
  language: LanguageCode;
  confidence: number;
  percentage: number;
}

export interface LanguageDetectionResult {
  primaryLanguage: LanguageCode;
  primaryLocale: LocaleCode;
  languages: readonly DetectedLanguageScore[];
  script: WritingSystem | "Unknown";
  direction: TextDirection | "auto";
  isMixedLanguage: boolean;
  requiresReview: boolean;
}

export interface TranslationProviderHealth {
  providerId: string;
  status: "ok" | "degraded" | "unavailable";
  latencyMs?: number;
  safeError?: string | null;
}

export interface TranslationInput {
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  targetLocale: LocaleCode;
  countryCode?: string;
  text: string;
  businessSector?: string;
  service?: string;
  platform?: string;
  brandTerminology?: readonly string[];
  protectedTerms?: readonly string[];
  requiredTone?: string;
  maximumLength?: number;
  formality?: "formal" | "informal" | "neutral";
  glossaryKeys?: readonly string[];
  complianceRules?: readonly string[];
}

export interface TranslationOutput {
  translatedText: string;
  detectedSourceLanguage: LanguageCode;
  provider: string;
  model: string;
  confidence: number | null;
  warnings: readonly string[];
  protectedTermReport: readonly string[];
  humanReviewRecommended: boolean;
  processingTimeMs: number;
  estimatedCost: number | null;
}

export interface MultilingualContentFields {
  languageCode: LanguageCode;
  localeCode: LocaleCode;
  countryCode?: string;
  script?: WritingSystem | "Unknown";
  direction?: TextDirection | "auto";
  sourceLanguage?: LanguageCode;
  targetLanguage?: LanguageCode;
  detectedLanguages?: readonly DetectedLanguageScore[];
  translationStatus?: TranslationStatus;
  translationProvider?: string;
  translationModel?: string;
  translationQuality?: number | null;
  requiresLanguageReview?: boolean;
}

function languageCode(value: string): LanguageCode {
  return value as LanguageCode;
}

function localeCode(value: string): LocaleCode {
  return value as LocaleCode;
}

function defineLanguage(
  input: Omit<
    LanguageDefinition,
    | "languageCode"
    | "localeCode"
    | "fallbackLocale"
    | "fallbackLanguage"
    | "numberFormatLocale"
    | "dateFormatLocale"
    | "currencyFormatLocale"
    | "createdAt"
    | "updatedAt"
  > & {
    languageCode: string;
    localeCode: string;
    fallbackLocale?: string;
    fallbackLanguage?: string;
    numberFormatLocale?: string;
    dateFormatLocale?: string;
    currencyFormatLocale?: string;
    createdAt?: string;
    updatedAt?: string;
  },
): LanguageDefinition {
  const code = languageCode(input.languageCode);
  const locale = localeCode(input.localeCode);
  const stamp = "2026-07-19T00:00:00.000Z";
  return {
    ...input,
    languageCode: code,
    localeCode: locale,
    fallbackLocale: localeCode(input.fallbackLocale ?? input.localeCode),
    fallbackLanguage: languageCode(input.fallbackLanguage ?? input.languageCode),
    numberFormatLocale: localeCode(input.numberFormatLocale ?? input.localeCode),
    dateFormatLocale: localeCode(input.dateFormatLocale ?? input.localeCode),
    currencyFormatLocale: localeCode(
      input.currencyFormatLocale ?? input.localeCode,
    ),
    createdAt: input.createdAt ?? stamp,
    updatedAt: input.updatedAt ?? stamp,
  };
}

const tier1Capabilities = {
  detectionSupported: true,
  understandingSupported: true,
  generationSupported: true,
  translationSupported: true,
  ocrSupported: true,
  speechToTextSupported: false,
  textToSpeechSupported: false,
} as const;

const tier2Capabilities = {
  detectionSupported: true,
  understandingSupported: true,
  generationSupported: true,
  translationSupported: true,
  ocrSupported: false,
  speechToTextSupported: false,
  textToSpeechSupported: false,
} as const;

function defineTier2Language(input: {
  languageCode: string;
  localeCode: string;
  englishName: string;
  nativeName: string;
  script: WritingSystem;
  direction?: TextDirection;
  defaultCountryCodes: readonly string[];
  ocrPack?: string;
  notes?: string;
}): LanguageDefinition {
  return defineLanguage({
    ...input,
    direction: input.direction ?? "ltr",
    supportTier: 2,
    enabled: true,
    preferredProviders: [],
    requiredReview: true,
    minimumConfidence: 0.75,
    tested: false,
    testedAt: null,
    notes: input.notes ?? "Tier 2. Provider-capable; OCR optional.",
    ...tier2Capabilities,
    ocrSupported: Boolean(input.ocrPack),
  });
}

/** Fully verified initial languages — not the exclusive system language set. */
export const TIER1_LANGUAGE_CODES = [
  "ar",
  "en",
  "fr",
  "es",
  "de",
  "pt",
  "it",
  "nl",
  "tr",
  "ru",
] as const;

export const TIER2_LANGUAGE_CODES = [
  "zh",
  "ja",
  "ko",
  "hi",
  "ur",
  "fa",
  "bn",
  "pa",
  "id",
  "ms",
  "vi",
  "th",
  "fil",
  "pl",
  "uk",
  "ro",
  "bg",
  "el",
  "cs",
  "sk",
  "hu",
  "sr",
  "hr",
  "bs",
  "sl",
  "sv",
  "no",
  "da",
  "fi",
  "he",
  "sw",
] as const;

export const DEFAULT_OCR_LANGUAGE_PACKS = [
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
] as const;

export const OPTIONAL_OCR_LANGUAGE_PACKS = [
  "chi_sim",
  "chi_tra",
  "jpn",
  "kor",
  "hin",
  "urd",
  "fas",
  "ben",
  "ind",
  "msa",
  "vie",
  "tha",
  "pol",
  "ukr",
  "ron",
  "bul",
  "ell",
  "ces",
  "slk",
  "hun",
  "srp",
  "hrv",
  "bos",
  "slv",
  "swe",
  "nor",
  "dan",
  "fin",
  "heb",
  "swa",
] as const;

export const FUTURE_AI_LANGUAGE_PERMISSIONS = [
  "ai.languages.read",
  "ai.languages.manage",
  "ai.translation.read",
  "ai.translation.generate",
  "ai.translation.review",
  "ai.translation.approve",
  "ai.glossary.read",
  "ai.glossary.manage",
  "ai.glossary.publish",
] as const;

export const LANGUAGE_REGISTRY: readonly LanguageDefinition[] = [
  defineLanguage({
    languageCode: "ar",
    localeCode: "ar",
    englishName: "Arabic",
    nativeName: "العربية",
    script: "Arabic",
    direction: "rtl",
    supportTier: 1,
    enabled: true,
    defaultCountryCodes: ["DZ", "SA", "AE", "EG", "MA", "TN"],
    preferredProviders: [],
    requiredReview: false,
    minimumConfidence: 0.7,
    tested: true,
    testedAt: null,
    notes: "Tier 1 verified. Prefer locale variants such as ar-DZ or ar-SA.",
    ocrPack: "ara",
    ...tier1Capabilities,
  }),
  defineLanguage({
    languageCode: "en",
    localeCode: "en",
    englishName: "English",
    nativeName: "English",
    script: "Latin",
    direction: "ltr",
    supportTier: 1,
    enabled: true,
    defaultCountryCodes: ["US", "GB", "AU", "CA"],
    preferredProviders: [],
    requiredReview: false,
    minimumConfidence: 0.7,
    tested: true,
    testedAt: null,
    notes: "Tier 1 verified. Prefer en-US or en-GB for market adaptation.",
    ocrPack: "eng",
    ...tier1Capabilities,
  }),
  defineLanguage({
    languageCode: "fr",
    localeCode: "fr",
    englishName: "French",
    nativeName: "Français",
    script: "Latin",
    direction: "ltr",
    supportTier: 1,
    enabled: true,
    defaultCountryCodes: ["FR", "DZ", "BE", "CA", "CH"],
    preferredProviders: [],
    requiredReview: false,
    minimumConfidence: 0.7,
    tested: true,
    testedAt: null,
    notes: "Tier 1 verified. French in Algeria is not identical to French in France.",
    ocrPack: "fra",
    ...tier1Capabilities,
  }),
  defineLanguage({
    languageCode: "es",
    localeCode: "es-ES",
    englishName: "Spanish",
    nativeName: "Español",
    script: "Latin",
    direction: "ltr",
    supportTier: 1,
    enabled: true,
    defaultCountryCodes: ["ES", "MX", "AR", "CO"],
    preferredProviders: [],
    requiredReview: false,
    minimumConfidence: 0.7,
    tested: true,
    testedAt: null,
    notes: "Tier 1 verified. Keep Spain and Latin American locales separate.",
    ocrPack: "spa",
    ...tier1Capabilities,
  }),
  defineLanguage({
    languageCode: "de",
    localeCode: "de-DE",
    englishName: "German",
    nativeName: "Deutsch",
    script: "Latin",
    direction: "ltr",
    supportTier: 1,
    enabled: true,
    defaultCountryCodes: ["DE", "AT", "CH"],
    preferredProviders: [],
    requiredReview: false,
    minimumConfidence: 0.7,
    tested: true,
    testedAt: null,
    notes: "Tier 1 verified.",
    ocrPack: "deu",
    ...tier1Capabilities,
  }),
  defineLanguage({
    languageCode: "pt",
    localeCode: "pt-BR",
    englishName: "Portuguese",
    nativeName: "Português",
    script: "Latin",
    direction: "ltr",
    supportTier: 1,
    enabled: true,
    defaultCountryCodes: ["BR", "PT"],
    preferredProviders: [],
    requiredReview: false,
    minimumConfidence: 0.7,
    tested: true,
    testedAt: null,
    notes: "Tier 1 verified. Prefer pt-BR or pt-PT explicitly.",
    ocrPack: "por",
    ...tier1Capabilities,
  }),
  defineLanguage({
    languageCode: "it",
    localeCode: "it-IT",
    englishName: "Italian",
    nativeName: "Italiano",
    script: "Latin",
    direction: "ltr",
    supportTier: 1,
    enabled: true,
    defaultCountryCodes: ["IT", "CH"],
    preferredProviders: [],
    requiredReview: false,
    minimumConfidence: 0.7,
    tested: true,
    testedAt: null,
    notes: "Tier 1 verified.",
    ocrPack: "ita",
    ...tier1Capabilities,
  }),
  defineLanguage({
    languageCode: "nl",
    localeCode: "nl-NL",
    englishName: "Dutch",
    nativeName: "Nederlands",
    script: "Latin",
    direction: "ltr",
    supportTier: 1,
    enabled: true,
    defaultCountryCodes: ["NL", "BE"],
    preferredProviders: [],
    requiredReview: false,
    minimumConfidence: 0.7,
    tested: true,
    testedAt: null,
    notes: "Tier 1 verified.",
    ocrPack: "nld",
    ...tier1Capabilities,
  }),
  defineLanguage({
    languageCode: "tr",
    localeCode: "tr-TR",
    englishName: "Turkish",
    nativeName: "Türkçe",
    script: "Latin",
    direction: "ltr",
    supportTier: 1,
    enabled: true,
    defaultCountryCodes: ["TR"],
    preferredProviders: [],
    requiredReview: false,
    minimumConfidence: 0.7,
    tested: true,
    testedAt: null,
    notes: "Tier 1 verified.",
    ocrPack: "tur",
    ...tier1Capabilities,
  }),
  defineLanguage({
    languageCode: "ru",
    localeCode: "ru-RU",
    englishName: "Russian",
    nativeName: "Русский",
    script: "Cyrillic",
    direction: "ltr",
    supportTier: 1,
    enabled: true,
    defaultCountryCodes: ["RU", "KZ", "BY"],
    preferredProviders: [],
    requiredReview: false,
    minimumConfidence: 0.7,
    tested: true,
    testedAt: null,
    notes: "Tier 1 verified.",
    ocrPack: "rus",
    ...tier1Capabilities,
  }),
  defineLanguage({
    languageCode: "zh",
    localeCode: "zh-CN",
    englishName: "Chinese Simplified",
    nativeName: "简体中文",
    script: "Chinese",
    direction: "ltr",
    supportTier: 2,
    enabled: true,
    defaultCountryCodes: ["CN", "SG"],
    preferredProviders: [],
    requiredReview: true,
    minimumConfidence: 0.75,
    tested: false,
    testedAt: null,
    notes: "Tier 2. Keep Simplified and Traditional configurations separate.",
    ocrPack: "chi_sim",
    ...tier2Capabilities,
    ocrSupported: true,
  }),
  defineLanguage({
    languageCode: "zh",
    localeCode: "zh-TW",
    englishName: "Chinese Traditional",
    nativeName: "繁體中文",
    script: "Chinese",
    direction: "ltr",
    supportTier: 2,
    enabled: true,
    defaultCountryCodes: ["TW", "HK"],
    preferredProviders: [],
    requiredReview: true,
    minimumConfidence: 0.75,
    tested: false,
    testedAt: null,
    notes: "Tier 2. Distinct from zh-CN.",
    ocrPack: "chi_tra",
    ...tier2Capabilities,
    ocrSupported: true,
  }),
  defineLanguage({
    languageCode: "ja",
    localeCode: "ja-JP",
    englishName: "Japanese",
    nativeName: "日本語",
    script: "Japanese",
    direction: "ltr",
    supportTier: 2,
    enabled: true,
    defaultCountryCodes: ["JP"],
    preferredProviders: [],
    requiredReview: true,
    minimumConfidence: 0.75,
    tested: false,
    testedAt: null,
    notes: "Tier 2. OCR requires optional jpn pack.",
    ocrPack: "jpn",
    ...tier2Capabilities,
  }),
  defineLanguage({
    languageCode: "ko",
    localeCode: "ko-KR",
    englishName: "Korean",
    nativeName: "한국어",
    script: "Korean",
    direction: "ltr",
    supportTier: 2,
    enabled: true,
    defaultCountryCodes: ["KR"],
    preferredProviders: [],
    requiredReview: true,
    minimumConfidence: 0.75,
    tested: false,
    testedAt: null,
    notes: "Tier 2. OCR requires optional kor pack.",
    ocrPack: "kor",
    ...tier2Capabilities,
  }),
  defineLanguage({
    languageCode: "hi",
    localeCode: "hi-IN",
    englishName: "Hindi",
    nativeName: "हिन्दी",
    script: "Devanagari",
    direction: "ltr",
    supportTier: 2,
    enabled: true,
    defaultCountryCodes: ["IN"],
    preferredProviders: [],
    requiredReview: true,
    minimumConfidence: 0.75,
    tested: false,
    testedAt: null,
    notes: "Tier 2.",
    ocrPack: "hin",
    ...tier2Capabilities,
  }),
  defineLanguage({
    languageCode: "ur",
    localeCode: "ur-PK",
    englishName: "Urdu",
    nativeName: "اردو",
    script: "Arabic",
    direction: "rtl",
    supportTier: 2,
    enabled: true,
    defaultCountryCodes: ["PK"],
    preferredProviders: [],
    requiredReview: true,
    minimumConfidence: 0.75,
    tested: false,
    testedAt: null,
    notes: "Tier 2 RTL.",
    ocrPack: "urd",
    ...tier2Capabilities,
  }),
  defineLanguage({
    languageCode: "fa",
    localeCode: "fa-IR",
    englishName: "Persian",
    nativeName: "فارسی",
    script: "Arabic",
    direction: "rtl",
    supportTier: 2,
    enabled: true,
    defaultCountryCodes: ["IR", "AF"],
    preferredProviders: [],
    requiredReview: true,
    minimumConfidence: 0.75,
    tested: false,
    testedAt: null,
    notes: "Tier 2 RTL.",
    ocrPack: "fas",
    ...tier2Capabilities,
  }),
  defineLanguage({
    languageCode: "he",
    localeCode: "he-IL",
    englishName: "Hebrew",
    nativeName: "עברית",
    script: "Hebrew",
    direction: "rtl",
    supportTier: 2,
    enabled: true,
    defaultCountryCodes: ["IL"],
    preferredProviders: [],
    requiredReview: true,
    minimumConfidence: 0.75,
    tested: false,
    testedAt: null,
    notes: "Tier 2 RTL.",
    ocrPack: "heb",
    ...tier2Capabilities,
  }),
  defineLanguage({
    languageCode: "bn",
    localeCode: "bn-BD",
    englishName: "Bengali",
    nativeName: "বাংলা",
    script: "Bengali",
    direction: "ltr",
    supportTier: 2,
    enabled: true,
    defaultCountryCodes: ["BD", "IN"],
    preferredProviders: [],
    requiredReview: true,
    minimumConfidence: 0.75,
    tested: false,
    testedAt: null,
    notes: "Tier 2.",
    ocrPack: "ben",
    ...tier2Capabilities,
  }),
  defineLanguage({
    languageCode: "th",
    localeCode: "th-TH",
    englishName: "Thai",
    nativeName: "ไทย",
    script: "Thai",
    direction: "ltr",
    supportTier: 2,
    enabled: true,
    defaultCountryCodes: ["TH"],
    preferredProviders: [],
    requiredReview: true,
    minimumConfidence: 0.75,
    tested: false,
    testedAt: null,
    notes: "Tier 2.",
    ocrPack: "tha",
    ...tier2Capabilities,
  }),
  defineTier2Language({
    languageCode: "pa",
    localeCode: "pa-IN",
    englishName: "Punjabi",
    nativeName: "ਪੰਜਾਬੀ",
    script: "Devanagari",
    defaultCountryCodes: ["IN", "PK"],
    notes: "Tier 2. Script variants exist; verify OCR pack availability.",
  }),
  defineTier2Language({
    languageCode: "id",
    localeCode: "id-ID",
    englishName: "Indonesian",
    nativeName: "Bahasa Indonesia",
    script: "Latin",
    defaultCountryCodes: ["ID"],
    ocrPack: "ind",
  }),
  defineTier2Language({
    languageCode: "ms",
    localeCode: "ms-MY",
    englishName: "Malay",
    nativeName: "Bahasa Melayu",
    script: "Latin",
    defaultCountryCodes: ["MY", "BN", "SG"],
    ocrPack: "msa",
  }),
  defineTier2Language({
    languageCode: "vi",
    localeCode: "vi-VN",
    englishName: "Vietnamese",
    nativeName: "Tiếng Việt",
    script: "Latin",
    defaultCountryCodes: ["VN"],
    ocrPack: "vie",
  }),
  defineTier2Language({
    languageCode: "fil",
    localeCode: "fil-PH",
    englishName: "Filipino",
    nativeName: "Filipino",
    script: "Latin",
    defaultCountryCodes: ["PH"],
  }),
  defineTier2Language({
    languageCode: "pl",
    localeCode: "pl-PL",
    englishName: "Polish",
    nativeName: "Polski",
    script: "Latin",
    defaultCountryCodes: ["PL"],
    ocrPack: "pol",
  }),
  defineTier2Language({
    languageCode: "uk",
    localeCode: "uk-UA",
    englishName: "Ukrainian",
    nativeName: "Українська",
    script: "Cyrillic",
    defaultCountryCodes: ["UA"],
    ocrPack: "ukr",
  }),
  defineTier2Language({
    languageCode: "ro",
    localeCode: "ro-RO",
    englishName: "Romanian",
    nativeName: "Română",
    script: "Latin",
    defaultCountryCodes: ["RO", "MD"],
    ocrPack: "ron",
  }),
  defineTier2Language({
    languageCode: "bg",
    localeCode: "bg-BG",
    englishName: "Bulgarian",
    nativeName: "Български",
    script: "Cyrillic",
    defaultCountryCodes: ["BG"],
    ocrPack: "bul",
  }),
  defineTier2Language({
    languageCode: "el",
    localeCode: "el-GR",
    englishName: "Greek",
    nativeName: "Ελληνικά",
    script: "Greek",
    defaultCountryCodes: ["GR", "CY"],
    ocrPack: "ell",
  }),
  defineTier2Language({
    languageCode: "cs",
    localeCode: "cs-CZ",
    englishName: "Czech",
    nativeName: "Čeština",
    script: "Latin",
    defaultCountryCodes: ["CZ"],
    ocrPack: "ces",
  }),
  defineTier2Language({
    languageCode: "sk",
    localeCode: "sk-SK",
    englishName: "Slovak",
    nativeName: "Slovenčina",
    script: "Latin",
    defaultCountryCodes: ["SK"],
    ocrPack: "slk",
  }),
  defineTier2Language({
    languageCode: "hu",
    localeCode: "hu-HU",
    englishName: "Hungarian",
    nativeName: "Magyar",
    script: "Latin",
    defaultCountryCodes: ["HU"],
    ocrPack: "hun",
  }),
  defineTier2Language({
    languageCode: "sr",
    localeCode: "sr-RS",
    englishName: "Serbian",
    nativeName: "Српски",
    script: "Cyrillic",
    defaultCountryCodes: ["RS"],
    ocrPack: "srp",
  }),
  defineTier2Language({
    languageCode: "hr",
    localeCode: "hr-HR",
    englishName: "Croatian",
    nativeName: "Hrvatski",
    script: "Latin",
    defaultCountryCodes: ["HR"],
    ocrPack: "hrv",
  }),
  defineTier2Language({
    languageCode: "bs",
    localeCode: "bs-BA",
    englishName: "Bosnian",
    nativeName: "Bosanski",
    script: "Latin",
    defaultCountryCodes: ["BA"],
    ocrPack: "bos",
  }),
  defineTier2Language({
    languageCode: "sl",
    localeCode: "sl-SI",
    englishName: "Slovenian",
    nativeName: "Slovenščina",
    script: "Latin",
    defaultCountryCodes: ["SI"],
    ocrPack: "slv",
  }),
  defineTier2Language({
    languageCode: "sv",
    localeCode: "sv-SE",
    englishName: "Swedish",
    nativeName: "Svenska",
    script: "Latin",
    defaultCountryCodes: ["SE"],
    ocrPack: "swe",
  }),
  defineTier2Language({
    languageCode: "no",
    localeCode: "nb-NO",
    englishName: "Norwegian",
    nativeName: "Norsk",
    script: "Latin",
    defaultCountryCodes: ["NO"],
    ocrPack: "nor",
  }),
  defineTier2Language({
    languageCode: "da",
    localeCode: "da-DK",
    englishName: "Danish",
    nativeName: "Dansk",
    script: "Latin",
    defaultCountryCodes: ["DK"],
    ocrPack: "dan",
  }),
  defineTier2Language({
    languageCode: "fi",
    localeCode: "fi-FI",
    englishName: "Finnish",
    nativeName: "Suomi",
    script: "Latin",
    defaultCountryCodes: ["FI"],
    ocrPack: "fin",
  }),
  defineTier2Language({
    languageCode: "sw",
    localeCode: "sw-KE",
    englishName: "Swahili",
    nativeName: "Kiswahili",
    script: "Latin",
    defaultCountryCodes: ["KE", "TZ", "UG"],
    ocrPack: "swa",
  }),
];

const registryByLocale = new Map(
  LANGUAGE_REGISTRY.map((entry) => [entry.localeCode, entry] as const),
);

const registryByLanguage = new Map<LanguageCode, LanguageDefinition[]>();
for (const entry of LANGUAGE_REGISTRY) {
  const existing = registryByLanguage.get(entry.languageCode) ?? [];
  existing.push(entry);
  registryByLanguage.set(entry.languageCode, existing);
}

export function asLanguageCode(value: string): LanguageCode {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z]{2,3}(-[a-z0-9]{2,8})*$/i.test(normalized)) {
    throw new RangeError(`Invalid language code: ${value}`);
  }
  return languageCode(normalized.split("-")[0] ?? normalized);
}

export function asLocaleCode(value: string): LocaleCode {
  const normalized = value.trim().replaceAll("_", "-");
  if (!/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(normalized)) {
    throw new RangeError(`Invalid locale code: ${value}`);
  }
  const [language, ...rest] = normalized.split("-");
  const reconstructed = [
    (language ?? "").toLowerCase(),
    ...rest.map((part, index) =>
      index === 0 && part.length === 2 ? part.toUpperCase() : part,
    ),
  ].join("-");
  return localeCode(reconstructed);
}

export function getLanguageDefinition(
  localeOrLanguage: string,
): LanguageDefinition | undefined {
  const asLocale = asLocaleCode(localeOrLanguage);
  const exact = registryByLocale.get(asLocale);
  if (exact) {
    return exact;
  }
  const language = asLanguageCode(localeOrLanguage);
  return registryByLanguage.get(language)?.[0];
}

export function listLanguagesByTier(
  tier: LanguageSupportTier,
): readonly LanguageDefinition[] {
  return LANGUAGE_REGISTRY.filter((entry) => entry.supportTier === tier);
}

export function isRtlLanguage(languageOrLocale: string): boolean {
  return getLanguageDefinition(languageOrLocale)?.direction === "rtl";
}

export function languageSelectionPriority(): readonly string[] {
  return [
    "administrator_campaign_configuration",
    "explicit_user_selection",
    "reliable_content_detection",
    "source_metadata",
    "market_default",
    "safe_fallback",
  ] as const;
}

/**
 * @deprecated Do not treat this as the exclusive AI language set.
 * Prefer LANGUAGE_REGISTRY and TIER1_LANGUAGE_CODES.
 */
export const SUPPORTED_LOCALES = TIER1_LANGUAGE_CODES;

/** Prefer LocaleCode. Kept for compatibility with existing imports. */
export type Locale = LocaleCode;
