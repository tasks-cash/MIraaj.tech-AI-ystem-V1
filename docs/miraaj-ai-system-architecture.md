# Miraaj.tech AI System architecture

This document describes the repository as inspected and the Prompt 1 foundation
that was implemented. It does not invent features that are not present.

## 1. Current repository architecture

The root is a pnpm 9.15.9 workspace (`pnpm-workspace.yaml`: `apps/*`, `packages/*`).
Node engine: `>=22`. Package namespace: `@miraaj/*`.

The only previously implemented product surface was the public Next.js marketing
site. NestJS, Redis, BullMQ workers, admin UI, and AI analysis did not exist as
working root applications before Prompt 1.

`maraaj-intelligence-core/` is a disconnected nested monorepo using `@maraaj/*`.
It is not part of the root workspace and is not the source of truth.

## 2. Applications and packages discovered

### Applications

| Path | Status |
| --- | --- |
| `apps/web` | Real Next.js 16 / React 19 marketing site |
| `apps/api` | NestJS foundation added in Prompt 1 |
| `apps/ai-service` | FastAPI foundation added in Prompt 1 |
| `apps/admin` | Empty placeholder |
| `apps/worker` | Empty placeholder |

### Packages

| Path | Status |
| --- | --- |
| `packages/contracts` | Type-only domain contracts |
| `packages/config` | Brand, plan limits, legacy permissions |
| `packages/validation` | Zod schemas for contracts |
| `packages/ui` | Small UI helpers |
| `packages/tsconfig` | Shared TS configs |
| `packages/eslint-config` | Shared ESLint configs |
| `packages/shared-types` | Prompt 1 AI foundation types |
| `packages/shared-config` | Prompt 1 server/API env validation |
| `packages/shared-validation` | Internal request canonicalization |
| `packages/shared-logging` | Structured redacted logging |
| `packages/ai-core` | Minimal package stub |
| `packages/tasks-integration-sdk` | Empty |
| `packages/tracking-sdk` | Empty |

## 3. Location of the public website

`apps/web`

- Country/locale routes: `apps/web/src/app/[country]/[locale]`
- Market proxy: `apps/web/src/proxy.ts`
- Dev port: **3200**

Homepage and unrelated public marketing pages were not redesigned in Prompt 1.

## 4. Location of the NestJS backend

`apps/api`

- Bootstrap: `apps/api/src/main.ts`
- AI module: `apps/api/src/modules/ai/`
- Dev/prod port: **4200**

## 5. Current MongoDB integration

- Local Docker service: `mongo` in `docker-compose.yml` (host `27020` → `27017`)
- NestJS connects through `InfrastructureService` using `MONGODB_URI`
- No production AI domain Mongoose models yet
- The Python AI service does **not** connect to MongoDB in Prompt 1; NestJS remains
  the intended persistence layer

## 6. Current Redis integration

- Local Docker service: `redis` in `docker-compose.yml` (host `6383` → `6379`)
- NestJS uses `ioredis` for readiness checks
- FastAPI performs a bounded Redis `PING` whenever `REDIS_URL` is configured
- FastAPI reports `configured`, `required`, `healthy`, `latencyMs`, and
  `safeError`; `AI_SERVICE_REDIS_REQUIRED=true` makes an unhealthy Redis return
  HTTP 503 from `/ready`
- Redis is an accelerator / future queue backend, not the source of truth
- No application cache keys for AI analysis yet

## 7. Current BullMQ integration

Not implemented in the root repository.

Future queue names are documented only as placeholders in
`packages/shared-types` (`FUTURE_AI_QUEUE_NAMES`). They are **not operational**.

## 8. Authentication and RBAC architecture

No full user authentication, administrator identity, sessions, or production
RBAC exists in the root application. The disconnected
`maraaj-intelligence-core/` prototype is not an authentication source for the
root workspace.

The current controlled-administration foundation therefore retains:

1. NestJS ↔ FastAPI HMAC internal service authentication
2. Temporary admin bearer token (`ADMIN_API_TOKEN`) protecting
   `GET /api/admin/ai/system-status`
3. Explicit backend enforcement of the `ai.systemStatus.read` permission
4. A per-instance limit of 30 status requests per minute per client

The token comparison is constant-time and token fields are redacted from
structured logs. `TEMPORARY_ADMIN_TOKEN_ENABLED=true` is intended only for
development and controlled internal administration. Production startup fails
closed unless the operator deliberately sets
`ALLOW_TEMPORARY_ADMIN_TOKEN_IN_PRODUCTION=true`.

TODO before enabling a public admin UI: replace the temporary token guard with
the real authenticated administrator identity/session guard, map persisted
roles to `ai.systemStatus.read`, retain the independent permission guard, and
use a distributed rate limiter when the API runs multiple replicas.

