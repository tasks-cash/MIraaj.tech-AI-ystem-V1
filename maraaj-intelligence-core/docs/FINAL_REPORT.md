# Maraaj Intelligence Core — Final Report

## 1. Project architecture

Greenfield pnpm + Turbo monorepo at `maraaj-intelligence-core/`. NestJS API gateway, Next.js admin/web, FastAPI AI service, BullMQ workers, MongoDB + Redis + MinIO. Multi-tenant: Tenant → Project → Environment → API Client.

## 2. Monorepo applications

| App | Role |
|-----|------|
| `apps/api` | NestJS API gateway, OAuth, RBAC, business modules |
| `apps/admin` | Console (`console.maraaj.tech`) |
| `apps/web` | Public SSR pages (`go.maraaj.tech`) |
| `apps/ai-service` | FastAPI OCR/classify (internal) |
| `apps/worker` | BullMQ processors |
| `apps/docs` | Docs pointer package |

## 3. Shared packages

`types`, `config`, `crypto`, `auth`, `database`, `validation`, `logging`, `cache`, `storage`, `queue`, `qr`, `social-card`, `api-client` (+ tasks-cash), `observability`, `testing`, `ui`

## 4. MongoDB collections

tenants, projects, users, sessions, apiClients, revokedTokens, categories, groups, posts, postVersions, assets, analyses, reviewTasks, trainingFeedback, aiProviders, socialTemplates, socialCards, qrCodes, visitorEvents, webhooks, webhookDeliveries, linkChecks, auditLogs, securityEvents, systemSettings, usageRecords, reports, modelVersions, encryptionKeyMetadata

## 5. Redis usage

Nonce replay, idempotency, page cache, jti revocation, rate-limit keys, BullMQ, IP-hash salt, provider health cache

## 6. Queue architecture

image-ingestion, image-analysis, ocr, moderation, social-card-generation, header-image-generation, qr-generation, destination-validation, publishing, webhook-delivery, analytics-aggregation, scheduled-recheck, dataset-export, audit-integrity

## 7–13. AI / review / training

FastAPI stages: OCR (Tesseract when available), heuristic classification, moderation flags, prompt-injection pattern detection. Worker runs analysis pipeline, routes low confidence to review, stores training feedback on approve/reject. Dataset export queued for AI managers.

## 14–16. Social / QR / tracking

Sharp/SVG social cards (OG, X, IG, headers, story, thumbnail). Local QR (png/svg) pointing to go domain. Privacy-aware visitor events (strict/balanced).

## 17–23. Security

OAuth2 client credentials (10m EdDSA JWT), Ed25519 request signing, nonce + timestamp, idempotency, Argon2id admin sessions + TOTP foundation, AES-256-GCM envelope encryption + KMS abstraction, optional mTLS registration fields, hash-chained audit logs, Security Center events, SSRF-safe link checks, signed webhooks.

## 24–32. Integrations & public pages

`@maraaj/api-client` / Tasks.cash helper. Aggregated `GET /api/v1/public/page/:publicCode` with Redis cache + invalidation. Next.js `cache()` shared by page + metadata.

## 33–36. Admin / RBAC / Security Center

Full sidebar routes wired to live APIs. Roles/permissions from `@maraaj/config`. Security + audit pages read real Mongo collections.

## 37–47. Verification results

| Check | Result |
|-------|--------|
| `pnpm typecheck` | Pass (36 tasks) |
| `pnpm lint` | Pass |
| `pnpm test` | Pass (crypto + API security/link-safety) |
| `pytest` (AI) | Pass (1 test) |
| `pnpm build` | Pass (web, admin, api, worker, packages) |
| Docker infra | mongo:27019, redis:6381, minio:9100/9101 healthy |
| Seed | Maraaj.tech tenant, Tasks.cash + Maraaj Main × 3 envs, categories, templates |
| Admin login | Works (`admin@maraaj.tech`) |
| API client create | Works (Ed25519 credentials once) |
| Health | `/health/live` + `/health/ready` OK |

## 48. Remaining production requirements

- Provision real `TOKEN_SIGNING_*` keys and store in secrets manager
- Production KMS (`ENCRYPTION_PROVIDER` ≠ local)
- Managed MongoDB Atlas + Redis + R2/S3
- TLS 1.3 + HSTS at edge (see `infrastructure/nginx/maraaj.conf`)
- Optional ClamAV, Prometheus, Cloudflare Zero Trust mTLS
- Rotate `LOCAL_MASTER_KEY` / never use in production
- Domain DNS for api/console/go/media/developers.maraaj.tech
- Provider API keys (Gemini, GCV, HF, Cloudflare) as needed

## Local ports (host conflict remapped)

| Service | Port |
|---------|------|
| Web | 3100 |
| Admin | 3101 |
| API | 4100 |
| AI | 8100 |
| Mongo | 27019 |
| Redis | 6381 |
| MinIO | 9100 / 9101 |
