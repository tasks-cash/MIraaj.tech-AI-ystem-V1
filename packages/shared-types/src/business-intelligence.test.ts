import { describe, expect, it } from "vitest";
import {
  AUDIENCE_TYPES,
  BUSINESS_TYPES,
  SERVICE_CATEGORIES,
  containsProhibitedPaymentClaim,
  isConsumerAudience,
  isProfessionalAudience,
  isRegulatedBusinessType,
  PAYMENT_COMPLIANCE_DISCLAIMERS,
  AI_INTELLIGENCE_QUEUE_NAMES,
} from "./business-intelligence.js";

describe("business-intelligence contracts", () => {
  it("defines controlled taxonomies without free-form business types", () => {
    expect(BUSINESS_TYPES).toContain("dental_clinic");
    expect(BUSINESS_TYPES).toContain("restaurant");
    expect(AUDIENCE_TYPES).toContain("patient");
    expect(AUDIENCE_TYPES).toContain("dentist");
    expect(SERVICE_CATEGORIES).toHaveLength(10);
  });

  it("distinguishes consumer vs professional audiences", () => {
    expect(isConsumerAudience("patient")).toBe(true);
    expect(isConsumerAudience("student")).toBe(true);
    expect(isProfessionalAudience("dentist")).toBe(true);
    expect(isProfessionalAudience("restaurant_owner")).toBe(true);
    expect(isProfessionalAudience("patient")).toBe(false);
  });

  it("flags regulated domains and payment compliance wording", () => {
    expect(isRegulatedBusinessType("dental_clinic")).toBe(true);
    expect(isRegulatedBusinessType("school")).toBe(true);
    expect(containsProhibitedPaymentClaim("No KYC required")).toBe(true);
    expect(containsProhibitedPaymentClaim(PAYMENT_COMPLIANCE_DISCLAIMERS.en)).toBe(
      false,
    );
    expect(PAYMENT_COMPLIANCE_DISCLAIMERS.ar).toContain("Miraaj.tech");
    expect(PAYMENT_COMPLIANCE_DISCLAIMERS.fr).toContain("Miraaj.tech");
  });

  it("uses Miraaj intelligence queue names", () => {
    expect(AI_INTELLIGENCE_QUEUE_NAMES.INTELLIGENCE).toBe(
      "miraaj.ai.intelligence",
    );
    expect(AI_INTELLIGENCE_QUEUE_NAMES.DEAD_LETTER).toBe(
      "miraaj.ai.intelligence.dead-letter",
    );
  });
});
