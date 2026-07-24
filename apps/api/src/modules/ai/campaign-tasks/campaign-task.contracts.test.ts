import { describe, expect, it } from "vitest";
import { createCampaignTaskSchema, invitationBatchSchema, participantSchema } from "./campaign-task.contracts.js";

const validTask = {
  internalName: "Algeria dentist pilot",
  publicTitle: "شارك نظام إدارة العيادة",
  description: "نشر يدوي داخل مجموعة مهنية خاصة.",
  instructions: "استخدم النص والرمز والعلامة المعتمدة دون تعديل.",
  campaignId: "cmp_approved",
  campaignRevision: 1,
  templateId: "dst_active",
  templateRevision: 1,
  approvedCopyVariantIds: ["dcv_ar_dz"],
  targetUrl: "https://miraaj.tech/clinic",
  taskMode: "pilot",
  platform: "facebook",
  publicationType: "group_post",
  countryAllowlist: ["DZ"],
  languageAllowlist: ["ar"],
  locales: ["ar-DZ"],
  professionAllowlist: ["dentist"],
  industryAllowlist: ["healthcare"],
  audienceSegments: ["clinic-owner"],
  communityType: "private_professional_group",
  communityRules: ["dentists only"],
  assignmentDurationMinutes: 1_440,
  proofDeadlineMinutes: 1_440,
  humanReviewPolicy: "always",
  totalCapacity: 10,
  pilotConfiguration: { enabled: true, participantAllowlist: ["adp_1"], externalDeliveryEnabled: false },
};

describe("campaign task strict contracts", () => {
  it("accepts a bounded non-financial pilot task", () => {
    expect(createCampaignTaskSchema.safeParse(validTask).success).toBe(true);
  });

  it("rejects unknown and financial fields", () => {
    expect(createCampaignTaskSchema.safeParse({ ...validTask, rewardAmount: 100 }).success).toBe(false);
    expect(createCampaignTaskSchema.safeParse({ ...validTask, wallet: "0x123" }).success).toBe(false);
    expect(createCampaignTaskSchema.safeParse({ ...validTask, targetUrl: "http://example.com" }).success).toBe(false);
  });

  it("requires mandatory review and bounded time windows for pilot mode", () => {
    expect(createCampaignTaskSchema.safeParse({ ...validTask, humanReviewPolicy: "never" }).success).toBe(false);
    expect(createCampaignTaskSchema.safeParse({ ...validTask, startAt: "2026-08-02T00:00:00.000Z", endAt: "2026-08-01T00:00:00.000Z" }).success).toBe(false);
  });

  it("validates tenant-scoped participant and invitation inputs", () => {
    expect(participantSchema.safeParse({ externalSystem: "internal-pilot", externalParticipantId: "dentist-1", country: "DZ", preferredLanguage: "ar", locale: "ar-DZ" }).success).toBe(true);
    expect(participantSchema.safeParse({ externalSystem: "x", externalParticipantId: "1", country: "DZ", preferredLanguage: "ar", locale: "ar-DZ", email: "private@example.com" }).success).toBe(false);
    expect(invitationBatchSchema.safeParse({ participantIds: ["adp_1"], expiresAt: "2026-08-01T00:00:00.000Z" }).success).toBe(true);
  });
});