## 9. Current `/work` architecture

Virtual marketing route under `[country]/[locale]/[...slug]` when slug is `work`.
Data comes from static concept portfolio entries in `apps/web/src/data/site.ts`.
There is no database-backed business directory yet.

## 10. Current service-catalog architecture

Static catalog in `apps/web/src/data/site.ts` (`services` array).
No MongoDB-backed editable service catalog.

## 11. Current media-storage architecture

No production media service existed. Prompt 1 adds MinIO locally and validates S3
environment variables for NestJS. Upload signing and media records are deferred.

## 12. Existing reusable shared modules

- Market configuration and RTL/LTR routing in `apps/web`
- Brand assets and CSP headers
- `packages/contracts`, `packages/validation`, `packages/config`
- Shared TS/ESLint presets
- Mongo Docker pattern (extended, not duplicated)

## 13. Missing components required for the AI foundation (before Prompt 1)

- Private Python AI service
- NestJS AI health/status module
- Internal service authentication
- Shared AI foundation types/config/logging
- Redis readiness
- Validated AI environment variables
- Docker wiring for AI service

## 14. Final architecture implemented during this phase

Development topology:

```text
Browser → apps/web:3200 → apps/api:4200
                              │ HMAC-signed internal HTTP
                              └→ ai-service:8200
Host loopback only: MongoDB:27020 / Redis:6383 / MinIO:9200-9201
```

Docker publishes FastAPI and local infrastructure ports on host loopback only.
Containers use the private Compose service address
`http://ai-service:8200`. Non-Docker FastAPI development defaults to
`127.0.0.1`; Compose deliberately overrides the container bind address to
`0.0.0.0` inside its isolated network.

Compose does not inject the complete root `.env` into every service. The web
container receives only browser-safe URLs and development flags. NestJS and
FastAPI receive explicit least-privilege variable lists; `ADMIN_API_TOKEN`,
MongoDB, S3, and encryption credentials are not passed to the web or FastAPI
containers unless that service actually consumes them.

Production topology:

```text
Internet → platform edge/firewall → apps/web and apps/api
                                      │ private service network only
                                      └→ apps/ai-service:8200
Managed MongoDB / Redis / object storage
```

NestJS owns Mongo persistence going forward. Python is private and called only by
NestJS for AI work in later phases.

## 15. Selected ports

| Component | Host port |
| --- | ---: |
| Next.js web | 3200 |
| NestJS API | 4200 |
| FastAPI AI | 8200 |
| MongoDB | 27020 |
| Redis | 6383 |
| MinIO API / console | 9200 / 9201 |

## 16. Internal service communication flow

1. NestJS hashes the exact request body with SHA-256
2. NestJS builds canonical request text
3. It signs with HMAC-SHA256 using `AI_SERVICE_INTERNAL_SECRET`
4. It sends identity, timestamp, correlation, body hash, and signature headers
5. FastAPI verifies the service allowlist, clock-skew window, body hash, and
   signature using constant-time comparison
6. Mutating methods require an idempotency key; safe methods may omit it
7. When an idempotency key is supplied, FastAPI rejects a duplicate key within
   the replay window using a bounded per-process cache
8. NestJS logs request ID, correlation ID, duration, route, and status with
   secret redaction

Canonical serialization is UTF-8 text with newline-separated fields in this
exact order:

```text
UPPERCASE_HTTP_METHOD
CANONICAL_ROUTE_PATH
SERVICE_ID
UNIX_TIMESTAMP_SECONDS
REQUEST_ID
CORRELATION_ID
IDEMPOTENCY_KEY_OR_EMPTY
LOWERCASE_SHA256_BODY_HEX
```

The canonical route contains the path plus the raw query string when present;
scheme and authority are excluded. The SHA-256 of an empty body is signed
normally. Both timestamps older than and
timestamps farther in the future than `AI_SERVICE_REPLAY_WINDOW_SECONDS` are
rejected. Duplicate signed headers are rejected. NestJS and Python tests share
an exact pinned HMAC test vector so cross-language canonicalization drift fails
the test suite.

The replay cache is process-local foundation protection. A shared atomic
idempotency store is required before multi-replica analysis mutation endpoints
are introduced.

## 17. Internal authentication strategy

Headers:

- `X-Miraaj-Service`
- `X-Miraaj-Timestamp`
- `X-Miraaj-Request-Id`
- `X-Miraaj-Correlation-Id`
- `X-Miraaj-Signature`
- `X-Miraaj-Content-Sha256`
- `Idempotency-Key`

