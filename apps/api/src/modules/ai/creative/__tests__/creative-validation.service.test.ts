import { describe, expect, it } from "vitest";
import {
  CreativeValidationService,
  type CreativeValidationInput,
} from "../creative-validation.service.js";

const service = new CreativeValidationService();

function input(
  partial: Partial<CreativeValidationInput> = {},
): CreativeValidationInput {
  return {
    brandName: "Miraaj.tech",
    textOverlay: "Grow your clinic with Miraaj.tech",
    expectedText: "Grow your clinic with Miraaj.tech",
    ocrText: "Grow your clinic with Miraaj.tech",
    disclosureText: null,
    involvesPayment: false,
    paymentDisclosureRequired: null,
    isMedicalOrLegal: false,
    rightsStatus: "verified",
    likenessDetected: false,
    ...partial,
  };
}

describe("Prompt 5 — CreativeValidationService", () => {
  it("flags prohibited visual claims / fake testimonials", () => {
    const result = service.validate(
      input({ textOverlay: "This is a fake testimonial from a patient." }),
    );
    expect(result.errorCodes).toContain("CREATIVE_COMPLIANCE_VALIDATION_FAILED");
    expect(result.reasonCodes).toContain("fake_testimonial_risk");
  });

  it("requires payment disclosure when payment is involved", () => {
    const result = service.validate(
      input({
        involvesPayment: true,
        paymentDisclosureRequired: null,
        disclosureText: null,
      }),
    );
    expect(result.valid).toBe(false);
    expect(result.errorCodes).toContain("CREATIVE_DISCLOSURE_MISSING");
    expect(result.reasonCodes).toContain("payment_campaign");
  });

  it("flags unknown rights", () => {
    const result = service.validate(input({ rightsStatus: "unknown" }));
    expect(result.errorCodes).toContain("CREATIVE_RIGHTS_UNKNOWN");
    expect(result.reasonCodes).toContain("rights_uncertainty");
  });

  it("flags OCR mismatch", () => {
    const result = service.validate(
      input({
        expectedText: "Book a demo with Miraaj.tech",
        ocrText: "Guaranteed results forever",
      }),
    );
    expect(result.errorCodes).toContain("CREATIVE_OCR_MISMATCH");
    expect(result.reasonCodes).toContain("ocr_mismatch");
  });

  it("always requires review", () => {
    const result = service.validate(input());
    expect(result.requiresReview).toBe(true);
  });
});
