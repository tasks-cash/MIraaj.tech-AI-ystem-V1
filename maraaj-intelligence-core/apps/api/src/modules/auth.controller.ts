
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import type { Request, Response } from "express";
import {
  hashPassword,
  verifyPassword,
  validatePasswordPolicy,
  setupTotp,
  verifyTotp,
  newSessionToken,
  hashToken,
  signAccessToken,
  verifyAccessToken,
  hasScope,
  hasPermission,
  generateRecoveryCodes,
  hashRecoveryCode,
  consumeRecoveryCode,
  isPasswordInHistory,
} from "@maraaj/auth";
import { syncSuperAdminPermissions, SUPER_ADMIN_ROLE } from "@maraaj/config";
import {
  User,
  Session,
  ApiClient,
  RevokedToken,
} from "@maraaj/database";
import { changePasswordSchema, loginSchema, twoFactorConfirmSchema } from "@maraaj/validation";
import { randomUUID } from "node:crypto";
import { getServices } from "../services/app-services";
import { success, failure } from "../common/response";
import { AppError } from "../common/errors";
import { writeAudit } from "../common/audit";
import { hashIp } from "../security/request-signing";
import { recordSecurityEvent } from "../common/security-events";
import { applyProgressiveDelay, consumeLoginRateLimit } from "../common/login-rate-limit";
import { issueCsrfToken } from "../common/csrf";
import { extractRequestMeta } from "../common/request-meta";

const GENERIC_LOGIN = "Invalid credentials";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const ONBOARDING_ALLOWLIST = new Set([
  "/api/v1/auth/logout",
  "/api/v1/auth/logout-all",
  "/api/v1/auth/change-password",
  "/api/v1/auth/2fa/setup",
  "/api/v1/auth/2fa/confirm",
  "/api/v1/auth/2fa/verify",
  "/api/v1/auth/sessions",
  "/api/v1/auth/csrf",
  "/api/v1/auth/me",
  "/api/v1/users/me",
]);

function publicUser(user: {
  _id: unknown;
  email: string;
  name: string;
  roles: string[];
  role?: string;
  permissions: string[];
  mustChangePassword?: boolean;
  mustEnrollTwoFactor?: boolean;
  totpEnabled?: boolean;
  emailVerified?: boolean;
  status?: string;
  projectAccess?: string[];
}) {
  return {
    id: String(user._id),
    email: user.email,
    name: user.name,
    roles: user.roles,
    role: user.role || (user.roles.includes(SUPER_ADMIN_ROLE) ? "super-admin" : user.roles[0]),
    permissions: user.permissions,
    mustChangePassword: Boolean(user.mustChangePassword),
    mustEnrollTwoFactor: Boolean(user.mustEnrollTwoFactor),
    totpEnabled: Boolean(user.totpEnabled),
    emailVerified: Boolean(user.emailVerified),
    status:
      user.status ??
      ((user as { active?: boolean }).active === false ? "disabled" : "active"),
    projectAccess: user.projectAccess ?? ["*"],
  };
}

@Controller("/api/v1")
export class AuthController {
  @Post("/oauth/token")
  async token(@Req() req: Request, @Res() res: Response) {
    const svc = getServices();
    let clientId = "";
    let grantType = "";
    clientId = String((req.body as { client_id?: string }).client_id ?? "");
    grantType = String((req.body as { grant_type?: string }).grant_type ?? "");
    if (grantType !== "client_credentials") {
      return res.status(400).json(failure("VALIDATION_ERROR", "Unsupported grant_type"));
    }
    const client = await ApiClient.findOne({ clientId, status: "active" });
    if (!client) {
      await recordSecurityEvent({
        type: "oauth_invalid_client",
        severity: "medium",
        message: "Unknown client credentials",
        clientId,
      });
      return res.status(401).json(failure("AUTH_INVALID_CREDENTIALS", "Invalid client credentials"));
    }
    const jti = randomUUID();
    const access_token = await signAccessToken(
      svc.tokenKeys.privateKeyPem,
      {
        iss: svc.env.OAUTH_ISSUER,
        aud: svc.env.OAUTH_AUDIENCE,
        sub: client.clientId,
        clientId: client.clientId,
        tenantId: String(client.tenantId),
        projectId: String(client.projectId),
        scopes: client.scopes,
        jti,
        environment: client.environment as "development" | "staging" | "production",
      },
      svc.env.ACCESS_TOKEN_TTL_SECONDS,
    );
    await writeAudit({
      tenantId: String(client.tenantId),
      projectId: String(client.projectId),
      actorType: "api_client",
      actorId: client.clientId,
      action: "oauth.token.issued",
      entityType: "apiClient",
      entityId: String(client._id),
    });
    return res.json(
      success({
        access_token,
        token_type: "Bearer",
        expires_in: svc.env.ACCESS_TOKEN_TTL_SECONDS,
        scope: client.scopes.join(" "),
      }),
    );
  }

