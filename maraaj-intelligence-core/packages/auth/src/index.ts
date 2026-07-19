
import * as argon2 from "argon2";
import { authenticator } from "otplib";
import { SignJWT, jwtVerify, importPKCS8, importSPKI, generateKeyPair, exportPKCS8, exportSPKI } from "jose";
import { randomBytes, createHash } from "node:crypto";
import type { EnvironmentName, Permission } from "@maraaj/types";

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export function validatePasswordPolicy(password: string): string[] {
  const errors: string[] = [];
  if (password.length < 12) errors.push("Password must be at least 12 characters");
  if (!/[A-Z]/.test(password)) errors.push("Password must include an uppercase letter");
  if (!/[a-z]/.test(password)) errors.push("Password must include a lowercase letter");
  if (!/[0-9]/.test(password)) errors.push("Password must include a number");
  if (!/[^A-Za-z0-9]/.test(password)) errors.push("Password must include a symbol");
  return errors;
}

export function generateRecoveryCodes(count = 10): string[] {
  return Array.from({ length: count }, () => randomBytes(5).toString("hex"));
}

export async function hashRecoveryCode(code: string): Promise<string> {
  return createHash("sha256").update(code.trim().toUpperCase()).digest("hex");
}

/** Progressive delay (ms) after N failed login attempts. */
export function progressiveLoginDelayMs(failedAttempts: number): number {
  if (failedAttempts <= 0) return 0;
  return Math.min(failedAttempts * 400, 4000);
}

export async function isPasswordInHistory(
  password: string,
  hashes: readonly string[],
): Promise<boolean> {
  for (const hash of hashes) {
    if (await verifyPassword(hash, password)) return true;
  }
  return false;
}

/** Consume a recovery code (SHA-256 hashed). Returns remaining hashes, or null. */
export async function consumeRecoveryCode(
  code: string,
  hashes: readonly string[],
): Promise<string[] | null> {
  const target = await hashRecoveryCode(code);
  const index = hashes.findIndex((h) => h === target);
  if (index === -1) return null;
  return hashes.filter((_, i) => i !== index);
}

export function setupTotp(label: string, issuer = "Maraaj Intelligence Core") {
  const secret = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(label, issuer, secret);
  return { secret, otpauth };
}

export function verifyTotp(token: string, secret: string): boolean {
  return authenticator.verify({ token, secret });
}

export interface AccessTokenClaims {
  iss: string;
  aud: string;
  sub: string;
  clientId: string;
  tenantId: string;
  projectId: string;
  scopes: string[];
  jti: string;
  environment: EnvironmentName;
}

export async function generateSigningKeys() {
  const { privateKey, publicKey } = await generateKeyPair("EdDSA", { extractable: true });
  return {
    privateKeyPem: await exportPKCS8(privateKey),
    publicKeyPem: await exportSPKI(publicKey),
  };
}

export async function signAccessToken(
  privateKeyPem: string,
  claims: Omit<AccessTokenClaims, "iss" | "aud"> & { iss: string; aud: string },
  ttlSeconds: number,
): Promise<string> {
  const key = await importPKCS8(privateKeyPem, "EdDSA");
  return new SignJWT({
    clientId: claims.clientId,
    tenantId: claims.tenantId,
    projectId: claims.projectId,
    scopes: claims.scopes,
    environment: claims.environment,
  })
    .setProtectedHeader({ alg: "EdDSA", typ: "JWT" })
    .setIssuer(claims.iss)
    .setAudience(claims.aud)
    .setSubject(claims.sub)
    .setJti(claims.jti)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(key);
}

export async function verifyAccessToken(
  publicKeyPem: string,
  token: string,
  opts: { issuer: string; audience: string },
) {
  const key = await importSPKI(publicKeyPem, "EdDSA");
  const { payload } = await jwtVerify(token, key, {
    issuer: opts.issuer,
    audience: opts.audience,
    algorithms: ["EdDSA"],
  });
  return payload;
}

export function hasScope(granted: string[], required: string | string[]): boolean {
  const need = Array.isArray(required) ? required : [required];
  return need.every((s) => granted.includes(s) || granted.includes("*"));
}

export function hasPermission(userPerms: string[], required: Permission | Permission[] | string): boolean {
  const need = Array.isArray(required) ? required : [required];
  if (userPerms.includes("*") || userPerms.includes("*:*")) return true;
  return need.every((p) => {
    if (userPerms.includes(p)) return true;
    const [resource] = p.split(/[.:]/);
    return (
      userPerms.includes(`${resource}.*`) ||
      userPerms.includes(`${resource}:*`) ||
      userPerms.includes(`${resource}.manage`)
    );
  });
}

export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
