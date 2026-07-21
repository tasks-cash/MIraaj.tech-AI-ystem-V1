import type { CreativeBriefRef } from "./creative-source-eligibility.service.js";

/**
 * Builds provider prompts from brief fields. Never includes secrets.
 * textOverlay is intentionally omitted from the provider prompt — Nest applies
 * overlays locally during render.
 */
export function buildCreativeProviderPrompt(brief: CreativeBriefRef): {
  prompt: string;
  negativePrompt: string;
} {
  const parts: string[] = [];
  if (brief.conceptTitle?.trim()) {
    parts.push(brief.conceptTitle.trim());
  }
  if (brief.visualNarrative?.trim()) {
    parts.push(brief.visualNarrative.trim());
  }
  if (brief.requiredElements && brief.requiredElements.length > 0) {
    parts.push(`Required elements: ${brief.requiredElements.join(", ")}`);
  }
  parts.push("Brand: Miraaj.tech");
  if (!brief.conceptTitle && !brief.visualNarrative) {
    parts.unshift("Professional marketing creative for Miraaj.tech");
  }

  const negativeParts = [
    ...(brief.prohibitedElements ?? []),
    "fake testimonials",
    "guaranteed medical outcomes",
    "copyrighted characters",
  ];

  return {
    prompt: parts.join(". ").slice(0, 4_000),
    negativePrompt: negativeParts.join(", ").slice(0, 2_000),
  };
}

export function defaultDimensionsForAssetType(assetType: string): {
  width: number;
  height: number;
} {
  if (
    assetType.includes("portrait") ||
    assetType.includes("story") ||
    assetType === "reel" ||
    assetType === "short" ||
    assetType.includes("vertical")
  ) {
    return { width: 1080, height: 1920 };
  }
  if (assetType.includes("landscape") || assetType.includes("banner")) {
    return { width: 1920, height: 1080 };
  }
  return { width: 1024, height: 1024 };
}