  @Get("/.well-known/jwks.json")
  async jwks(@Res() res: Response) {
    const svc = getServices();
    return res.json(
      success({
        keys: [
          {
            kty: "OKP",
            crv: "Ed25519",
            alg: "EdDSA",
            use: "sig",
            kid: "maraaj-token-key",
            publicKeyPem: svc.tokenKeys.publicKeyPem,
          },
        ],
      }),
    );
  }

  @Get("/auth/csrf")
  async csrf(@Res() res: Response) {
    const svc = getServices();
    const token = issueCsrfToken(res, svc.env.SESSION_SECRET ?? "dev");
    return res.json(success({ csrfToken: token }));
  }

  @Post("/auth/login")
  async login(@Body() body: unknown, @Req() req: Request, @Res() res: Response) {
    const svc = getServices();
    const meta = extractRequestMeta(req);
    const rate = await consumeLoginRateLimit(svc.cache, meta.ip);
    if (!rate.allowed) {
      return res
        .status(429)
        .json(failure("RATE_LIMITED", "Too many login attempts. Try again shortly."));
    }

    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return res.status(400).json(failure("VALIDATION_ERROR", "Invalid login payload", parsed.error.issues));
    }

    const email = parsed.data.email.toLowerCase();
    const user = await User.findOne({ email });

    if (!user || !user.active || user.status === "disabled") {
      await applyProgressiveDelay(1);
      await writeAudit({
        actorType: "user",
        actorId: email,
        action: "auth.login.failed",
        entityType: "user",
        metadata: { reason: user ? "inactive" : "unknown-account", ip: meta.ip },
      });
      return res.status(401).json(failure("AUTH_INVALID_CREDENTIALS", GENERIC_LOGIN));
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await applyProgressiveDelay(user.failedLoginAttempts ?? 1);
      await writeAudit({
        tenantId: String(user.tenantId),
        actorType: "user",
        actorId: String(user._id),
        action: "auth.login.failed",
        entityType: "user",
        entityId: String(user._id),
        metadata: { reason: "locked" },
      });
      return res.status(401).json(failure("AUTH_INVALID_CREDENTIALS", GENERIC_LOGIN));
    }

    const ok = await verifyPassword(user.passwordHash, parsed.data.password);
    if (!ok) {
      user.failedLoginAttempts = (user.failedLoginAttempts ?? 0) + 1;
      if (user.failedLoginAttempts >= 5) {
        user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        await recordSecurityEvent({
          type: "account_lock",
          severity: "high",
          message: "Account locked after failed logins",
          userId: String(user._id),
        });
        await writeAudit({
          tenantId: String(user.tenantId),
          actorType: "user",
          actorId: String(user._id),
          action: "auth.account.locked",
          entityType: "user",
          entityId: String(user._id),
          metadata: { attempts: user.failedLoginAttempts },
        });
      }
      await user.save();
      await applyProgressiveDelay(user.failedLoginAttempts);
      await writeAudit({
        tenantId: String(user.tenantId),
        actorType: "user",
        actorId: String(user._id),
        action: "auth.login.failed",
        entityType: "user",
        entityId: String(user._id),
        metadata: { reason: "bad-password" },
      });
      return res.status(401).json(failure("AUTH_INVALID_CREDENTIALS", GENERIC_LOGIN));
    }

