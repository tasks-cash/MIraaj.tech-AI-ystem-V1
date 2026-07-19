export type EnvironmentName = "development" | "staging" | "production";

export type ActorType = "user" | "api_client" | "system" | "worker";

export const ROLES = [
  "super_admin",
  "security_admin",
  "platform_admin",
  "ai_manager",
  "content_manager",
  "reviewer",
  "analytics_manager",
  "integration_manager",
  "support_agent",
  "auditor",
  "viewer",
] as const;
export type RoleName = (typeof ROLES)[number];

/**
 * Full platform permission catalog. Super Admin is always granted every key
 * here (and any future keys added to this array) via syncSuperAdminPermissions.
 */
export const PERMISSIONS = [
  "projects.read", "projects.create", "projects.update", "projects.delete", "projects.manage",
  "apiClients.read", "apiClients.create", "apiClients.rotate", "apiClients.revoke", "apiClients.manage",
  "posts.read", "posts.create", "posts.update", "posts.publish", "posts.delete", "posts.manage",
  "analysis.read", "analysis.run", "analysis.review", "analysis.override", "analysis.manage",
  "categories.manage", "groups.manage", "assets.manage", "socialCards.manage", "qr.manage",
  "analytics.read", "analytics.manage",
  "providers.manage", "models.manage", "training.export", "training.manage",
  "webhooks.manage", "integrations.manage",
  "users.manage", "roles.manage", "permissions.manage",
  "security.read", "security.manage", "audit.read", "audit.manage",
  "settings.manage", "systemHealth.read", "systemHealth.manage",
  "publishing.manage", "encryption.manage", "sessions.manage", "notifications.manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/** Module wildcards used in Super Admin sync / reporting. */
export const PERMISSION_MODULES = [
  "projects", "apiClients", "posts", "analysis", "categories", "groups", "assets",
  "socialCards", "qr", "analytics", "providers", "models", "training", "webhooks",
  "integrations", "users", "roles", "permissions", "security", "audit", "settings",
  "systemHealth", "publishing", "encryption", "sessions", "notifications",
] as const;

export const POST_STATUSES = [
  "draft", "uploaded", "queued", "analyzing", "needs_review", "approved",
  "rejected", "scheduled", "publishing", "published", "failed", "expired", "archived",
] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

export const ERROR_CODES = [
  "AUTH_INVALID_CREDENTIALS", "AUTH_2FA_REQUIRED", "TOKEN_EXPIRED", "TOKEN_REVOKED",
  "PASSWORD_CHANGE_REQUIRED", "TWO_FACTOR_ENROLLMENT_REQUIRED", "CSRF_INVALID",
  "INVALID_SIGNATURE", "SIGNATURE_TIMESTAMP_INVALID", "NONCE_REUSED", "IDEMPOTENCY_CONFLICT",
  "INSUFFICIENT_SCOPE", "PROJECT_ACCESS_DENIED", "RATE_LIMITED",
  "UPLOAD_INVALID_TYPE", "UPLOAD_TOO_LARGE", "UPLOAD_MALWARE_DETECTED", "ASSET_NOT_FOUND",
  "ANALYSIS_ALREADY_RUNNING", "ANALYSIS_FAILED", "PROVIDER_UNAVAILABLE", "LOW_CONFIDENCE",
  "REVIEW_REQUIRED", "POST_NOT_PUBLISHABLE", "DESTINATION_UNSAFE", "DESTINATION_UNAVAILABLE",
  "QR_EXPIRED", "WEBHOOK_SIGNATURE_INVALID", "WEBHOOK_DELIVERY_FAILED",
  "ENCRYPTION_FAILED", "SECURITY_POLICY_VIOLATION", "NOT_FOUND", "VALIDATION_ERROR",
  "INTERNAL_ERROR", "FORBIDDEN",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta: { requestId: string; timestamp: string };
}

export interface ApiErrorBody {
  success: false;
  error: { code: ErrorCode; message: string; details: unknown[] };
  meta: { requestId: string; timestamp: string };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiErrorBody;

export interface TenantScoped {
  tenantId: string;
  projectId: string;
  environment: EnvironmentName;
}

export interface EncryptedBlob {
  algorithm: "AES-256-GCM";
  keyVersion: string;
  nonce: string;
  authTag: string;
  ciphertext: string;
  createdAt: string;
}
