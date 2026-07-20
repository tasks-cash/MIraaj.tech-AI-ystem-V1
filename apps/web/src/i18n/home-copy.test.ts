import { describe, expect, it } from "vitest";
import { getHomeCopy, homeCopyLocales } from "@/i18n/home-copy";
import { getCopy } from "@/i18n/content";
import { getMarket } from "@/config/markets";
import { localizedHref } from "@/lib/site";

function assertNoRawKeys(value: unknown, path = "root"): void {
  if (typeof value === "string") {
    expect(value.includes("home."), `raw key at ${path}: ${value}`).toBe(false);
    expect(value.trim().length > 0, `empty string at ${path}`).toBe(true);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoRawKeys(item, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      assertNoRawKeys(nested, `${path}.${key}`);
    }
  }
}

describe("homepage multilingual copy", () => {
  it("provides verified en, ar and fr locales", () => {
    expect(homeCopyLocales).toEqual(["en", "ar", "fr"]);
    for (const locale of homeCopyLocales) {
      const copy = getHomeCopy(locale);
      expect(copy.hero.title.length).toBeGreaterThan(8);
      expect(copy.coreSolutions.items).toHaveLength(12);
      expect(copy.overview.steps).toHaveLength(5);
      expect(copy.implementation.steps).toHaveLength(6);
      assertNoRawKeys(copy, locale);
    }
  });

  it("falls back to English for unsupported locales without breaking", () => {
    const fallback = getHomeCopy("es");
    expect(fallback.hero.title).toBe(getHomeCopy("en").hero.title);
  });

  it("keeps Arabic and French content distinct from English", () => {
    expect(getHomeCopy("ar").hero.title).not.toBe(getHomeCopy("en").hero.title);
    expect(getHomeCopy("fr").hero.title).not.toBe(getHomeCopy("en").hero.title);
  });

  it("does not invent fake statistics or absolute security claims", () => {
    const blob = JSON.stringify(getHomeCopy("en"));
    expect(blob).not.toMatch(/\d{2,}%/);
    expect(blob.toLowerCase()).not.toContain("unhackable");
    expect(blob.toLowerCase()).not.toContain("zero risk");
    expect(blob.toLowerCase()).not.toContain("guaranteed approval");
  });

  it("labels non-live capabilities distinctly from delivery-ready ones", () => {
    const copy = getHomeCopy("en");
    const statuses = copy.coreSolutions.items.map((item) => item.status);
    expect(statuses).toContain("available");
    expect(statuses).toContain("capability");
    expect(copy.coreSolutions.statusAvailable).not.toBe(
      copy.coreSolutions.statusCapability,
    );
  });
});

describe("homepage market routing", () => {
  it("resolves global en/ar/fr markets for the shared homepage route", () => {
    for (const locale of ["en", "ar", "fr"] as const) {
      const market = getMarket("global", locale);
      expect(market).toBeTruthy();
      expect(market?.locale).toBe(locale);
      expect(localizedHref("global", locale)).toBe(`/global/${locale}`);
    }
  });

  it("marks Arabic as RTL and English/French as LTR", () => {
    expect(getMarket("global", "ar")?.direction).toBe("rtl");
    expect(getMarket("global", "en")?.direction).toBe("ltr");
    expect(getMarket("global", "fr")?.direction).toBe("ltr");
  });

  it("keeps existing CTA destinations on known routes", () => {
    for (const path of ["ai", "process", "quote", "services", "contact"]) {
      expect(localizedHref("global", "en", path)).toBe(`/global/en/${path}`);
    }
  });
});

describe("site chrome copy remains available", () => {
  it("still resolves navbar copy for en/ar/fr", () => {
    expect(getCopy("en").nav.services).toBeTruthy();
    expect(getCopy("ar").nav.services).toBeTruthy();
    expect(getCopy("fr").nav.services).toBeTruthy();
  });
});