    if (user.totpEnabled) {
      if (!parsed.data.totp) {
        return res.status(401).json(failure("AUTH_2FA_REQUIRED", "Two-factor authentication required"));
      }
      let verified = false;
      const enc = user.totpSecretEnc as
        | {
            ciphertext?: string;
            wrappedDataKey?: string;
            nonce?: string;
            authTag?: string;
            keyVersion?: string;
            algorithm?: string;
            createdAt?: string;
          }
        | undefined;
      if (enc?.ciphertext && enc.wrappedDataKey) {
        const secret = (await svc.crypto.decrypt(enc as never)).toString("utf8");
        verified = verifyTotp(parsed.data.totp, secret);
      }
      if (!verified) {
        const remaining = await consumeRecoveryCode(
          parsed.data.totp,
          user.recoveryCodeHashes ?? [],
        );
        if (remaining) {
          verified = true;
          user.recoveryCodeHashes = remaining;
          await writeAudit({
            tenantId: String(user.tenantId),
            actorType: "user",
            actorId: String(user._id),
            action: "auth.2fa.recovery-code-used",
            entityType: "user",
            entityId: String(user._id),
            metadata: { remainingCodes: remaining.length },
          });
        }
      }
      if (!verified) {
        user.failedLoginAttempts = (user.failedLoginAttempts ?? 0) + 1;
        await user.save();
        await applyProgressiveDelay(user.failedLoginAttempts);
        return res.status(401).json(failure("AUTH_INVALID_CREDENTIALS", GENERIC_LOGIN));
      }
    }

    // Keep Super Admin permissions synchronized on every successful login.
    if (user.roles.includes(SUPER_ADMIN_ROLE)) {
      user.permissions = syncSuperAdminPermissions(user.permissions ?? []);
    }

    const previousIp = user.lastLoginIpHash;
    const previousUa = user.lastLoginUserAgent;
    const suspicious =
      Boolean(previousIp || previousUa) &&
      (hashIp(meta.ip, svc.env.SESSION_SECRET ?? "dev") !== previousIp ||
        meta.userAgent !== previousUa);

    user.failedLoginAttempts = 0;
    user.lockedUntil = undefined;
    user.lastLoginAt = new Date();
    user.lastLoginIpHash = hashIp(meta.ip, svc.env.SESSION_SECRET ?? "dev");
    user.lastLoginUserAgent = meta.userAgent;
    user.lastLoginDevice = meta.device;
    user.lastLoginLocation = meta.location;
    await user.save();

    await this.issueSessionCookie(res, user, meta);

    await writeAudit({
      tenantId: String(user.tenantId),
      actorType: "user",
      actorId: String(user._id),
      action: "auth.login.success",
      entityType: "user",
      entityId: String(user._id),
      metadata: { device: meta.device, location: meta.location },
    });
    if (suspicious) {
      await recordSecurityEvent({
        type: "suspicious_login",
        severity: "medium",
        message: "Login from a new device or network",
        userId: String(user._id),
      });
      await writeAudit({
        tenantId: String(user.tenantId),
        actorType: "user",
        actorId: String(user._id),
        action: "auth.login.suspicious",
        entityType: "user",
        entityId: String(user._id),
        metadata: { device: meta.device, location: meta.location },
      });
    }