All `/v1/*` routes require internal authentication. Health endpoints remain
unsigned so container/platform probes can call them, but in production they
must be reachable only through the private service network or an infrastructure
health-check policy. FastAPI must not receive a public route, public domain, or
internet-facing load balancer. Network policy/firewall rules must allow port
8200 only from NestJS and authorized health-check infrastructure.

Admin status endpoint uses `Authorization: Bearer <ADMIN_API_TOKEN>`.

Never use `NEXT_PUBLIC_AI_SERVICE_SECRET` or `NEXT_PUBLIC_GEMINI_API_KEY`.

## 18. Environment variables

Required for API / shared foundation:

- `APP_ENV`
- `AI_SERVICE_URL`, `AI_SERVICE_HOST`, `AI_SERVICE_PORT`
- `AI_SERVICE_INTERNAL_SECRET`, `AI_SERVICE_ID`
- `AI_SERVICE_REQUEST_TIMEOUT_MS`, `AI_SERVICE_REPLAY_WINDOW_SECONDS`
- `AI_SERVICE_REDIS_REQUIRED`, `AI_SERVICE_DEPENDENCY_TIMEOUT_MS` (FastAPI)
- `AI_SERVICE_VERSION`
- `TEMPORARY_ADMIN_TOKEN_ENABLED`
- `ALLOW_TEMPORARY_ADMIN_TOKEN_IN_PRODUCTION`
- `ADMIN_API_TOKEN` (temporary mode only)
- `MONGODB_URI`, `REDIS_URL`
- S3 variables, encryption key variables, logging

See `.env.example` and `apps/ai-service/.env.example`.

`AI_SERVICE_ID` is the calling internal service identity (`miraaj-api`) included
in signatures. FastAPI's own response service name remains
`miraaj-ai-service`; `AI_SERVICE_ALLOWED_IDS` controls accepted callers.

The NestJS API loads the repository root `.env` (and optional `apps/api/.env`)
via Node `process.loadEnvFile` before Zod validation. Existing process environment
values are not overwritten. Missing required values fail startup with a clear
validation message.

## 19. Development commands

```bash
corepack enable
corepack prepare pnpm@9.15.9 --activate
cp .env.example .env
pnpm install
pnpm ai:install
pnpm dev:infra
pnpm dev:all
```

## 20. Production commands

```bash
pnpm build
pnpm --filter @miraaj/api start
pnpm --filter @miraaj/ai-service start
pnpm --filter @miraaj/web start
```

Use platform-managed MongoDB/Redis/S3 and private networking for FastAPI.
Do not assign FastAPI a public domain. Bind it to a private service interface,
apply platform network policy/firewall rules, and allow only NestJS and
infrastructure probes. The production API refuses temporary admin-token mode
unless the explicit secure override is present.

## 21. Health-check commands

```bash
pnpm ai:health
curl http://localhost:4200/health
curl http://localhost:4200/ready
curl -H "Authorization: Bearer $ADMIN_API_TOKEN" \
  http://localhost:4200/api/admin/ai/system-status
```

## 22. Test commands

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm ai:test
pnpm build
```

## 23. Known limitations

- This workspace snapshot contains no `.git` directory; ignore rules are present,
  but `git status`, `git diff --check`, and tracked/untracked state cannot be
  verified until repository metadata is restored
- No full admin UI or user auth/RBAC yet
- Public admin UI must remain disabled while `ADMIN_API_TOKEN` is the only
  administrator credential
- Status rate limiting and HMAC idempotency replay state are per-process, not
  distributed across replicas
- Foundation idempotency currently rejects duplicates rather than replaying a
  cached result; Prompt 2 mutation contracts must define durable idempotent
  response semantics before safe retries are enabled
- No OCR/Gemini/media analysis
- No BullMQ workers or AI jobs
- `/work` is still static marketing content
- `ADMIN_API_TOKEN` is temporary controlled-administration access; production
  requires an explicit override and migration to real RBAC
- Host Tesseract/OpenCV/Gemini are intentionally not part of Prompt 1

## 24. Exact prerequisites and requirements remaining for PROMPT 2

Foundation prerequisites:

- Keep FastAPI private and provide production secrets through platform settings
- Decide whether Redis is required in the target deployment and set
  `AI_SERVICE_REDIS_REQUIRED` accordingly
- Use a shared atomic replay/idempotency store before horizontally scaling
  signed mutation endpoints
- Implement real administrator authentication/RBAC before exposing any public
  admin UI; preserve `ai.systemStatus.read` enforcement

Prompt 2 may then add its explicitly approved analysis contracts and persistence.
OCR, provider integration, analysis jobs, workers, campaign features, referrals,
commissions, and publishing are not implemented in this repository state.
