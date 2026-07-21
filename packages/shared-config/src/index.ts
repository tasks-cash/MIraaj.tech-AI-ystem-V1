import { z } from "zod";

const appEnvironmentSchema = z.enum(["development", "test", "staging", "production"]);
const nonEmptySecret = z.string().min(32, "must contain at least 32 characters");
const optionalHttpUrl = z.union([z.literal(""), z.url({ protocol: /^https?$/ })]);
const environmentBoolean = z
  .union([z.boolean(), z.enum(["true", "false"])])
  .transform((value) => value === true || value === "true");

export const AI_PERMISSIONS = {
  SYSTEM_STATUS_READ: "ai.systemStatus.read",
  LANGUAGES_READ: "ai.languages.read",
  LANGUAGES_MANAGE: "ai.languages.manage",
  TRANSLATION_READ: "ai.translation.read",
  TRANSLATION_GENERATE: "ai.translation.generate",
  TRANSLATION_REVIEW: "ai.translation.review",
  TRANSLATION_APPROVE: "ai.translation.approve",
  GLOSSARY_READ: "ai.glossary.read",
  GLOSSARY_MANAGE: "ai.glossary.manage",
  GLOSSARY_PUBLISH: "ai.glossary.publish",
  MEDIA_CREATE: "ai.media.create",
  MEDIA_READ: "ai.media.read",
  MEDIA_DELETE: "ai.media.delete",
  ANALYSIS_CREATE: "ai.analysis.create",
  ANALYSIS_READ: "ai.analysis.read",
  ANALYSIS_RETRY: "ai.analysis.retry",
  ANALYSIS_CANCEL: "ai.analysis.cancel",
  ANALYSIS_REVIEW: "ai.analysis.review",
  ANALYSIS_APPROVE: "ai.analysis.approve",
  ANALYSIS_REJECT: "ai.analysis.reject",
  PROMPTS_READ: "ai.prompts.read",
  PROMPTS_MANAGE: "ai.prompts.manage",
  INTELLIGENCE_CREATE: "ai.intelligence.create",
  INTELLIGENCE_READ: "ai.intelligence.read",
  INTELLIGENCE_RETRY: "ai.intelligence.retry",
  INTELLIGENCE_CANCEL: "ai.intelligence.cancel",
  BUSINESS_PROFILES_READ: "ai.businessProfiles.read",
  BUSINESS_PROFILES_REVIEW: "ai.businessProfiles.review",
  BUSINESS_PROFILES_APPROVE: "ai.businessProfiles.approve",
  BUSINESS_PROFILES_REJECT: "ai.businessProfiles.reject",
  RECOMMENDATIONS_READ: "ai.recommendations.read",
  RECOMMENDATIONS_RECOMPUTE: "ai.recommendations.recompute",
  RECOMMENDATIONS_REVIEW: "ai.recommendations.review",
  RECOMMENDATIONS_APPROVE: "ai.recommendations.approve",
  RECOMMENDATIONS_REJECT: "ai.recommendations.reject",
  SERVICE_CATALOG_READ: "ai.serviceCatalog.read",
  SERVICE_CATALOG_CREATE: "ai.serviceCatalog.create",
  SERVICE_CATALOG_UPDATE: "ai.serviceCatalog.update",
  SERVICE_CATALOG_PUBLISH: "ai.serviceCatalog.publish",
  SERVICE_CATALOG_DEPRECATE: "ai.serviceCatalog.deprecate",
  MATCHING_POLICIES_READ: "ai.matchingPolicies.read",
  MATCHING_POLICIES_MANAGE: "ai.matchingPolicies.manage",
  MATCHING_POLICIES_PUBLISH: "ai.matchingPolicies.publish",
  CAMPAIGNS_CREATE: "ai.campaigns.create",
  CAMPAIGNS_READ: "ai.campaigns.read",
  CAMPAIGNS_UPDATE: "ai.campaigns.update",
  CAMPAIGNS_RETRY: "ai.campaigns.retry",
  CAMPAIGNS_CANCEL: "ai.campaigns.cancel",
  CAMPAIGNS_REGENERATE: "ai.campaigns.regenerate",
  CAMPAIGNS_REVIEW: "ai.campaigns.review",
  CAMPAIGNS_APPROVE: "ai.campaigns.approve",
  CAMPAIGNS_REJECT: "ai.campaigns.reject",
  CAMPAIGN_BRIEFS_CREATE: "ai.campaignBriefs.create",
  CAMPAIGN_BRIEFS_READ: "ai.campaignBriefs.read",
  CAMPAIGN_BRIEFS_UPDATE: "ai.campaignBriefs.update",
  BRAND_PROFILES_READ: "ai.brandProfiles.read",
  BRAND_PROFILES_CREATE: "ai.brandProfiles.create",
  BRAND_PROFILES_UPDATE: "ai.brandProfiles.update",
  BRAND_PROFILES_PUBLISH: "ai.brandProfiles.publish",
  BRAND_PROFILES_DEPRECATE: "ai.brandProfiles.deprecate",
  CAMPAIGN_POLICIES_READ: "ai.campaignPolicies.read",
  CAMPAIGN_POLICIES_MANAGE: "ai.campaignPolicies.manage",
  CAMPAIGN_POLICIES_PUBLISH: "ai.campaignPolicies.publish",
  PLATFORM_POLICIES_READ: "ai.platformPolicies.read",
  PLATFORM_POLICIES_MANAGE: "ai.platformPolicies.manage",
  PLATFORM_POLICIES_PUBLISH: "ai.platformPolicies.publish",
  COMPLIANCE_POLICIES_READ: "ai.compliancePolicies.read",
  COMPLIANCE_POLICIES_MANAGE: "ai.compliancePolicies.manage",
  COMPLIANCE_POLICIES_PUBLISH: "ai.compliancePolicies.publish",
  TRANSLATION_GLOSSARIES_READ: "ai.translationGlossaries.read",
  TRANSLATION_GLOSSARIES_MANAGE: "ai.translationGlossaries.manage",
  TRANSLATION_GLOSSARIES_PUBLISH: "ai.translationGlossaries.publish",
  CREATIVE_JOBS_CREATE: "ai.creativeJobs.create",
  CREATIVE_JOBS_READ: "ai.creativeJobs.read",
  CREATIVE_JOBS_RETRY: "ai.creativeJobs.retry",
  CREATIVE_JOBS_CANCEL: "ai.creativeJobs.cancel",
  CREATIVE_ASSETS_READ: "ai.creativeAssets.read",
  CREATIVE_ASSETS_REGENERATE: "ai.creativeAssets.regenerate",
  CREATIVE_ASSETS_REVIEW: "ai.creativeAssets.review",
  CREATIVE_ASSETS_APPROVE: "ai.creativeAssets.approve",
  CREATIVE_ASSETS_REJECT: "ai.creativeAssets.reject",
  CREATIVE_MANUAL_ASSETS_CREATE: "ai.creativeManualAssets.create",
  CREATIVE_MANUAL_ASSETS_COMPLETE: "ai.creativeManualAssets.complete",
  CREATIVE_RIGHTS_READ: "ai.creativeRights.read",
  CREATIVE_RIGHTS_REVIEW: "ai.creativeRights.review",
  CREATIVE_PROVIDERS_READ: "ai.creativeProviders.read",
  CREATIVE_PROVIDERS_MANAGE: "ai.creativeProviders.manage",
  RENDER_SPECIFICATIONS_READ: "ai.renderSpecifications.read",
  RENDER_SPECIFICATIONS_MANAGE: "ai.renderSpecifications.manage",
  RENDER_SPECIFICATIONS_PUBLISH: "ai.renderSpecifications.publish",
  AUDIT_LOGS_READ: "ai.auditLogs.read",
} as const;

