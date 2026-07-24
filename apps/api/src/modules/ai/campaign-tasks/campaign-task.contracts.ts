import { z } from "zod";

const stringList = z.array(z.string().trim().min(1).max(120)).max(100).default([]);
export const taskModeSchema = z.enum(["general", "targeted", "private", "invite_only", "pilot", "manual_assignment", "limited_capacity", "recurring"]);

export const createCampaignTaskSchema = z.object({
  internalName: z.string().trim().min(3).max(160),
  publicTitle: z.string().trim().min(3).max(240),
  description: z.string().trim().min(3).max(5_000),
  instructions: z.string().trim().min(3).max(10_000),
  campaignId: z.string().trim().min(3).max(160),
  campaignRevision: z.number().int().min(1),
  templateId: z.string().trim().min(3).max(160),
  templateRevision: z.number().int().min(1),
  approvedCopyVariantIds: z.array(z.string().trim().min(3).max(160)).min(1).max(50),
  externalTaskReference: z.string().trim().max(200).default(""),
  externalRewardRuleReference: z.string().trim().max(200).default(""),
  targetUrl: z.url({ protocol: /^https$/ }).max(2_048),
  taskMode: taskModeSchema,
  platform: z.string().trim().min(1).max(80),
  publicationType: z.string().trim().min(1).max(80),
  countryAllowlist: stringList,
  languageAllowlist: stringList,
  locales: stringList,
  professionAllowlist: stringList,
  industryAllowlist: stringList,
  audienceSegments: stringList,
  communityType: z.string().trim().min(1).max(80),
  communityRules: stringList,
  requiredDisclosure: z.string().trim().max(1_000).default(""),
  qrRequired: z.boolean().default(true),
  trackedLinkRequired: z.boolean().default(true),
  proofMarkerRequired: z.boolean().default(true),
  headerRequired: z.boolean().default(true),
  screenshotRequired: z.boolean().default(true),
  postUrlRequirement: z.enum(["optional", "required", "forbidden"]).default("optional"),
  timestampRequirement: z.enum(["optional", "required", "forbidden"]).default("optional"),
  assignmentDurationMinutes: z.number().int().min(1).max(43_200),
  proofDeadlineMinutes: z.number().int().min(1).max(43_200),
  humanReviewPolicy: z.enum(["always", "risk_based", "never"]).default("always"),
  startAt: z.iso.datetime().optional(),
  endAt: z.iso.datetime().optional(),
  totalCapacity: z.number().int().min(1).max(100_000),
  capacityByCountry: z.record(z.string(), z.number().int().min(1).max(100_000)).default({}),
  perParticipantLimit: z.number().int().min(1).max(100).default(1),
  dailyParticipantLimit: z.number().int().min(1).max(100).default(1),
  privateParticipantIds: stringList,
  pilotConfiguration: z.object({
    enabled: z.boolean().default(false),
    participantAllowlist: stringList,
    externalDeliveryEnabled: z.boolean().default(false),
  }).default({ enabled: false, participantAllowlist: [], externalDeliveryEnabled: false }),
  recurrenceConfiguration: z.object({
    enabled: z.boolean().default(false),
    cadence: z.enum(["daily", "weekly"]).optional(),
    maxOccurrences: z.number().int().min(1).max(365).optional(),
  }).default({ enabled: false }),
}).strict().superRefine((value, context) => {
  if (value.endAt && value.startAt && new Date(value.endAt) <= new Date(value.startAt)) {
    context.addIssue({ code: "custom", path: ["endAt"], message: "endAt must follow startAt" });
  }
  if (value.taskMode === "pilot" && (!value.pilotConfiguration.enabled || value.humanReviewPolicy !== "always")) {
    context.addIssue({ code: "custom", path: ["pilotConfiguration"], message: "pilot tasks require an enabled pilot and mandatory review" });
  }
});

export const participantSchema = z.object({
  externalSystem: z.string().trim().min(2).max(80),
  externalParticipantId: z.string().trim().min(2).max(200),
  country: z.string().trim().min(2).max(3),
  preferredLanguage: z.string().trim().min(2).max(20),
  locale: z.string().trim().min(2).max(30),
  profession: z.string().trim().max(120).default(""),
  industry: z.string().trim().max(120).default(""),
  audienceSegments: stringList,
}).strict();

export const invitationBatchSchema = z.object({
  participantIds: z.array(z.string().trim().min(3).max(160)).min(1).max(100),
  expiresAt: z.iso.datetime(),
}).strict();
