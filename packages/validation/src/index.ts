import type { LoginRequest, RegisterRequest } from "@miraaj/contracts";
import { z } from "zod";

const safeText = (min: number, max: number) => z.string().trim().min(min).max(max);
const optionalHttpUrl = z.union([z.literal(""), z.url({ protocol: /^https?$/ })]).optional();

export const loginSchema: z.ZodType<LoginRequest> = z.object({
  email: z.email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
});

export const registerSchema: z.ZodType<RegisterRequest> = z.object({
  name: safeText(2, 100),
  email: z.email().max(254).transform((value) => value.toLowerCase()),
  password: z
    .string()
    .min(12)
    .max(128)
    .regex(/[a-z]/, "Must include a lowercase letter")
    .regex(/[A-Z]/, "Must include an uppercase letter")
    .regex(/[0-9]/, "Must include a number"),
  workspaceName: safeText(2, 100).optional(),
});

export const brandCreateSchema = z.object({
  name: safeText(2, 120),
  description: safeText(1, 2_000).optional(),
  websiteUrl: optionalHttpUrl,
  voice: safeText(1, 500).optional(),
});

export const campaignCreateSchema = z
  .object({
    brandId: z.string().min(1).max(64),
    name: safeText(2, 160),
    objective: safeText(5, 2_000),
    startsAt: z.iso.datetime().optional(),
    endsAt: z.iso.datetime().optional(),
    budgetMinor: z.number().int().nonnegative().max(1_000_000_000).optional(),
    currency: z.string().regex(/^[A-Z]{3}$/).optional(),
  })
  .refine(
    (value) => !value.startsAt || !value.endsAt || Date.parse(value.endsAt) > Date.parse(value.startsAt),
    { message: "End date must be after start date", path: ["endsAt"] },
  );

export const targetGroupSchema = z
  .object({
    name: safeText(2, 120),
    description: safeText(1, 1_000).optional(),
    countries: z.array(z.string().regex(/^[A-Z]{2}$/)).max(50),
    languages: z.array(z.string().regex(/^[a-z]{2,3}(-[A-Z]{2})?$/)).max(20),
    interests: z.array(safeText(1, 80)).max(100),
    minAge: z.number().int().min(13).max(120).optional(),
    maxAge: z.number().int().min(13).max(120).optional(),
  })
  .refine((value) => !value.minAge || !value.maxAge || value.maxAge >= value.minAge, {
    message: "Maximum age must not be less than minimum age",
    path: ["maxAge"],
  });

export const proofSubmitSchema = z.object({
  campaignId: z.string().min(1).max(64),
  mediaUrls: z.array(z.url({ protocol: /^https$/ })).min(1).max(10),
  note: safeText(1, 2_000).optional(),
});

export type BrandCreateInput = z.infer<typeof brandCreateSchema>;
export type CampaignCreateInput = z.infer<typeof campaignCreateSchema>;
export type TargetGroupInput = z.infer<typeof targetGroupSchema>;
export type ProofSubmitInput = z.infer<typeof proofSubmitSchema>;