export const ALL_TEMPORARY_ADMIN_PERMISSIONS = Object.values(AI_PERMISSIONS);

const positiveInt = (min: number, max: number) =>
  z.coerce.number().int().min(min).max(max);

export const serverEnvironmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ENV: appEnvironmentSchema.default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  MONGODB_URI: z.string().min(1),
  REDIS_URL: z.string().min(1),
  S3_ENDPOINT: optionalHttpUrl,
  S3_PUBLIC_ENDPOINT: optionalHttpUrl.default(""),
  S3_REGION: z.string().min(1).default("us-east-1"),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  ENCRYPTION_KEY_ID: z.string().min(1),
  ENCRYPTION_MASTER_KEY: nonEmptySecret,
});

export const apiEnvironmentSchema = serverEnvironmentSchema
  .extend({
    API_HOST: z.string().min(1).default("0.0.0.0"),
    API_PORT: z.coerce.number().int().min(1).max(65_535).default(4200),
    AI_SERVICE_URL: z.url({ protocol: /^https?$/ }),
    AI_SERVICE_HOST: z.string().min(1).default("0.0.0.0"),
    AI_SERVICE_PORT: z.coerce.number().int().min(1).max(65_535).default(8200),
    AI_SERVICE_ID: z.string().min(3).max(100).default("miraaj-api"),
    AI_SERVICE_INTERNAL_SECRET: nonEmptySecret,
    AI_SERVICE_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(100).max(120_000).default(5_000),
    AI_SERVICE_REPLAY_WINDOW_SECONDS: z.coerce.number().int().min(5).max(600).default(120),
    AI_SERVICE_VERSION: z.string().min(1).default("0.1.0"),
    TEMPORARY_ADMIN_TOKEN_ENABLED: environmentBoolean.default(true),
    ALLOW_TEMPORARY_ADMIN_TOKEN_IN_PRODUCTION: environmentBoolean.default(false),
    ADMIN_API_TOKEN: nonEmptySecret,
    MEDIA_MAX_IMAGE_BYTES: positiveInt(1_024, 52_428_800).default(15_728_640),
    MEDIA_MAX_PDF_BYTES: positiveInt(1_024, 104_857_600).default(26_214_400),
    MEDIA_MAX_IMAGE_WIDTH: positiveInt(64, 20_000).default(12_000),
    MEDIA_MAX_IMAGE_HEIGHT: positiveInt(64, 20_000).default(12_000),
    MEDIA_MAX_IMAGE_PIXELS: positiveInt(10_000, 100_000_000).default(50_000_000),
    MEDIA_MAX_PDF_PAGES: positiveInt(1, 100).default(25),
    MEDIA_MAX_TOTAL_RENDERED_PIXELS: positiveInt(100_000, 500_000_000).default(
      150_000_000,
    ),
    MEDIA_UPLOAD_SESSION_TTL_SECONDS: positiveInt(60, 7_200).default(1_800),
    MEDIA_PROCESSING_TIMEOUT_SECONDS: positiveInt(10, 600).default(120),
    MEDIA_OCR_TIMEOUT_SECONDS: positiveInt(5, 300).default(90),
    MEDIA_VISION_TIMEOUT_SECONDS: positiveInt(5, 300).default(90),
    MEDIA_MAX_RETRIES: positiveInt(0, 10).default(3),
    MEDIA_WORKER_CONCURRENCY: positiveInt(1, 16).default(2),
    MEDIA_NORMALIZED_IMAGE_FORMAT: z.enum(["webp", "png"]).default("webp"),
    MEDIA_NORMALIZED_IMAGE_QUALITY: positiveInt(40, 100).default(90),
    MEDIA_PRESIGNED_UPLOAD_TTL_SECONDS: positiveInt(60, 3_600).default(900),
    MEDIA_PRESIGNED_READ_TTL_SECONDS: positiveInt(30, 900).default(120),
    MEDIA_PERCEPTUAL_HASH_DISTANCE: positiveInt(0, 32).default(8),
    MEDIA_STALE_JOB_HEARTBEAT_SECONDS: positiveInt(30, 3_600).default(180),
    MEDIA_FETCH_ALLOWED_HOSTS: z
      .string()
      .min(1)
      .default("localhost,127.0.0.1,minio"),
    CONFIDENCE_AUTO_COMPLETE_MIN: z.coerce.number().min(0.5).max(1).default(0.82),
    CONFIDENCE_REVIEW_MIN: z.coerce.number().min(0).max(1).default(0.5),
    CONFIDENCE_LOW_BELOW: z.coerce.number().min(0).max(1).default(0.5),
    OCR_LANGUAGES_DEFAULT: z.string().min(1).default("ara+eng+fra"),
    OCR_LANGUAGES_INSTALLED: z
      .string()
      .min(1)
      .default("ara,eng,fra,spa,deu,por,ita,nld,tur,rus"),
    OCR_MAX_LANGUAGES_PER_JOB: positiveInt(1, 8).default(4),
    BULLMQ_VALIDATE_QUEUE: z.string().min(1).default("miraaj.ai.media.validate"),
    BULLMQ_ANALYZE_QUEUE: z.string().min(1).default("miraaj.ai.media.analyze"),
    BULLMQ_DEAD_LETTER_QUEUE: z
      .string()
      .min(1)
      .default("miraaj.ai.media.dead-letter"),
    VISION_PROVIDER_ENABLED: environmentBoolean.default(false),
    AI_INTELLIGENCE_QUEUE_NAME: z
      .string()
      .min(1)
      .default("miraaj.ai.intelligence"),
    AI_INTELLIGENCE_DLQ_NAME: z
      .string()
      .min(1)
      .default("miraaj.ai.intelligence.dead-letter"),
    AI_INTELLIGENCE_WORKER_CONCURRENCY: positiveInt(1, 16).default(2),
    AI_INTELLIGENCE_MAX_RETRIES: positiveInt(0, 10).default(3),
    AI_INTELLIGENCE_TIMEOUT_SECONDS: positiveInt(10, 600).default(120),
    AI_INTELLIGENCE_STALE_SECONDS: positiveInt(30, 3_600).default(300),
    AI_INTELLIGENCE_RECONCILE_INTERVAL_SECONDS: positiveInt(15, 3_600).default(
      60,
    ),
    AI_REASONING_PROVIDER: z
      .enum(["disabled", "gemini"])
      .default("disabled"),
    AI_REASONING_MODEL: z.string().default(""),
    AI_REASONING_TIMEOUT_SECONDS: positiveInt(5, 300).default(60),
    AI_REASONING_MAX_RETRIES: positiveInt(0, 5).default(2),
    AI_REASONING_MAX_INPUT_CHARS: positiveInt(1_000, 100_000).default(30_000),
    SERVICE_MATCH_AUTO_APPROVE_MIN: z.coerce
      .number()
      .min(0.5)
      .max(1)
      .default(0.85),
    SERVICE_MATCH_REVIEW_MIN: z.coerce.number().min(0).max(1).default(0.55),
    SERVICE_MATCH_PRIMARY_LIMIT: positiveInt(1, 50).default(10),
    SERVICE_MATCH_SUPPORTING_LIMIT: positiveInt(1, 50).default(15),
    SERVICE_MATCH_OPTIONAL_LIMIT: positiveInt(1, 50).default(10),
    SERVICE_MATCH_FUTURE_LIMIT: positiveInt(1, 50).default(10),
    SERVICE_MATCH_DECISION_MAKER_MIN: z.coerce
      .number()
      .min(0)
      .max(1)
      .default(0.65),
    SERVICE_MATCH_PROFESSIONAL_CONTEXT_MIN: z.coerce
      .number()
      .min(0)
      .max(1)
      .default(0.65),
    AI_CAMPAIGN_QUEUE_NAME: z.string().min(1).default("miraaj.ai.campaigns"),
    AI_CAMPAIGN_DLQ_NAME: z
      .string()
      .min(1)
      .default("miraaj.ai.campaigns.dead-letter"),
    AI_CAMPAIGN_WORKER_CONCURRENCY: positiveInt(1, 16).default(2),
    AI_CAMPAIGN_MAX_RETRIES: positiveInt(0, 10).default(3),
    AI_CAMPAIGN_TIMEOUT_SECONDS: positiveInt(10, 600).default(180),
    AI_CAMPAIGN_STALE_SECONDS: positiveInt(30, 3_600).default(420),
    AI_CAMPAIGN_RECONCILE_INTERVAL_SECONDS: positiveInt(15, 3_600).default(60),
    AI_CAMPAIGN_PROVIDER: z.enum(["disabled", "gemini"]).default("disabled"),
    AI_CAMPAIGN_MODEL: z.string().default(""),
    AI_CAMPAIGN_PROVIDER_TIMEOUT_SECONDS: positiveInt(5, 300).default(90),
    AI_CAMPAIGN_PROVIDER_MAX_RETRIES: positiveInt(0, 5).default(2),
    AI_CAMPAIGN_MAX_INPUT_CHARS: positiveInt(1_000, 200_000).default(50_000),
    AI_CAMPAIGN_MAX_OUTPUT_CHARS: positiveInt(1_000, 500_000).default(100_000),
    AI_TRANSLATION_PROVIDER: z.enum(["disabled", "gemini"]).default("disabled"),
    AI_TRANSLATION_MODEL: z.string().default(""),
    AI_TRANSLATION_TIMEOUT_SECONDS: positiveInt(5, 300).default(60),
    AI_TRANSLATION_MAX_RETRIES: positiveInt(0, 5).default(2),
    CAMPAIGN_MAX_SERVICES: positiveInt(1, 50).default(10),
    CAMPAIGN_MAX_PLATFORMS: positiveInt(1, 20).default(8),
    CAMPAIGN_MAX_LANGUAGES: positiveInt(1, 30).default(10),
    CAMPAIGN_MAX_LOCALES: positiveInt(1, 30).default(10),
    CAMPAIGN_MAX_PLATFORM_VARIANTS: positiveInt(1, 100).default(40),
    CAMPAIGN_MAX_LANGUAGE_VARIANTS: positiveInt(1, 50).default(20),
    CAMPAIGN_MAX_HASHTAGS_PER_VARIANT: positiveInt(1, 50).default(20),
    CAMPAIGN_MAX_KEYWORDS_PER_VARIANT: positiveInt(1, 100).default(30),
    CAMPAIGN_QUALITY_HIGH_MIN: z.coerce.number().min(0).max(1).default(0.88),
    CAMPAIGN_QUALITY_REVIEW_MIN: z.coerce.number().min(0).max(1).default(0.65),
    CAMPAIGN_BRAND_SCORE_MIN: z.coerce.number().min(0).max(1).default(0.8),
    CAMPAIGN_COMPLIANCE_SCORE_MIN: z.coerce.number().min(0).max(1).default(0.95),
    CAMPAIGN_LANGUAGE_SCORE_MIN: z.coerce.number().min(0).max(1).default(0.78),
    CAMPAIGN_SEMANTIC_PRESERVATION_MIN: z.coerce
      .number()
      .min(0)
      .max(1)
      .default(0.9),
    CAMPAIGN_AUDIENCE_FIT_MIN: z.coerce.number().min(0).max(1).default(0.75),
    CAMPAIGN_AUTO_APPROVE_ENABLED: environmentBoolean.default(false),
    AI_CREATIVE_QUEUE_NAME: z
      .string()
      .min(1)
      .default("miraaj.ai.creative-generation"),
    AI_CREATIVE_DLQ_NAME: z
      .string()
      .min(1)
      .default("miraaj.ai.creative-generation.dead-letter"),
    AI_CREATIVE_WORKER_CONCURRENCY: positiveInt(1, 16).default(2),
    AI_CREATIVE_IMAGE_CONCURRENCY: positiveInt(1, 16).default(2),
    AI_CREATIVE_VIDEO_CONCURRENCY: positiveInt(1, 8).default(1),
    AI_CREATIVE_MAX_RETRIES: positiveInt(0, 10).default(3),
    AI_CREATIVE_JOB_TIMEOUT_SECONDS: positiveInt(30, 3_600).default(900),
    AI_CREATIVE_STALE_SECONDS: positiveInt(60, 7_200).default(1_200),
    AI_CREATIVE_RECONCILE_INTERVAL_SECONDS: positiveInt(15, 3_600).default(60),
    AI_IMAGE_PROVIDER: z.enum(["disabled", "mock", "openai"]).default("disabled"),
    AI_IMAGE_MODEL: z.string().default(""),
    AI_IMAGE_PROVIDER_TIMEOUT_SECONDS: positiveInt(5, 1_800).default(300),
    AI_IMAGE_PROVIDER_MAX_RETRIES: positiveInt(0, 5).default(2),
    AI_IMAGE_PROVIDER_MAX_VARIANTS: positiveInt(1, 8).default(4),
    AI_VIDEO_PROVIDER: z.enum(["disabled", "mock", "runway"]).default("disabled"),
    AI_VIDEO_MODEL: z.string().default(""),
    AI_VIDEO_PROVIDER_TIMEOUT_SECONDS: positiveInt(5, 3_600).default(1_200),
    AI_VIDEO_PROVIDER_MAX_RETRIES: positiveInt(0, 5).default(2),
    AI_VIDEO_PROVIDER_POLL_INTERVAL_SECONDS: positiveInt(1, 120).default(10),
    AI_VIDEO_PROVIDER_MAX_POLL_ATTEMPTS: positiveInt(1, 500).default(120),
    AI_RENDER_PROVIDER: z.enum(["local", "disabled"]).default("local"),
    AI_RENDER_TIMEOUT_SECONDS: positiveInt(5, 3_600).default(600),
    AI_PROVIDER_LIVE_SMOKE_TEST_ENABLED: environmentBoolean.default(false),
    AI_PROVIDER_USAGE_TRACKING_ENABLED: environmentBoolean.default(true),
    AI_PROVIDER_MAX_ACTIVE_IMAGE_JOBS: positiveInt(1, 32).default(2),
    AI_PROVIDER_MAX_ACTIVE_VIDEO_JOBS: positiveInt(1, 16).default(1),
    AI_PROVIDER_DAILY_COST_LIMIT: z.coerce.number().min(0).optional(),
    AI_PROVIDER_JOB_COST_LIMIT: z.coerce.number().min(0).optional(),
    AI_PROVIDER_MONTHLY_COST_LIMIT: z.coerce.number().min(0).optional(),
    CREATIVE_MAX_BRIEFS_PER_JOB: positiveInt(1, 50).default(20),
    CREATIVE_MAX_VARIANTS_PER_BRIEF: positiveInt(1, 10).default(4),
    CREATIVE_MAX_TOTAL_ASSETS_PER_JOB: positiveInt(1, 100).default(40),
    CREATIVE_MAX_IMAGE_BYTES: positiveInt(1_024, 104_857_600).default(52_428_800),
    CREATIVE_MAX_VIDEO_BYTES: positiveInt(1_024, 2_147_483_647).default(
      1_073_741_824,
    ),
    CREATIVE_MAX_VIDEO_DURATION_SECONDS: positiveInt(1, 3_600).default(600),
    CREATIVE_MAX_PROVIDER_DOWNLOAD_BYTES: positiveInt(
      1_024,
      2_147_483_647,
    ).default(1_073_741_824),
    CREATIVE_PROVIDER_DOWNLOAD_TIMEOUT_SECONDS: positiveInt(5, 1_800).default(
      300,
    ),
    CREATIVE_QUALITY_HIGH_MIN: z.coerce.number().min(0).max(1).default(0.88),
    CREATIVE_QUALITY_REVIEW_MIN: z.coerce.number().min(0).max(1).default(0.65),
    CREATIVE_BRAND_SCORE_MIN: z.coerce.number().min(0).max(1).default(0.85),
    CREATIVE_COMPLIANCE_SCORE_MIN: z.coerce.number().min(0).max(1).default(0.95),
    CREATIVE_TEXT_ACCURACY_MIN: z.coerce.number().min(0).max(1).default(0.92),
    CREATIVE_RIGHTS_CONFIDENCE_MIN: z.coerce.number().min(0).max(1).default(0.9),
    CREATIVE_AUTO_APPROVE_ENABLED: environmentBoolean.default(false),
  })
  .superRefine((environment, context) => {
    if (
      environment.APP_ENV === "production" &&
      environment.TEMPORARY_ADMIN_TOKEN_ENABLED &&
      !environment.ALLOW_TEMPORARY_ADMIN_TOKEN_IN_PRODUCTION
    ) {
      context.addIssue({
        code: "custom",
        path: ["TEMPORARY_ADMIN_TOKEN_ENABLED"],
        message:
          "temporary admin token authentication is forbidden in production unless ALLOW_TEMPORARY_ADMIN_TOKEN_IN_PRODUCTION=true",
      });
    }
    if (environment.CONFIDENCE_REVIEW_MIN > environment.CONFIDENCE_AUTO_COMPLETE_MIN) {
      context.addIssue({
        code: "custom",
        path: ["CONFIDENCE_REVIEW_MIN"],
        message: "CONFIDENCE_REVIEW_MIN must be <= CONFIDENCE_AUTO_COMPLETE_MIN",
      });
    }
    if (
      environment.SERVICE_MATCH_REVIEW_MIN > environment.SERVICE_MATCH_AUTO_APPROVE_MIN
    ) {
      context.addIssue({
        code: "custom",
        path: ["SERVICE_MATCH_REVIEW_MIN"],
        message:
          "SERVICE_MATCH_REVIEW_MIN must be <= SERVICE_MATCH_AUTO_APPROVE_MIN",
      });
    }
    if (
      environment.CAMPAIGN_QUALITY_REVIEW_MIN > environment.CAMPAIGN_QUALITY_HIGH_MIN
    ) {
      context.addIssue({
        code: "custom",
        path: ["CAMPAIGN_QUALITY_REVIEW_MIN"],
        message:
          "CAMPAIGN_QUALITY_REVIEW_MIN must be <= CAMPAIGN_QUALITY_HIGH_MIN",
      });
    }
    if (
      environment.CREATIVE_QUALITY_REVIEW_MIN > environment.CREATIVE_QUALITY_HIGH_MIN
    ) {
      context.addIssue({
        code: "custom",
        path: ["CREATIVE_QUALITY_REVIEW_MIN"],
        message:
          "CREATIVE_QUALITY_REVIEW_MIN must be <= CREATIVE_QUALITY_HIGH_MIN",
      });
    }
    if (environment.CREATIVE_AUTO_APPROVE_ENABLED) {
      context.addIssue({
        code: "custom",
        path: ["CREATIVE_AUTO_APPROVE_ENABLED"],
        message:
          "CREATIVE_AUTO_APPROVE_ENABLED must remain false in Prompt 5",
      });
    }
  });

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;
export type ApiEnvironment = z.infer<typeof apiEnvironmentSchema>;

export function parseEnvironment<TSchema extends z.ZodType>(
  schema: TSchema,
  source: Record<string, string | undefined>,
): z.output<TSchema> {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  return parsed.data;
}
