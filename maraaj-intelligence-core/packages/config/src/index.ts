import { z } from "zod";
import { PERMISSIONS, PERMISSION_MODULES, ROLES } from "@maraaj/types";

export const SUPER_ADMIN_ROLE = "super_admin";
export const SUPER_ADMIN_ROLE_SLUG = "super-admin";

/**
 * Safe Super Admin permission synchronization.
 * Returns the union of every catalog permission plus module wildcards.
 * Additive-only: never removes grants the account already holds.
 */
export function syncSuperAdminPermissions(existing: readonly string[] = []): string[] {
  const next = new Set<string>([...PERMISSIONS, ...existing]);
  for (const module of PERMISSION_MODULES) next.add(`${module}.*`);
  next.add("*");
  return [...next].sort();
}

export const BRAND = {
  company: "Maraaj.tech",
  product: "Maraaj Intelligence Core",
  shortName: "MIC",
  supportEmail: "support@maraaj.tech",
} as const;

export const DEFAULT_CATEGORIES = [
  "Entertainment", "Artificial Intelligence", "Dentistry", "Technology",
  "Education", "Gaming", "E-commerce", "Healthcare", "Marketing", "Business",
  "Sports", "News", "Software Development", "Finance", "Other",
] as const;

export const ROLE_PERMISSIONS: Record<string, readonly string[]> = {
  super_admin: PERMISSIONS,
  security_admin: [
    "security.read", "security.manage", "audit.read", "apiClients.read",
    "apiClients.rotate", "apiClients.revoke", "users.manage", "roles.manage",
  ],
  platform_admin: [
    "projects.read", "projects.create", "projects.update", "settings.manage",
    "users.manage", "categories.manage", "groups.manage",
  ],
  ai_manager: [
    "analysis.read", "analysis.run", "analysis.override", "providers.manage",
    "training.export", "posts.read",
  ],
  content_manager: [
    "posts.read", "posts.create", "posts.update", "posts.publish", "posts.delete",
    "categories.manage", "groups.manage", "socialCards.manage", "assets.manage",
  ],
  reviewer: ["posts.read", "analysis.read", "analysis.review", "assets.manage"],
  analytics_manager: ["analytics.read", "posts.read", "qr.manage"],
  integration_manager: [
    "apiClients.read", "apiClients.create", "webhooks.manage", "projects.read",
  ],
  support_agent: ["posts.read", "users.manage", "analytics.read"],
  auditor: ["audit.read", "security.read", "analytics.read"],
  viewer: ["projects.read", "posts.read", "analytics.read"],
};

export { PERMISSIONS, PERMISSION_MODULES, ROLES };

const bool = z
  .union([z.boolean(), z.enum(["true", "false"])])
  .transform((v) => (typeof v === "boolean" ? v : v === "true"));

export const sharedEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ENV: z.enum(["development", "staging", "production"]).default("development"),
  MONGODB_URI: z.string().min(1),
  REDIS_URL: z.string().min(1),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  API_URL: z.string().url().default("http://localhost:4000"),
  ADMIN_URL: z.string().url().default("http://localhost:3001"),
  PUBLIC_WEB_URL: z.string().url().default("http://localhost:3000"),
  AI_SERVICE_URL: z.string().url().default("http://localhost:8000"),
  MEDIA_BASE_URL: z.string().url().default("http://localhost:9000/maraaj"),
  OAUTH_ISSUER: z.string().default("https://api.maraaj.tech"),
  OAUTH_AUDIENCE: z.string().default("maraaj-api"),
  TOKEN_SIGNING_PRIVATE_KEY: z.string().optional(),
  TOKEN_SIGNING_PUBLIC_KEY: z.string().optional(),
  SESSION_SECRET: z.string().min(32).optional(),
  COOKIE_DOMAIN: z.string().optional(),
  ENCRYPTION_PROVIDER: z
    .enum(["local", "env", "aws_kms", "gcp_kms", "azure_kv", "vault"])
    .default("local"),
  LOCAL_MASTER_KEY: z.string().optional(),
  KMS_KEY_ID: z.string().optional(),
  STORAGE_PROVIDER: z.enum(["minio", "s3", "r2"]).default("minio"),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().default("maraaj"),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  MINIO_ENDPOINT: z.string().default("http://localhost:9000"),
  CLAMAV_HOST: z.string().optional(),
  SIGNATURE_TIMESTAMP_TOLERANCE_SECONDS: z.coerce.number().default(120),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().default(600),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  ENABLE_MTLS: bool.default(false),
});

export type SharedEnv = z.infer<typeof sharedEnvSchema>;

export function parseEnv<T extends z.ZodType>(
  schema: T,
  env: Record<string, string | undefined> = process.env,
): z.output<T> {
  const result = schema.safeParse(env);
  if (!result.success) {
    const msg = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment configuration: ${msg}`);
  }
  const data = result.data as SharedEnv & z.output<T>;
  if (
    (data.ENCRYPTION_PROVIDER === "local" || data.ENCRYPTION_PROVIDER === "env") &&
    data.NODE_ENV === "development"
  ) {
    console.warn(
      "[MIC] WARNING: Using development encryption keys. Never use LOCAL_MASTER_KEY in production.",
    );
  }
  return result.data;
}

export function extendEnv<T extends z.ZodRawShape>(shape: T) {
  return sharedEnvSchema.extend(shape);
}
