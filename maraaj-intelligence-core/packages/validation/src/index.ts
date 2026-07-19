
import { z } from "zod";

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createProjectSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().min(2).max(80).regex(/^[a-z0-9-]+$/),
  environment: z.enum(["development", "staging", "production"]),
  enabledModules: z.array(z.string()).default([]),
  allowedOrigins: z.array(z.string().url()).default([]),
  allowedCallbackUrls: z.array(z.string().url()).default([]),
  allowedWebhookUrls: z.array(z.string().url()).default([]),
  allowedIpRanges: z.array(z.string()).default([]),
});

export const createApiClientSchema = z.object({
  name: z.string().min(2).max(120),
  projectId: objectIdSchema,
  environment: z.enum(["development", "staging", "production"]),
  scopes: z.array(z.string()).min(1),
  expiresAt: z.string().datetime().optional(),
  allowedIps: z.array(z.string()).default([]),
  allowedOrigins: z.array(z.string()).default([]),
  mtlsEnabled: z.boolean().default(false),
  certificateFingerprint: z.string().optional(),
});

export const createPostSchema = z.object({
  source: z.string().min(1).max(80),
  sourceReference: z.string().max(200).optional(),
  title: z.string().min(1).max(300),
  slug: z.string().max(200).optional(),
  description: z.string().max(5000).optional(),
  locale: z.string().default("en"),
  candidateCategories: z.array(z.string()).default([]),
  assetId: objectIdSchema.optional(),
  destinationUrl: z.string().url().optional(),
  groupId: objectIdSchema.optional(),
  categoryId: objectIdSchema.optional(),
  tags: z.array(z.string()).default([]),
});

export const createCategorySchema = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/),
  description: z.string().max(2000).optional(),
  parentCategoryId: objectIdSchema.optional(),
  positiveKeywords: z.array(z.string()).default([]),
  negativeKeywords: z.array(z.string()).default([]),
  minimumConfidence: z.number().min(0).max(1).default(0.5),
  autoApproveThreshold: z.number().min(0).max(1).default(0.85),
  reviewThreshold: z.number().min(0).max(1).default(0.6),
  displayOrder: z.number().int().default(0),
});

export const createGroupSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/),
  description: z.string().max(2000).optional(),
  destinationType: z.enum([
    "tasks_cash", "website", "telegram", "facebook", "instagram",
    "linkedin", "x", "internal_feed", "external_api", "newsletter", "other",
  ]),
  allowedCategoryIds: z.array(objectIdSchema).default([]),
  blockedCategoryIds: z.array(objectIdSchema).default([]),
  autoPublish: z.boolean().default(false),
  requiresReview: z.boolean().default(true),
  qrEnabled: z.boolean().default(true),
  trackingEnabled: z.boolean().default(true),
});

export const publicEventSchema = z.object({
  type: z.enum([
    "page_view", "qr_scan", "outbound_click", "share_click",
    "cta_click", "conversion", "report_submission",
  ]),
  publicCode: z.string().min(4).max(64),
  sessionId: z.string().max(128).optional(),
  consentState: z.enum(["unknown", "denied", "necessary", "analytics", "all"]).default("unknown"),
  conversionType: z.string().max(80).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
  totp: z.string().min(6).max(12).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(12).max(200),
});

export const twoFactorConfirmSchema = z.object({
  totp: z.string().length(6),
});
