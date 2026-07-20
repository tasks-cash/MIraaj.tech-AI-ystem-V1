import { describe, expect, it } from "vitest";
import {
  CAMPAIGN_LANGUAGE_VARIANT_STATUSES,
  DEFAULT_OCR_BUNDLE_CONFIG,
  LANGUAGE_REGISTRY,
  PROTECTED_BRAND_TERMS,
  TIER1_LANGUAGE_CODES,
  TIER2_LANGUAGE_CODES,
  asLanguageCode,
  asLocaleCode,
  getLanguageDefinition,
  isRtlLanguage,
  languageSelectionPriority,
  listLanguagesByTier,
} from "./index.js";

describe("language registry", () => {
  it("is not limited to Arabic, English and French", () => {
    expect(TIER1_LANGUAGE_CODES).toEqual(
      expect.arrayContaining([
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
      ]),
    );
    expect(TIER1_LANGUAGE_CODES).toHaveLength(10);
    expect(LANGUAGE_REGISTRY.length).toBeGreaterThanOrEqual(
      TIER1_LANGUAGE_CODES.length + TIER2_LANGUAGE_CODES.length,
    );
  });

  it("registers every Tier 1 and Tier 2 language code", () => {
    for (const code of TIER1_LANGUAGE_CODES) {
      expect(getLanguageDefinition(code)?.supportTier).toBe(1);
    }
    for (const code of TIER2_LANGUAGE_CODES) {
      expect(getLanguageDefinition(code)?.supportTier).toBe(2);
    }
  });

  it("keeps country and language separate through BCP 47 locales", () => {
    expect(asLocaleCode("ar-dz")).toBe("ar-DZ");
    expect(asLocaleCode("en_US")).toBe("en-US");
    expect(asLanguageCode("fr-FR")).toBe("fr");
    expect(getLanguageDefinition("zh-TW")?.englishName).toBe(
      "Chinese Traditional",
    );
    expect(getLanguageDefinition("zh-CN")?.englishName).toBe(
      "Chinese Simplified",
    );
  });

  it("classifies RTL and LTR correctly", () => {
    expect(isRtlLanguage("ar")).toBe(true);
    expect(isRtlLanguage("ur-PK")).toBe(true);
    expect(isRtlLanguage("fa")).toBe(true);
    expect(isRtlLanguage("he")).toBe(true);
    expect(isRtlLanguage("en-US")).toBe(false);
    expect(isRtlLanguage("de-DE")).toBe(false);
    expect(isRtlLanguage("ja-JP")).toBe(false);
  });

  it("exposes tiered support without claiming equal quality", () => {
    expect(listLanguagesByTier(1).every((entry) => entry.tested)).toBe(true);
    expect(listLanguagesByTier(2).every((entry) => entry.requiredReview)).toBe(
      true,
    );
    expect(languageSelectionPriority()[0]).toBe(
      "administrator_campaign_configuration",
    );
  });

  it("includes timestamps and OCR bundle defaults for future phases", () => {
    expect(LANGUAGE_REGISTRY[0]?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}/);
    expect(LANGUAGE_REGISTRY[0]?.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}/);
    expect(DEFAULT_OCR_BUNDLE_CONFIG.maxLanguagesPerJob).toBe(4);
    expect(DEFAULT_OCR_BUNDLE_CONFIG.defaultLanguages).toBe("ara+eng+fra");
    expect(PROTECTED_BRAND_TERMS).toEqual(
      expect.arrayContaining(["Miraaj.tech", "Tasks.cash"]),
    );
    expect(CAMPAIGN_LANGUAGE_VARIANT_STATUSES).toContain("pending_review");
  });
});
