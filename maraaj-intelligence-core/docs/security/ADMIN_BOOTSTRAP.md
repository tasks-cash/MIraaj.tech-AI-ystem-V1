# Super Admin Bootstrap

How the production owner account is created, repaired, and secured for
**Maraaj Intelligence Core**.

## Overview

```bash
pnpm admin:create                 # create or repair the owner account
pnpm admin:reset-password         # also reset the password + revoke all sessions
```

Implementation: `apps/api/src/commands/create-admin.command.ts`  
CLI entry: `apps/api/src/cli/admin-create.ts`  
Infrastructure wrapper: `infrastructure/scripts/create-admin.ts`

Credentials come exclusively from `BOOTSTRAP_ADMIN_*` environment variables.
They are **never** hardcoded in source, never committed, never printed to logs,
and never stored in plaintext (Argon2id only).

## Configuration

Set these in the untracked `.env` (local) or the hosting platform dashboard
(production). `.env.example` documents them without values.

| Variable | Purpose |
|----------|---------|
| `BOOTSTRAP_ADMIN_EMAIL` | Owner email (validated) |
| `BOOTSTRAP_ADMIN_PASSWORD` | Initial password (hashed with Argon2id, then dropped from memory) |
| `BOOTSTRAP_ADMIN_NAME` | Display name (default `Maraaj Owner`) |
| `BOOTSTRAP_ADMIN_TENANT` | Tenant name (default `Maraaj.tech`) |
| `BOOTSTRAP_ADMIN_FORCE_PASSWORD_CHANGE` | Require password change + 2FA enrollment on first login (default `true`) |

## What the command does

1. Validates email format and that a password is present when needed.
2. Connects to MongoDB.
3. Finds or creates the Maraaj.tech tenant (`slug: maraaj-tech`).
4. Ensures the Tasks.cash project exists (`slug: tasks-cash`) across environments.
5. Synchronizes Super Admin permissions via `syncSuperAdminPermissions()`
   (additive union of the full catalog + module wildcards — future permissions
   are picked up automatically).
6. **Create path:** one administrator with Argon2id hash, role `super-admin`,
   full permissions, `projectAccess: ["*", "tasks-cash"]`, `status: active`,
   `emailVerified: true`, `mustChangePassword` / `mustEnrollTwoFactor` set.
7. **Repair path:** never creates a duplicate; repairs role, permissions,
   tenant, project access, activation, and email verification. Preserves the
   existing password hash unless `--reset-password` is supplied.
8. **`--reset-password`:** re-hashes from env, archives the old hash into
   password history, sets first-login flags, increments `securityVersion`,
   revokes all sessions/refresh tokens, writes an audit event.
9. Deletes the plaintext password from `process.env` and local variables.
10. Prints a success report **without credentials**.

## First-login security flow

After the first successful login with the bootstrap credentials:

1. API flags `mustChangePassword`; dashboard routes return
   `403 PASSWORD_CHANGE_REQUIRED`. Admin UI redirects to
   `/security/change-password`.
2. New password must pass the strength policy and must not match the bootstrap
   password or recent history (Argon2id-verified).
3. Changing the password bumps `securityVersion` and revokes all sessions
   (including the bootstrap login), then issues a fresh session.
4. UI redirects to `/security/setup-2fa`. TOTP enrollment is mandatory
   (`403 TWO_FACTOR_ENROLLMENT_REQUIRED` otherwise).
5. Confirming one TOTP code enables 2FA, returns ten one-time recovery codes
   (shown once; only SHA-256 hashes stored), rotates the session again.
6. Dashboard unlocks only after both steps complete — enforced by
   `requireUser()` on the API, not only in the UI.

## Login security

- Argon2id password hashing
- Generic invalid-credentials response (no account enumeration)
- Redis-backed login rate limiting + progressive delay
- Temporary lock after repeated failures
- Failed / suspicious login audit + security events
- HttpOnly `mic_session` cookie (`SameSite=Strict`, `Secure` in production)
- Session rotation on refresh; `securityVersion` invalidates stale sessions
- Double-submit CSRF (`mic_csrf` + `x-csrf-token`) for cookie-authenticated mutations
- Session device list, per-session revoke, logout-current, logout-all
- Last-login date / device / approximate location
- Password-change and 2FA-change security notifications (events)

## Super Admin permissions

`syncSuperAdminPermissions()` grants every key in `PERMISSIONS` plus
`<module>.*` wildcards for:

projects, apiClients, posts, analysis, categories, groups, assets,
socialCards, qr, analytics, providers, models, training, webhooks,
integrations, users, roles, permissions, security, audit, settings,
systemHealth, publishing, encryption, sessions, notifications

New permissions added to `PERMISSIONS` in `@maraaj/types` are automatically
included on the next bootstrap run and on Super Admin login.

## Verification checklist

```bash
pnpm seed
pnpm admin:create
pnpm admin:create   # second run → outcome: "unchanged", still one user
```

In MongoDB:

```js
db.users.countDocuments({ email: "owner@tasks.cash" })  // 1
db.users.findOne({ email: "owner@tasks.cash" }).passwordHash  // $argon2id$...
```

Sign in at the admin console and confirm:
change-password → setup-2fa → dashboard.
