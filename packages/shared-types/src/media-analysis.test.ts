import { describe, expect, it } from "vitest";
import {
  AI_MEDIA_QUEUE_NAMES,
  ANALYSIS_PURPOSES,
  MEDIA_CAPABILITY_REGISTRY,
  MEDIA_KINDS,
  REVIEW_REASON_CODES,
} from "./media-analysis.js";

describe("media-analysis contracts", () => {
  it("registers enabled JPEG PNG WebP and PDF capabilities", () => {
    const mimes = MEDIA_CAPABILITY_REGISTRY.map((entry) => entry.mimeType);
    expect(mimes).toEqual([
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ]);
    expect(MEDIA_CAPABILITY_REGISTRY.every((entry) => entry.enabled)).toBe(true);
    expect(MEDIA_KINDS).toEqual(["image", "pdf"]);
  });

  it("defines analysis purposes and review reason codes without free-form purpose", () => {
    expect(ANALYSIS_PURPOSES).toContain("business_context");
    expect(REVIEW_REASON_CODES).toContain("medical_context");
    expect(REVIEW_REASON_CODES).toContain("ocr_language_pack_missing");
  });

  it("uses Miraaj BullMQ queue names", () => {
    expect(AI_MEDIA_QUEUE_NAMES.VALIDATE).toBe("miraaj.ai.media.validate");
    expect(AI_MEDIA_QUEUE_NAMES.ANALYZE).toBe("miraaj.ai.media.analyze");
    expect(AI_MEDIA_QUEUE_NAMES.DEAD_LETTER).toBe("miraaj.ai.media.dead-letter");
  });
});
