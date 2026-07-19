
import {
  buildCanonicalRequest,
  normalizePath,
  normalizeQuery,
  sha256Hex,
  verifyEd25519,
} from "@maraaj/crypto";
import { ApiClient } from "@maraaj/database";
import type { CacheService } from "@maraaj/cache";
import { AppError } from "../common/errors";
import { recordSecurityEvent } from "../common/security-events";
import { createHash } from "node:crypto";

export async function verifySignedRequest(opts: {
  method: string;
  path: string;
  query: string;
  rawBody: Buffer | string;
  headers: Record<string, string | string[] | undefined>;
  cache: CacheService;
  toleranceSeconds: number;
  tokenProjectId?: string;
  tokenTenantId?: string;
  tokenClientId?: string;
}) {
  const h = (name: string) => {
    const v = opts.headers[name] ?? opts.headers[name.toLowerCase()];
    return Array.isArray(v) ? v[0] : v;
  };

  const keyId = h("x-maraaj-key-id");
  const timestamp = h("x-maraaj-timestamp");
  const nonce = h("x-maraaj-nonce");
  const contentSha = h("x-maraaj-content-sha256");
  const signature = h("x-maraaj-signature");

  if (!keyId || !timestamp || !nonce || !contentSha || !signature) {
    await recordSecurityEvent({
      type: "invalid_signature",
      severity: "medium",
      message: "Missing signing headers",
    });
    throw new AppError("INVALID_SIGNATURE", "The request signature is invalid.", 401);
  }

  const client = await ApiClient.findOne({ keyId }).lean();
  if (!client) {
    await recordSecurityEvent({
      type: "unknown_key",
      severity: "high",
      message: "Unknown key id",
      metadata: { keyId },
    });
    throw new AppError("INVALID_SIGNATURE", "The request signature is invalid.", 401);
  }

  if (client.status === "revoked" || client.revokedAt) {
    await recordSecurityEvent({
      type: "revoked_key_usage",
      severity: "critical",
      message: "Revoked key used",
      clientId: client.clientId,
      tenantId: String(client.tenantId),
      projectId: String(client.projectId),
    });
    throw new AppError("INVALID_SIGNATURE", "The request signature is invalid.", 401);
  }

  if (client.expiresAt && new Date(client.expiresAt) < new Date()) {
    throw new AppError("INVALID_SIGNATURE", "The request signature is invalid.", 401);
  }

  const ts = Number(timestamp);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > opts.toleranceSeconds) {
    await recordSecurityEvent({
      type: "invalid_timestamp",
      severity: "medium",
      message: "Timestamp outside tolerance",
      clientId: client.clientId,
    });
    throw new AppError("SIGNATURE_TIMESTAMP_INVALID", "The request timestamp is invalid.", 401);
  }

  const bodyBuf = typeof opts.rawBody === "string" ? Buffer.from(opts.rawBody) : opts.rawBody;
  const computed = sha256Hex(bodyBuf);
  if (computed !== contentSha) {
    await recordSecurityEvent({
      type: "body_hash_mismatch",
      severity: "high",
      message: "Body hash mismatch",
      clientId: client.clientId,
    });
    throw new AppError("INVALID_SIGNATURE", "The request signature is invalid.", 401);
  }

  const nonceKey = opts.cache.nonceKey(client.clientId, nonce);
  const stored = await opts.cache.setNxEx(nonceKey, "1", opts.toleranceSeconds * 2);
  if (!stored) {
    await recordSecurityEvent({
      type: "nonce_reused",
      severity: "high",
      message: "Nonce reused",
      clientId: client.clientId,
    });
    throw new AppError("NONCE_REUSED", "The request nonce was already used.", 401);
  }

  const canonical = buildCanonicalRequest({
    method: opts.method,
    path: normalizePath(opts.path),
    query: normalizeQuery(opts.query),
    bodySha256: contentSha,
    timestamp,
    nonce,
    clientId: client.clientId,
  });

  const ok = verifyEd25519(client.publicKeyPem, canonical, signature);
  if (!ok) {
    await recordSecurityEvent({
      type: "invalid_signature",
      severity: "high",
      message: "Signature verification failed",
      clientId: client.clientId,
    });
    throw new AppError("INVALID_SIGNATURE", "The request signature is invalid.", 401);
  }

  if (opts.tokenClientId && opts.tokenClientId !== client.clientId) {
    throw new AppError("PROJECT_ACCESS_DENIED", "Token client mismatch.", 403);
  }
  if (opts.tokenProjectId && opts.tokenProjectId !== String(client.projectId)) {
    throw new AppError("PROJECT_ACCESS_DENIED", "Project access denied.", 403);
  }

  if (client.allowedIps?.length) {
    // IP allowlist checked by caller with request IP
  }

  await ApiClient.updateOne({ _id: client._id }, { $set: { lastUsedAt: new Date() } });

  return {
    client,
    scopes: client.scopes as string[],
    tenantId: String(client.tenantId),
    projectId: String(client.projectId),
    environment: client.environment as string,
    clientId: client.clientId as string,
  };
}

export function hashIp(ip: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}
