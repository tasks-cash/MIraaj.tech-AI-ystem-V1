/**
 * Secure Super Admin bootstrap.
 *
 *   pnpm admin:create                   create or repair the owner account
 *   pnpm admin:create --reset-password  also reset the password from env
 *                                       and revoke all active sessions
 *
 * Credentials come exclusively from BOOTSTRAP_ADMIN_* environment variables.
 * The plaintext password is never printed and never stored.
 */

import {
  connectMongo,
  disconnectMongo,
  Tenant,
  Project,
  User,
  Session,
} from "@maraaj/database";
import {
  SUPER_ADMIN_ROLE,
  SUPER_ADMIN_ROLE_SLUG,
  syncSuperAdminPermissions,
} from "@maraaj/config";
import { hashPassword } from "@maraaj/auth";
import { initServices } from "../services/app-services";
import { writeAudit } from "../common/audit";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TASKS_CASH_SLUG = "tasks-cash";

export interface BootstrapReport {
  outcome: "created" | "repaired" | "unchanged";
  email: string;
  tenant: string;
  role: string;
  permissionsCount: number;
  projectAccess: string[];
  passwordReset: boolean;
  sessionsRevoked: number;
  mustChangePassword: boolean;
  mustEnrollTwoFactor: boolean;
  repairs: string[];
}

