
# Maraaj Intelligence Core (MIC)

Private, centralized AI platform owned by **Maraaj.tech**.

## Stack

- Apps: NestJS API, Next.js admin/web, FastAPI AI service, BullMQ worker
- Data: MongoDB, Redis, MinIO (S3-compatible)
- Security: OAuth2 client credentials, Ed25519 request signing, AES-256-GCM envelope encryption, RBAC, audit hash chain

## Local development

```bash
corepack enable
corepack prepare pnpm@9.15.9 --activate
cp .env.example .env
pnpm install
pnpm dev:infra
pnpm seed
# Set BOOTSTRAP_ADMIN_* in .env (see .env.example), then:
pnpm admin:create
pnpm admin:create                 # idempotent — safe to re-run
pnpm admin:reset-password         # optional: rotate password + revoke sessions
pnpm dev
```

On first login the owner must change the password and enroll TOTP 2FA before
the dashboard unlocks. Details: [docs/security/ADMIN_BOOTSTRAP.md](docs/security/ADMIN_BOOTSTRAP.md).

Services:

| Service | URL |
|---------|-----|
| Public web | http://localhost:3100 |
| Admin console | http://localhost:3101 |
| API + Swagger | http://localhost:4100/docs |
| AI service | http://localhost:8100/health |
| MinIO console | http://localhost:9101 |

## Domains (production)

Configure via environment variables only:

- `console.maraaj.tech` → admin
- `api.maraaj.tech` → API
- `go.maraaj.tech` → public pages
- `media.maraaj.tech` → object storage
- `developers.maraaj.tech` → docs

AI and workers remain internal.

## Security note

This system implements strong industry-standard controls. No system is unhackable.
