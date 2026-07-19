import { z } from "zod";

export const BRAND = {
  name: "MIRAAJ.TECH",
  productName: "MIRAAJ.TECH AI System",
  supportEmail: "support@miraaj.tech",
} as const;

export const PERMISSIONS = {
  WORKSPACE_READ: "workspace:read",
  WORKSPACE_MANAGE: "workspace:manage",
  BRAND_READ: "brand:read",
  BRAND_MANAGE: "brand:manage",
  CAMPAIGN_READ: "campaign:read",
  CAMPAIGN_MANAGE: "campaign:manage",
  PROOF_REVIEW: "proof:review",
  REWARD_READ: "reward:read",
  REWARD_SETTLE: "reward:settle",
  LEAD_READ: "lead:read",
  ANALYTICS_READ: "analytics:read",
  MEMBER_MANAGE: "member:manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
export type Plan = keyof typeof PLAN_LIMITS;

export const PLAN_LIMITS = {
  free: { workspaces: 1, brands: 1, activeCampaigns: 1, aiRequestsPerMonth: 50, members: 2 },
  starter: { workspaces: 3, brands: 5, activeCampaigns: 10, aiRequestsPerMonth: 1_000, members: 10 },
  growth: { workspaces: 10, brands: 25, activeCampaigns: 100, aiRequestsPerMonth: 10_000, members: 50 },
  enterprise: { workspaces: -1, brands: -1, activeCampaigns: -1, aiRequestsPerMonth: -1, members: -1 },
} as const;

const booleanFromString = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

export const sharedEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  MONGODB_URI: z.string().min(1),
  REDIS_URL: z.string().url(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  ENABLE_MINIO: booleanFromString.default(false),
});

export type SharedEnv = z.infer<typeof sharedEnvSchema>;

export function parseEnv<T extends z.ZodType>(schema: T, env: Record<string, string | undefined>): z.output<T> {
  const result = schema.safeParse(env);
  if (!result.success) {
    throw new Error(`Invalid environment configuration: ${z.prettifyError(result.error)}`);
  }
  return result.data;
}

export function extendEnv<T extends z.ZodRawShape>(shape: T) {
  return sharedEnvSchema.extend(shape);
}
