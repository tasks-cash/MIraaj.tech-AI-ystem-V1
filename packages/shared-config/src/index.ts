import { z } from "zod";

const appEnvironmentSchema = z.enum(["development", "test", "staging", "production"]);
const nonEmptySecret = z.string().min(32, "must contain at least 32 characters");
const optionalHttpUrl = z.union([z.literal(""), z.url({ protocol: /^https?$/ })]);
const environmentBoolean = z
  .union([z.boolean(), z.enum(["true", "false"])])
  .transform((value) => value === true || value === "true");

export const AI_PERMISSIONS = {
  SYSTEM_STATUS_READ: "ai.systemStatus.read",
} as const;

export const serverEnvironmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ENV: appEnvironmentSchema.default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  MONGODB_URI: z.string().min(1),
  REDIS_URL: z.string().min(1),
  S3_ENDPOINT: optionalHttpUrl,
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
