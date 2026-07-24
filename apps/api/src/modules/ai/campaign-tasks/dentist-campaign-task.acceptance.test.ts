import { describe, expect, it } from "vitest";
import { createCampaignTaskSchema } from "./campaign-task.contracts.js";
import { evaluateCampaignTaskEligibility } from "./campaign-task.operations.js";

describe("standalone dentist campaign task acceptance", () => {
  it("admits exactly ten invited Algerian dentists and no outsider", async () => {
    const participants = Array.from({ length: 10 }, (_, index) => ({
      publicId: `adp_dentist_${index + 1}`, tenantId: "tenant_dz", country: "DZ",
      preferredLanguage: "ar", locale: "ar-DZ", profession: "dentist",
      industry: "healthcare", audienceSegments: ["clinic-owner"], status: "active",
    }));
    const parsed = createCampaignTaskSchema.parse({
      internalName: "Dentist pilot", publicTitle: "نظام إدارة العيادة",
      description: "مهمة نشر خاصة لأطباء الأسنان.", instructions: "انشر يدوياً ثم ارفع لقطة الشاشة.",
      campaignId: "cmp_clinic", campaignRevision: 1, templateId: "dst_facebook_ar", templateRevision: 1,
      approvedCopyVariantIds: ["dcv_ar_dz"], targetUrl: "https://miraaj.tech/clinic", taskMode: "pilot",
      platform: "facebook", publicationType: "private_group_post", countryAllowlist: ["DZ"],
      languageAllowlist: ["ar"], locales: ["ar-DZ"], professionAllowlist: ["dentist"],
      industryAllowlist: ["healthcare"], audienceSegments: ["clinic-owner"],
      communityType: "private_professional_group", communityRules: ["dentists only"],
      requiredDisclosure: "إعلان", qrRequired: true, headerRequired: true, proofMarkerRequired: true,
      trackedLinkRequired: true, screenshotRequired: true, assignmentDurationMinutes: 1_440,
      proofDeadlineMinutes: 1_440, humanReviewPolicy: "always", totalCapacity: 10,
      pilotConfiguration: { enabled: true, participantAllowlist: participants.map((value) => value.publicId), externalDeliveryEnabled: false },
    });
    const operational = { ...parsed, tenantId: "tenant_dz", status: "active", activeAssignmentCount: 0 };
    const results = await Promise.all(participants.map((value) => Promise.resolve(evaluateCampaignTaskEligibility(operational, value))));
    expect(results.every((value) => value.eligible)).toBe(true);
    expect(evaluateCampaignTaskEligibility(operational, { ...participants[0]!, publicId: "adp_outsider" })).toEqual({ eligible: false, code: "PARTICIPANT_INELIGIBLE" });
    expect(parsed.humanReviewPolicy).toBe("always");
    expect(parsed.qrRequired && parsed.headerRequired && parsed.proofMarkerRequired).toBe(true);
    expect(JSON.stringify(parsed)).not.toMatch(/rewardAmount|wallet|balance|withdrawal|currency/i);
  });

  it("models atomic capacity as a single bounded compare-and-increment", async () => {
    let used = 0;
    const reserve = async () => {
      await Promise.resolve();
      if (used >= 10) return false;
      used += 1;
      return true;
    };
    const outcomes = await Promise.all(Array.from({ length: 25 }, reserve));
    expect(outcomes.filter(Boolean)).toHaveLength(10);
    expect(used).toBe(10);
  });
});