    const csrfToken = issueCsrfToken(res, svc.env.SESSION_SECRET ?? "dev");
    return res.json(success({ user: publicUser(user), csrfToken }));
  }

  private async issueSessionCookie(
    res: Response,
    user: { _id: unknown; securityVersion?: number },
    meta: { userAgent: string; ip: string; device: string; location: string },
  ) {
    const svc = getServices();
    const token = newSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await Session.create({
      userId: user._id,
      tokenHash: hashToken(token),
      userAgent: meta.userAgent,
      ipHash: hashIp(meta.ip, svc.env.SESSION_SECRET ?? "dev"),
      device: meta.device,
      location: meta.location,
      securityVersion: user.securityVersion ?? 1,
      expiresAt,
      lastUsedAt: new Date(),
    });
    res.cookie("mic_session", token, {
      httpOnly: true,
      secure: svc.env.NODE_ENV === "production",
      sameSite: "strict",
      domain: svc.env.COOKIE_DOMAIN,
      expires: expiresAt,
      path: "/",
    });
  }

  @Post("/auth/logout")
  async logout(@Req() req: Request, @Res() res: Response) {
    const token = req.cookies?.mic_session as string | undefined;
    if (token) {
      await Session.updateOne({ tokenHash: hashToken(token) }, { $set: { revokedAt: new Date() } });
    }
    res.clearCookie("mic_session", { path: "/" });
    return res.json(success({ ok: true }));
  }

  @Post("/auth/logout-all")
  async logoutAll(@Req() req: Request, @Res() res: Response) {
    const user = await requireUser(req, { allowPendingSecurity: true });
    const result = await Session.updateMany(
      { userId: user._id, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
    user.securityVersion = (user.securityVersion ?? 1) + 1;
    await user.save();
    res.clearCookie("mic_session", { path: "/" });
    await writeAudit({
      tenantId: String(user.tenantId),
      actorType: "user",
      actorId: String(user._id),
      action: "auth.logout.all",
      entityType: "user",
      entityId: String(user._id),
      metadata: { sessionsRevoked: result.modifiedCount ?? 0 },
    });
    return res.json(success({ sessionsRevoked: result.modifiedCount ?? 0 }));
  }

  @Get("/auth/me")
  async me(@Req() req: Request, @Res() res: Response) {
    const user = await requireUser(req, { allowPendingSecurity: true });
    return res.json(success({ user: publicUser(user) }));
  }

  @Get("/auth/sessions")
  async sessions(@Req() req: Request, @Res() res: Response) {
    const user = await requireUser(req, { allowPendingSecurity: true });
    const currentHash = req.cookies?.mic_session
      ? hashToken(req.cookies.mic_session as string)
      : null;
    const sessions = await Session.find({
      userId: user._id,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    })
      .sort({ createdAt: -1 })
      .lean();
    return res.json(
      success(
        sessions.map((s) => ({
          id: String(s._id),
          userAgent: s.userAgent,
          device: s.device || "Unknown device",
          location: s.location || "Unknown",
          expiresAt: s.expiresAt,
          createdAt: (s as { createdAt?: Date }).createdAt,
          lastUsedAt: s.lastUsedAt,
          current: currentHash !== null && s.tokenHash === currentHash,
        })),
      ),
    );
  }

  @Delete("/auth/sessions/:id")
  async revokeSession(@Param("id") id: string, @Req() req: Request, @Res() res: Response) {
    const user = await requireUser(req, { allowPendingSecurity: true });
    await Session.updateOne({ _id: id, userId: user._id }, { $set: { revokedAt: new Date() } });
    await writeAudit({
      tenantId: String(user.tenantId),
      actorType: "user",
      actorId: String(user._id),
      action: "auth.session.revoked",
      entityType: "session",
      entityId: id,
    });
    return res.json(success({ ok: true }));
  }

  @Post("/auth/change-password")
  async changePassword(@Body() body: unknown, @Req() req: Request, @Res() res: Response) {
    const user = await requireUser(req, { allowPendingSecurity: true });
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return res.status(400).json(failure("VALIDATION_ERROR", "Invalid payload", parsed.error.issues));
    }

    const validCurrent = await verifyPassword(user.passwordHash, parsed.data.currentPassword);
    if (!validCurrent) {
      await writeAudit({
        tenantId: String(user.tenantId),
        actorType: "user",
        actorId: String(user._id),
        action: "auth.password-change.failed",
        entityType: "user",
        entityId: String(user._id),
        metadata: { reason: "bad-current-password" },
      });
      return res.status(400).json(failure("VALIDATION_ERROR", "Current password is incorrect."));
    }

    const policyErrors = validatePasswordPolicy(parsed.data.newPassword);
    if (policyErrors.length) {
      return res.status(400).json(failure("VALIDATION_ERROR", policyErrors.join(" ")));
    }
    if (await verifyPassword(user.passwordHash, parsed.data.newPassword)) {
      return res
        .status(400)
        .json(failure("VALIDATION_ERROR", "The new password must be different from the current password."));
    }
    if (await isPasswordInHistory(parsed.data.newPassword, user.passwordHistory ?? [])) {
      return res
        .status(400)
        .json(failure("VALIDATION_ERROR", "The new password was used recently. Choose a different one."));
    }

    user.passwordHistory = [user.passwordHash, ...(user.passwordHistory ?? [])].slice(0, 5);
    user.passwordHash = await hashPassword(parsed.data.newPassword);
    user.passwordChangedAt = new Date();
    user.mustChangePassword = false;
    user.securityVersion = (user.securityVersion ?? 1) + 1;
    await user.save();

    await Session.updateMany(
      { userId: user._id, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );

    const meta = extractRequestMeta(req);
    await this.issueSessionCookie(res, user, meta);
    const svc = getServices();
    const csrfToken = issueCsrfToken(res, svc.env.SESSION_SECRET ?? "dev");

    await writeAudit({
      tenantId: String(user.tenantId),
      actorType: "user",
      actorId: String(user._id),
      action: "auth.password.changed",
      entityType: "user",
      entityId: String(user._id),
      metadata: { device: meta.device },
    });
    await recordSecurityEvent({
      type: "password_changed",
      severity: "medium",
      message: "Password changed",
      userId: String(user._id),
    });

    return res.json(success({ user: publicUser(user), csrfToken }));
  }

  @Post("/auth/2fa/setup")
  async setup2fa(@Req() req: Request, @Res() res: Response) {
    const svc = getServices();
    const user = await requireUser(req, { allowPendingSecurity: true });
    if (user.mustChangePassword) {
      return res
        .status(403)
        .json(failure("PASSWORD_CHANGE_REQUIRED", "Change your password before enrolling two-factor authentication."));
    }
    const { secret, otpauth } = setupTotp(user.email);
    const enc = await svc.crypto.encrypt(secret);
    user.totpPendingSecretEnc = enc as never;
    await user.save();
    return res.json(success({ otpauth, secret, message: "Verify TOTP to enable 2FA" }));
  }

  @Post("/auth/2fa/confirm")
  async confirm2fa(@Body() body: unknown, @Req() req: Request, @Res() res: Response) {
    const svc = getServices();
    const user = await requireUser(req, { allowPendingSecurity: true });
    const parsed = twoFactorConfirmSchema.safeParse(body);
    if (!parsed.success) {
      return res.status(400).json(failure("VALIDATION_ERROR", "Invalid TOTP payload"));
    }
    const pending = user.totpPendingSecretEnc as never;
    if (!pending) {
      return res.status(400).json(failure("VALIDATION_ERROR", "Start two-factor setup first."));
    }
    const secret = (await svc.crypto.decrypt(pending)).toString("utf8");
    if (!verifyTotp(parsed.data.totp, secret)) {
      return res.status(401).json(failure("AUTH_INVALID_CREDENTIALS", "Invalid or expired verification code."));
    }

    const codes = generateRecoveryCodes();
    const hashes = await Promise.all(codes.map(hashRecoveryCode));
    user.totpSecretEnc = pending;
    user.totpPendingSecretEnc = undefined;
    user.totpEnabled = true;
    user.totpEnrolledAt = new Date();
    user.recoveryCodeHashes = hashes;
    user.mustEnrollTwoFactor = false;
    user.securityVersion = (user.securityVersion ?? 1) + 1;
    await user.save();

    await Session.updateMany(
      { userId: user._id, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );

    const meta = extractRequestMeta(req);
    await this.issueSessionCookie(res, user, meta);
    const csrfToken = issueCsrfToken(res, svc.env.SESSION_SECRET ?? "dev");

    await writeAudit({
      tenantId: String(user.tenantId),
      actorType: "user",
      actorId: String(user._id),
      action: "auth.2fa.enabled",
      entityType: "user",
      entityId: String(user._id),
    });
    await recordSecurityEvent({
      type: "2fa_enabled",
      severity: "medium",
      message: "Two-factor authentication enabled",
      userId: String(user._id),
    });

    // Recovery codes are returned once and never stored in plaintext.
    return res.json(success({ user: publicUser(user), csrfToken, recoveryCodes: codes }));
  }

  /** Backward-compatible alias for /auth/2fa/confirm. */
  @Post("/auth/2fa/verify")
  async verify2fa(@Body() body: { totp?: string }, @Req() req: Request, @Res() res: Response) {
    return this.confirm2fa(body, req, res);
  }

  @Post("/auth/refresh")
  async refresh(@Req() req: Request, @Res() res: Response) {
    const user = await requireUser(req, { allowPendingSecurity: true });
    const old = req.cookies?.mic_session as string | undefined;
    if (old) {
      await Session.updateOne({ tokenHash: hashToken(old) }, { $set: { revokedAt: new Date() } });
    }
    const meta = extractRequestMeta(req);
    await this.issueSessionCookie(res, user, meta);
    const svc = getServices();
    const csrfToken = issueCsrfToken(res, svc.env.SESSION_SECRET ?? "dev");
    return res.json(success({ ok: true, csrfToken, user: publicUser(user) }));
  }
}

export async function requireUser(
  req: Request,
  opts: { allowPendingSecurity?: boolean } = {},
) {
  const token = req.cookies?.mic_session as string | undefined;
  if (!token) throw new AppError("AUTH_INVALID_CREDENTIALS", "Not authenticated", 401);
  const session = await Session.findOne({
    tokenHash: hashToken(token),
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  });
  if (!session) throw new AppError("AUTH_INVALID_CREDENTIALS", "Not authenticated", 401);
  const user = await User.findById(session.userId);
  if (!user || !user.active || user.status === "disabled") {
    throw new AppError("AUTH_INVALID_CREDENTIALS", "Not authenticated", 401);
  }
  if ((session.securityVersion ?? 1) !== (user.securityVersion ?? 1)) {
    throw new AppError("TOKEN_REVOKED", "Session is no longer valid", 401);
  }

  if (!opts.allowPendingSecurity) {
    const path = req.path;
    const allowed =
      ONBOARDING_ALLOWLIST.has(path) ||
      [...ONBOARDING_ALLOWLIST].some((p) => path.startsWith(p + "/"));
    if (!allowed) {
      if (user.mustChangePassword) {
        throw new AppError(
          "PASSWORD_CHANGE_REQUIRED",
          "Password change required before accessing the dashboard.",
          403,
        );
      }
      if (user.mustEnrollTwoFactor) {
        throw new AppError(
          "TWO_FACTOR_ENROLLMENT_REQUIRED",
          "Two-factor authentication enrollment required before accessing the dashboard.",
          403,
        );
      }
    }
  }

  session.lastUsedAt = new Date();
  await session.save();
  return user;
}

export async function requirePermission(req: Request, permission: string) {
  const user = await requireUser(req);
  if (
    !hasPermission(user.permissions ?? [], permission) &&
    !user.roles.includes(SUPER_ADMIN_ROLE)
  ) {
    throw new AppError("FORBIDDEN", "Insufficient permissions", 403);
  }
  return user;
}

export async function requireBearer(req: Request): Promise<Record<string, unknown>> {
  const svc = getServices();
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new AppError("AUTH_INVALID_CREDENTIALS", "Missing bearer token", 401);
  }
  const token = header.slice(7);
  try {
    const payload = await verifyAccessToken(svc.tokenKeys.publicKeyPem, token, {
      issuer: svc.env.OAUTH_ISSUER,
      audience: svc.env.OAUTH_AUDIENCE,
    });
    const jti = String(payload.jti ?? "");
    if (jti) {
      const revoked = await svc.cache.getJson(`revoked-jti:${jti}`);
      const dbRevoked = await RevokedToken.findOne({ jti });
      if (revoked || dbRevoked) throw new AppError("TOKEN_REVOKED", "Token revoked", 401);
    }
    return payload as Record<string, unknown>;
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError("TOKEN_EXPIRED", "Token expired or invalid", 401);
  }
}

export async function requireMachineAuth(
  req: Request,
  neededScopes: string[] = [],
): Promise<{
  payload: Record<string, unknown>;
  signed: {
    client: unknown;
    scopes: string[];
    tenantId: string;
    projectId: string;
    environment: string;
    clientId: string;
  };
  idemKey: string | undefined;
}> {
  const svc = getServices();
  const payload = await requireBearer(req);
  const scopes = (payload.scopes as string[]) ?? [];
  if (neededScopes.length && !hasScope(scopes, neededScopes)) {
    throw new AppError("INSUFFICIENT_SCOPE", "Insufficient scope", 403);
  }
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
  const signed = await (await import("../security/request-signing")).verifySignedRequest({
    method: req.method,
    path: req.path,
    query: req.url.includes("?") ? req.url.split("?")[1]! : "",
    rawBody,
    headers: req.headers as Record<string, string | string[] | undefined>,
    cache: svc.cache,
    toleranceSeconds: svc.env.SIGNATURE_TIMESTAMP_TOLERANCE_SECONDS,
    tokenProjectId: String(payload.projectId ?? ""),
    tokenTenantId: String(payload.tenantId ?? ""),
    tokenClientId: String(payload.clientId ?? ""),
  });
  const idem = req.headers["idempotency-key"];
  const idemKey = Array.isArray(idem) ? idem[0] : idem;
  if (idemKey) {
    const key = svc.cache.idempotencyKey(signed.clientId, idemKey);
    const existing = await svc.cache.getJson<{ status: number; body: unknown }>(key);
    if (existing) {
      throw new IdempotentReplay(existing.status, existing.body);
    }
  }
  return { payload, signed, idemKey };
}

export class IdempotentReplay {
  constructor(
    public status: number,
    public body: unknown,
  ) {}
}

export { hashPassword, validatePasswordPolicy };
