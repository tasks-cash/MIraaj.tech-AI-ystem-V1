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