function readBootstrapEnv() {
  const email = (process.env.BOOTSTRAP_ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? "";
  const name = (process.env.BOOTSTRAP_ADMIN_NAME ?? "").trim() || "Maraaj Owner";
  const tenantName = (process.env.BOOTSTRAP_ADMIN_TENANT ?? "").trim() || "Maraaj.tech";
  const forcePasswordChange =
    (process.env.BOOTSTRAP_ADMIN_FORCE_PASSWORD_CHANGE ?? "true").toLowerCase() !== "false";
  return { email, password, name, tenantName, forcePasswordChange };
}

export async function runAdminBootstrap(options: {
  resetPassword: boolean;
}): Promise<BootstrapReport> {
  let { email, password, name, tenantName, forcePasswordChange } = readBootstrapEnv();

  if (!email || !EMAIL_REGEX.test(email)) {
    throw new Error("BOOTSTRAP_ADMIN_EMAIL is missing or not a valid email address.");
  }

  const svc = await initServices();
  await connectMongo(svc.env.MONGODB_URI);

  try {
    let tenant = await Tenant.findOne({
      $or: [{ name: tenantName }, { slug: "maraaj-tech" }],
    });
    if (!tenant) {
      tenant = await Tenant.create({
        name: tenantName,
        slug: "maraaj-tech",
        active: true,
      });
    }

    // Ensure Tasks.cash project exists across environments so access is meaningful.
    for (const environment of ["development", "staging", "production"] as const) {
      const exists = await Project.findOne({
        tenantId: tenant._id,
        slug: TASKS_CASH_SLUG,
        environment,
      });
      if (!exists) {
        await Project.create({
          tenantId: tenant._id,
          name: "Tasks.cash",
          slug: TASKS_CASH_SLUG,
          environment,
          enabledModules: ["analysis", "social", "qr", "tracking", "webhooks"],
          active: true,
          privacyMode: "balanced",
        });
      }
    }

    const permissions = syncSuperAdminPermissions();
    const repairs: string[] = [];
    let outcome: BootstrapReport["outcome"];
    let passwordReset = false;
    let sessionsRevoked = 0;

    let user = await User.findOne({ email });

    if (!user) {
      if (!password) {
        throw new Error(
          "BOOTSTRAP_ADMIN_PASSWORD is required to create the administrator account.",
        );
      }
      const passwordHash = await hashPassword(password);
      user = await User.create({
        tenantId: tenant._id,
        email,
        name,
        passwordHash,
        roles: [SUPER_ADMIN_ROLE],
        role: SUPER_ADMIN_ROLE_SLUG,
        permissions,
        projectAccess: ["*", TASKS_CASH_SLUG],
        status: "active",
        active: true,
        emailVerified: true,
        mustChangePassword: forcePasswordChange,
        mustEnrollTwoFactor: forcePasswordChange,
        securityVersion: 1,
        passwordChangedAt: new Date(),
      });
      outcome = "created";
      passwordReset = true;
    } else {
      if (String(user.tenantId) !== String(tenant._id)) {
        user.tenantId = tenant._id;
        repairs.push("tenant");
      }
      if (!user.roles.includes(SUPER_ADMIN_ROLE)) {
        user.roles = [...new Set([...(user.roles ?? []), SUPER_ADMIN_ROLE])];
        repairs.push("role");
      }
      if (user.role !== SUPER_ADMIN_ROLE_SLUG) {
        user.role = SUPER_ADMIN_ROLE_SLUG;
        repairs.push("roleSlug");
      }

      const synced = syncSuperAdminPermissions(user.permissions ?? []);
      const currentSorted = [...(user.permissions ?? [])].sort();
      const permissionsChanged =
        synced.length !== currentSorted.length || synced.some((p, i) => p !== currentSorted[i]);
      if (permissionsChanged) {
        user.permissions = synced;
        repairs.push("permissions");
      }

      const access = new Set(user.projectAccess ?? []);
      if (!access.has("*") || !access.has(TASKS_CASH_SLUG)) {
        access.add("*");
        access.add(TASKS_CASH_SLUG);
        user.projectAccess = [...access];
        repairs.push("projectAccess");
      }

      if (!user.active || user.status !== "active") {
        user.active = true;
        user.status = "active";
        user.lockedUntil = undefined;
        user.failedLoginAttempts = 0;
        repairs.push("activation");
      }
      if (!user.emailVerified) {
        user.emailVerified = true;
        repairs.push("emailVerified");
      }
      if (name && user.name !== name) {
        user.name = name;
        repairs.push("name");
      }

      if (options.resetPassword) {
        if (!password) {
          throw new Error("BOOTSTRAP_ADMIN_PASSWORD is required when using --reset-password.");
        }
        user.passwordHistory = [user.passwordHash, ...(user.passwordHistory ?? [])].slice(0, 5);
        user.passwordHash = await hashPassword(password);
        user.passwordChangedAt = new Date();
        user.mustChangePassword = true;
        user.mustEnrollTwoFactor = true;
        user.securityVersion = (user.securityVersion ?? 1) + 1;
        passwordReset = true;
        repairs.push("passwordReset");

        const revoked = await Session.updateMany(
          { userId: user._id, revokedAt: null },
          { $set: { revokedAt: new Date() } },
        );
        sessionsRevoked = revoked.modifiedCount ?? 0;
      }

      await user.save();
      outcome = repairs.length > 0 ? "repaired" : "unchanged";
    }

    // Drop plaintext references as early as practical.
    password = "";
    delete process.env.BOOTSTRAP_ADMIN_PASSWORD;

    await writeAudit({
      tenantId: String(tenant._id),
      actorType: "system",
      actorId: "bootstrap",
      action:
        outcome === "created" ? "admin.bootstrap.created" : "admin.bootstrap.repaired",
      entityType: "user",
      entityId: String(user._id),
      metadata: {
        email,
        tenant: tenantName,
        role: SUPER_ADMIN_ROLE_SLUG,
        outcome,
        repairs,
        passwordReset,
        sessionsRevoked,
      },
    });

    if (passwordReset && outcome !== "created") {
      // Notification service placeholder — dispatch when SMTP is configured.
      console.warn(
        `Password reset performed for ${email}; ${sessionsRevoked} session(s) revoked.`,
      );
    }

    return {
      outcome,
      email,
      tenant: tenantName,
      role: SUPER_ADMIN_ROLE_SLUG,
      permissionsCount: (user.permissions ?? []).length,
      projectAccess: user.projectAccess ?? [],
      passwordReset,
      sessionsRevoked,
      mustChangePassword: Boolean(user.mustChangePassword),
      mustEnrollTwoFactor: Boolean(user.mustEnrollTwoFactor),
      repairs,
    };
  } finally {
    await disconnectMongo();
  }
}

