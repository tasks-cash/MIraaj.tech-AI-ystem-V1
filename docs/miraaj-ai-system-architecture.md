# Miraaj.tech AI System architecture

Prompt 6 extends the backend with approved distribution templates/copy, unique assignments and local assets, private proof intake, BullMQ verification, immutable review, and a signed persistent Tasks.cash outbox. Screenshot evidence is not absolute proof; private communities require review; Miraaj.tech never settles rewards.

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
| `packages/shared-types` | Prompt 1 AI foundation types + global language registry |
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

Default Docker runtime is **API-only** (no public web container):

```text
Operator / platform → apps/api:4200
                         │ HMAC-signed internal HTTP
                         └→ ai-service:8200
Host loopback only: MongoDB:27020 / Redis:6383 / MinIO:9200-9201
BullMQ workers run inside NestJS (media, intelligence, campaigns)
```

`docker compose up -d` starts `api`, `ai-service`, `mongo`, `redis`, `minio`
(and `minio-init`). The legacy `web` service is behind Compose profile `web`
and starts only with `docker compose --profile web up -d web`. Do not treat
`apps/web` as part of the production AI-system runtime.

Docker publishes FastAPI and local infrastructure ports on host loopback only.
Containers use the private Compose service address
`http://ai-service:8200`. Non-Docker FastAPI development defaults to
`127.0.0.1`; Compose deliberately overrides the container bind address to
`0.0.0.0` inside its isolated network.

Compose does not inject the complete root `.env` into every service. When the
optional web profile is enabled, that container receives only browser-safe URLs
and development flags. NestJS and FastAPI receive explicit least-privilege
variable lists; `ADMIN_API_TOKEN`, MongoDB, S3, and encryption credentials are
not passed to the web or FastAPI containers unless that service actually
consumes them.

Production topology:

```text
Internet → platform edge/firewall → apps/api
                                      │ private service network only
                                      └→ apps/ai-service:8200
Managed MongoDB / Redis / object storage
```

NestJS owns Mongo persistence going forward. Python is private and called only by
NestJS for AI work in later phases.

## 15. Selected ports

| Component | Host port |
| --- | ---: |
| NestJS API | 4200 |
| FastAPI AI | 8200 |
| MongoDB | 27020 |
| Redis | 6383 |
| MinIO API / console | 9200 / 9201 |
| Legacy Next.js web (Compose profile `web` only) | 3200 |

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

Docker (default backend runtime):

```bash
cp .env.example .env
docker compose up -d --build
```

Optional legacy web container:

```bash
docker compose --profile web up -d web
```

Host-side packages (API + AI only):

```bash
corepack enable
corepack prepare pnpm@9.15.9 --activate
cp .env.example .env
pnpm install
pnpm ai:install
pnpm dev:infra
pnpm --filter @miraaj/api --filter @miraaj/ai-service --parallel dev
```

## 20. Production commands

```bash
pnpm build
pnpm --filter @miraaj/api start
pnpm --filter @miraaj/ai-service start
```

Use platform-managed MongoDB/Redis/S3 and private networking for FastAPI.
Do not assign FastAPI a public domain. Bind it to a private service interface,
apply platform network policy/firewall rules, and allow only NestJS and
infrastructure probes. The production API refuses temporary admin-token mode
unless the explicit secure override is present. Do not deploy the legacy
`apps/web` surface as part of this AI-system runtime.

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
- Global multilingual registry types exist; runtime detection, OCR packs,
  translation providers, glossaries, and campaign variants are not live yet

## 24. Exact prerequisites and requirements remaining for PROMPT 2

Foundation prerequisites:

- Keep FastAPI private and provide production secrets through platform settings
- Decide whether Redis is required in the target deployment and set
  `AI_SERVICE_REDIS_REQUIRED` accordingly
- Use a shared atomic replay/idempotency store before horizontally scaling
  signed mutation endpoints
- Implement real administrator authentication/RBAC before exposing any public
  admin UI; preserve `ai.systemStatus.read` enforcement

Prompt 2 multilingual foundations (required, not optional):

- Consume the shared language registry in
  `packages/shared-types/src/language-registry.ts`
- Language detection, script detection, and RTL/LTR metadata
- Configurable multilingual OCR language packs (do not run every pack per job)
- Gemini multilingual structured analysis using BCP 47 codes
- Source-language, locale, and country as separate fields
- Confidence per language and human-review rules
- Shared multilingual types for analysis persistence
- Tests covering Tier 1 languages plus representative Tier 2 / mixed-script cases

Prompt 2 must not permanently limit analysis models or database schemas to
Arabic, English, and French only.

Prompt 2 does **not** implement the complete campaign-translation /
transcreation engine. That belongs to the Campaign Generation phase.

OCR, provider integration, analysis jobs, workers, campaign features, referrals,
commissions, and publishing are not implemented in this repository state.

## 25. Global multilingual requirement

Miraaj.tech AI System is a global multilingual platform. It must not be designed
as an Arabic/English/French-only product. Country and language are always
separate fields. Use ISO language codes and BCP 47 locale tags
(examples: `ar`, `ar-DZ`, `en-US`, `fr-FR`, `pt-BR`, `zh-CN`, `zh-TW`).

### 25.1 Language support tiers

| Tier | Meaning | Examples |
| --- | --- | --- |
| 1 | Fully verified | Arabic, English, French, Spanish, German, Portuguese, Italian, Dutch, Turkish, Russian |
| 2 | Extended global | Chinese Simplified/Traditional, Japanese, Korean, Hindi, Urdu, Persian, Hebrew, and other registered Tier 2 languages |
| 3 | Provider-dependent | Any additional provider-supported language, marked with quality warnings and mandatory review for public campaigns |

Do not claim equal quality across tiers.

### 25.2 Language registry

The single shared registry lives in
`packages/shared-types/src/language-registry.ts`.

Applications must not scatter independent language arrays. The registry defines
capability flags, direction, script, OCR pack hints, fallback locales,
confidence thresholds, and review requirements.

Future admin permissions (declared, not yet enforced by identity RBAC):

- `ai.languages.read` / `ai.languages.manage`
- `ai.translation.read` / `generate` / `review` / `approve`
- `ai.glossary.read` / `manage` / `publish`

### 25.3 Scripts, RTL and LTR

Supported writing systems include Latin, Arabic, Cyrillic, Greek, Hebrew,
Devanagari, Bengali, Chinese, Japanese, Korean, and Thai.

Direction:

- RTL: Arabic, Urdu, Persian, Hebrew, and other registered RTL languages
- LTR: all registered LTR languages
- Mixed content: preserve bidirectional rendering; use `dir="rtl"|"ltr"|"auto"`
  appropriately; isolate URLs, phones, prices, codes, hashtags, and usernames

### 25.4 Language detection

Future Language Detection Engine inputs: user selection, metadata, OCR text,
captions, posts, documents, country hints, and campaign configuration.

Outputs include primary language/locale, scored language list, script,
direction, mixed-language flag, and review requirement. Do not infer language
solely from IP or country. Administrators may correct detections; corrections
become AI feedback.

Selection priority:

1. Administrator campaign configuration
2. Explicit user selection
3. Reliable content detection
4. Source metadata
5. Market default
6. Safe fallback

### 25.5 Multilingual OCR architecture

Default Tesseract packs: `ara eng fra spa deu por ita nld tur rus`.

Additional packs are optional and must be installed deliberately. Configure
bundles such as:

```text
OCR_LANGUAGES_DEFAULT=ara+eng+fra
OCR_LANGUAGES_INSTALLED=ara,eng,fra,spa,deu,por,ita,nld,tur,rus
OCR_MAX_LANGUAGES_PER_JOB=4
```

OCR flow: detect scripts → apply country/user hints → select the smallest
relevant language set → OCR → compare confidence → optional retry → store
original and normalized text separately → return confidence → mark unsupported
packs honestly. Never run dozens of OCR languages on every image.

### 25.6 Translation architecture

Translation is provider-neutral. Gemini must not be the only translation path.
Future providers may include Gemini, OpenAI-compatible APIs, Google Cloud
Translation, DeepL, Azure Translator, local models, and human workflows.

Translation inputs include source/target language and locale, country, sector,
platform, brand terminology, protected terms, tone, length, formality, glossary,
and compliance rules. Outputs include translated text, detected source language,
provider/model, confidence, warnings, protected-term report, review
recommendation, timing, and cost.

Brand and terminology glossaries must preserve Miraaj.tech, Tasks.cash, product
names, domains, and approved professional terms. Sector glossaries (healthcare,
legal, finance, etc.) prevent harmful literal translations.

Shared contracts in
`packages/shared-types/src/multilingual-contracts.ts` define:

- `TranslationProvider` (provider-neutral interface)
- `TranslationGlossary`
- `CampaignLanguageVariant`
- `SpeechToTextProvider` / `TextToSpeechProvider`
- OCR bundle defaults and unsupported-language failure state

Campaign language variants and market-specific transcreation belong to the
Campaign Generation phase, not Prompt 2. Prompt 2 only ensures analysis and
persistence schemas can carry multilingual fields.

### 25.7 Locale and market adaptation

Adapt tone, formality, CTA, date/time/number/currency formatting, units, phone
and address order, legal disclaimers, and business terminology by locale and
country together. Examples:

- French in Algeria ≠ French in France
- English in the UK ≠ English in the United States
- Portuguese in Brazil ≠ Portuguese in Portugal
- Arabic in Algeria ≠ Arabic in Saudi Arabia
- Chinese Simplified ≠ Chinese Traditional

### 25.8 Fallback and human review

When a language is unavailable: do not silently switch languages; return an
unsupported state; offer configured fallback; allow human translation; preserve
original content; record the failure; never auto-publish.

Require human review for Tier 3 languages, low confidence, ambiguous mixed
language, regulated terminology, untested providers, unresolved glossary terms,
suspicious script mixing, and significant source/target market mismatch.

### 25.9 Future speech architecture

Speech-to-text, text-to-speech, captions, dubbing, and voice-language detection
are future phases. Shared types already reserve provider-neutral placeholders.
Do not clone a real person’s voice without authorization. Do not implement
expensive speech processing in Prompt 2 unless explicitly required.

### 25.10 Current repository state

Implemented now:

- Central language registry covering all Tier 1 and Tier 2 language codes
- BCP 47 helpers, RTL/LTR helpers, and selection-priority constants
- `createdAt` / `updatedAt` on `LanguageDefinition`
- Provider-neutral translation, glossary, campaign-variant, and speech contracts
- OCR pack catalogs and reserved OCR bundle environment keys
- Multilingual content field shapes for future analysis/persistence schemas
- Future multilingual AI permissions in `@miraaj/shared-config`
- Architecture documentation of the global requirement

Not implemented yet (later prompts / live runtime outside shared contracts):

- Live translation providers
- Glossary persistence and admin UI
- Campaign language variants / transcreation
- Speech providers

## 26. Prompt 2 — multilingual media ingestion and analysis

Prompt 2 adds the production backend foundation for secure media upload,
validation, OCR, vision analysis, confidence scoring, and human review.
It does **not** add campaign generation, service matching, public upload UI,
speech, or translation engines.

### 26.1 Ownership boundaries

| Owner | Responsibilities |
| --- | --- |
| NestJS `apps/api` | Upload sessions, MinIO coordination, Mongo models, BullMQ queues/workers, job orchestration, analysis/review persistence, admin read/write endpoints, audit events, permissions |
| FastAPI `apps/ai-service` | Binary inspection, normalization support, OCR, script/language detection, vision adapters (Gemini first), internal HMAC processing endpoints |
| MinIO | Private originals and normalized derivatives only |
| MongoDB | Upload sessions, media assets, jobs, attempts, results, prompt versions, reviews, feedback |
| Redis | BullMQ, short-lived idempotency, rate limits, worker coordination |

FastAPI does **not** connect to MongoDB. Provider API keys exist only in the
AI service runtime. NestJS never sends Mongo/S3 admin credentials to FastAPI.

### 26.2 End-to-end pipeline

Authenticated administrator → create upload session → presigned private upload →
completion verifies object → validate binary (signature, decode, limits) →
SHA-256 / duplicate detection → sanitize + normalize → store private objects →
Mongo media record → analysis job → BullMQ worker → OCR language bundle → OCR →
optional vision provider → schema validation → merge evidence → confidence →
auto-complete or `awaiting_review` → immutable attempt + current result →
protected admin read/review endpoints.

### 26.3 Architectural decisions

1. **Single private bucket with path prefixes** — retain `S3_BUCKET=miraaj-media`
   with `media/original|normalized|ocr|previews/...` keys (non-guessable). Avoids
   breaking existing MinIO init while keeping objects private.
2. **Media transfer to FastAPI** — NestJS issues short-lived object-specific
   signed GET URLs; FastAPI downloads with host allowlist, no redirects, size/
   timeout bounds (SSRF-safe). No base64 JSON bodies for media bytes.
3. **HMAC paths** — protect `/v1/*` and `/internal/v1/*` with the existing
   canonical signature scheme (service ID, timestamp, request/correlation IDs,
   idempotency for mutations, body SHA-256, replay cache).
4. **Queues** — `miraaj.ai.media.validate`, `miraaj.ai.media.analyze`,
   `miraaj.ai.media.dead-letter` with named jobs; atomic Mongo status transitions;
   stale-job reconciliation against BullMQ ownership.
5. **Temporary admin token** — until real RBAC, a valid temporary admin bearer
   receives the full Prompt 2 AI permission set (still fail-closed in production
   unless explicitly allowed).
6. **Provider neutrality** — OCR and vision use Protocol/adapter interfaces;
   Gemini is the first vision adapter; disabled provider supports OCR-only paths.
7. **Prompt versioning** — active `media.business-context-analysis` prompt is
   seeded in Mongo and referenced by ID/checksum on every result.
8. **Malware scanning** — interface reserved, disabled, not claimed active.

### 26.4 Supported media (Prompt 2)

Enabled: JPEG, PNG, WebP, PDF (strict page/size limits). Rejected: executables,
archives, SVG/HTML/JS, video/audio, animated GIF, encrypted/password PDFs,
unknown binaries. Capabilities live in `MEDIA_CAPABILITY_REGISTRY`
(`packages/shared-types`).

### 26.5 Admin API surface (no public upload)

- `POST/GET /api/admin/ai/media/upload-sessions...`
- `GET /api/admin/ai/media/:mediaId`
- `POST/GET /api/admin/ai/analysis/jobs...`
- `GET /api/admin/ai/analysis/results/:resultId`
- Review: `review` / `approve` / `reject`; job `retry` / `cancel`

Permissions: `ai.media.*`, `ai.analysis.*`, `ai.prompts.*`, plus existing
`ai.systemStatus.read` and language/translation permissions.

### 26.6 Internal FastAPI surface

- `POST /internal/v1/media/inspect`
- `POST /internal/v1/media/ocr`
- `POST /internal/v1/media/analyze`
- `GET /internal/v1/providers/status`
- `GET /internal/v1/ocr/status`

### 26.7 Confidence and human review

Deterministic Confidence Engine combines media validation, OCR, script/language,
vision schema, business/audience, and content-purpose scores. Thresholds:
`CONFIDENCE_AUTO_COMPLETE_MIN`, `CONFIDENCE_REVIEW_MIN`, `CONFIDENCE_LOW_BELOW`.
Mandatory review for medical/legal/financial, missing OCR packs, Tier 3 /
untested locales, audience/business ambiguity, provider conflicts, etc.

### 26.8 Explicitly out of scope for Prompt 2 (Prompt 3+)

Campaign generation, social publishing, Tasks.cash / referral / QR tracking,
landing pages, speech/TTS/video/audio analysis, full translation engine, public
AI chat, public upload UI, admin dashboards, billing. Service matching and
business profiles belong to Prompt 3.

## 27. Prompt 3 — business intelligence and service matching

Prompt 3 transforms Prompt 2 analysis evidence into structured business
profiles and ranked Miraaj.tech service recommendations. It does **not**
generate campaigns, publish to social media, or integrate Tasks.cash.

### 27.1 Ownership

| Owner | Role |
| --- | --- |
| NestJS | Catalog persistence, versioning, deterministic matching, BI jobs, recommendations, review, admin APIs |
| FastAPI | Optional business-reasoning suggestions only (disabled provider works offline) |
| MongoDB | Catalog, policies, profiles, jobs, attempts, recommendation sets, reviews, feedback |
| Redis | BullMQ `miraaj.ai.intelligence` (+ DLQ) |

NestJS matching is the **final authority**. Providers cannot activate catalog
items, bypass exclusions, or approve payment claims.

### 27.2 Pipeline

Usable Prompt 2 result → intelligence job → evidence load → optional reasoning →
business profile → active catalog + matching policy → eligibility/exclusions →
deterministic scores → bundles + phases → review or complete → immutable attempt
+ recommendation set.

### 27.3 Critical audience rule

Business-related imagery does **not** imply the viewer is a decision-maker.
Patient/student/consumer/parent/public groups must not automatically receive
B2B management-system recommendations. Professional groups with decision-maker
evidence may be `eligible_b2b`.

### 27.4 Catalog and compliance

- Versioned individual services (not category-only).
- Only `active` services auto-recommended.
- Payment recommendations include EN/AR/FR compliance disclaimers; prohibited
  claims (no KYC, guaranteed approval, etc.) are blocked.
- Regulated domains (medical, legal, financial, education/minors, etc.) require
  human review.

### 27.5 Matching scores and penalties

Deterministic NestJS scoring uses a versioned matching policy. Default weights
(sum to 1.0) emphasize `needFit` (0.14), `businessTypeFit` (0.16), and
`audienceFit` (0.12); `decisionMakerFit` and `professionalContextFit` gate
B2B-only services against consumer contexts.

**Score breakdown dimensions** (all persisted on each match attempt):

| Dimension | Role |
| --- | --- |
| `businessTypeFit` / `industryFit` | Vertical and industry alignment |
| `organizationFit` | Organization model alignment |
| `audienceFit` | Supported professional audience |
| `decisionMakerFit` | Decision-maker evidence vs policy minimum |
| `professionalContextFit` | Professional vs consumer group context |
| `needFit` / `painPointFit` / `objectiveFit` | Declared needs and objectives overlap |
| `digitalMaturityFit` / `businessStageFit` | Down-weights phase ≥ 3 items for `none`/`basic` maturity or pre-launch stages |
| `marketFit` / `languageFit` | Country availability and locale support |
| `channelFit` / `integrationFit` | Channel and integration readiness |
| `urgencyFit` / `securityFit` | Urgency signals and security sensitivity |
| `paymentReadinessFit` / `automationReadinessFit` | Operational readiness for payments and automation |
| `capabilityAvailabilityFit` / `prerequisiteFit` | Capability and prerequisite state |
| `complianceFit` | Regulated-domain and compliance alignment |

**Penalties** (subtracted from the weighted score):

| Penalty | Typical trigger |
| --- | --- |
| `consumerAudiencePenalty` (1.0) | Hard exclusion: B2B-only service + patient/student/consumer audience |
| `audienceAmbiguityPenalty` | Audience not in service list and not professional |
| `businessTypeAmbiguityPenalty` | Business type mismatch with low confidence |
| `contradictionPenalty` | Conflicting business vs audience evidence |
| `unsupportedMarketPenalty` | Service unavailable in profile country when known |
| `unavailableCapabilityPenalty` / `missingPrerequisitePenalty` | Blocked or prerequisite-gated services |
| `regulatedDomainPenalty` | Regulated vertical flagged for human review |
| `providerDependencyPenalty` | Payment integrations depending on licensed third parties |
| `lowEvidencePenalty` / `duplicateRecommendationPenalty` / `incompatibleServicePenalty` | Quality and deduplication guards |

Service states: `recommended`, `recommended_with_prerequisites`, `optional`,
`future_phase`, `blocked`, `excluded`, `review_required`, `unavailable`.
Hard exclusions apply for inactive services, unsupported markets, and B2B-only
services against consumer/patient/student/guest audiences without decision-maker
evidence. Scores are reproducible from matching-policy version, catalog version,
profile revision, and source analysis revision.

### 27.6 Payment compliance (EN / AR / FR)

Payment recommendations always attach `PAYMENT_COMPLIANCE_DISCLAIMERS` in English,
Arabic, and French from `@miraaj/shared-types`:

- **EN:** Miraaj.tech provides technical integration, provider-selection guidance and lawful onboarding support. Financial accounts and merchant services are supplied by licensed third-party providers and remain subject to identity verification, company verification, country availability, activity eligibility and provider approval.
- **AR:** تقدم Miraaj.tech خدمات التكامل التقني، والمساعدة في اختيار مزود الخدمة، ودعم إجراءات الربط القانونية. يتم توفير الحسابات المالية وخدمات التجار من خلال جهات مرخصة، وتخضع للتحقق من الهوية، والتحقق من الشركة، وتوفر الخدمة في البلد، وأهلية النشاط، وموافقة مزود الخدمة.
- **FR:** Miraaj.tech fournit l'intégration technique, l'aide au choix du prestataire et l'accompagnement légal à l'intégration. Les comptes financiers et services marchands sont fournis par des prestataires tiers agréés et restent soumis à la vérification d'identité, à la vérification de l'entreprise, à la disponibilité dans le pays, à l'éligibilité de l'activité et à l'approbation du prestataire.

Prohibited claims (guaranteed approval, no KYC/KYB, anonymous accounts, bypassing
country rules, “Miraaj.tech is a bank”, etc.) are blocked by
`containsProhibitedPaymentClaim()` in tests and catalog copy review. NestJS
matching never implies provider approval; FastAPI reasoning cannot override this.

### 27.7 Prompt-injection defense

OCR, vision, and user-supplied text are **untrusted evidence**, not instructions.
The FastAPI `prompt_injection.py` module strips or flags instruction-like patterns
before provider calls; reasoning prompts separate system instructions from source
content. Invalid or suspicious provider JSON is rejected with bounded repair, then
fails safe without mutating deterministic profile fields. Injection cannot activate
catalog items, override exclusions, approve payment claims, or reveal secrets.
Multilingual injection cases are tested.

### 27.8 Queues and permissions

| Queue | Purpose |
| --- | --- |
| `miraaj.ai.intelligence` | Business-profile build, service matching, recommendation recompute |
| `miraaj.ai.intelligence.dead-letter` | Failed intelligence jobs after retries |

Job names (BullMQ, `AI_INTELLIGENCE_JOB_NAMES`): `build-business-profile`,
`match-services`, `recompute-recommendations`.

Prompt 3 admin routes require bearer token + permission checks (temporary
`ADMIN_API_TOKEN` until full RBAC). Declared permissions in `@miraaj/shared-config`:

- Intelligence jobs: `ai.intelligence.create`, `.read`, `.retry`, `.cancel`
- Business profiles: `ai.businessProfiles.read`, `.review`, `.approve`, `.reject`
- Recommendations: `ai.recommendations.read`, `.recompute`, `.review`, `.approve`, `.reject`
- Service catalog: `ai.serviceCatalog.read`, `.create`, `.update`, `.publish`, `.deprecate`
- Matching policies: `ai.matchingPolicies.read`, `.manage`, `.publish`

Multilingual admin permissions from §25.2 (`ai.languages.*`, `ai.translation.*`,
`ai.glossary.*`) remain declared for later identity integration and are **not**
removed by Prompt 3.

### 27.9 Out of scope (later)

Campaign copy/generation, social publishing, tracked links, QR codes, referral
rewards, landing-page generation, billing, speech/video, public dashboards.

## 28. Prompt 4 — campaign intelligence and multilingual package generation

Prompt 4 converts **approved** Prompt 3 recommendation sets into structured,
multilingual, platform-specific **campaign packages**. Packages are text briefs
and copy only. Nothing is published automatically.

### 28.1 Ownership

| Layer | Owns |
| --- | --- |
| NestJS `apps/api` | Source eligibility, brand/policies, BullMQ campaign queues, persistence, deterministic validation/quality, human review, admin APIs, **final approval authority** |
| FastAPI `apps/ai-service` | Campaign strategy/copy/transcreation provider adapters (disabled + Gemini), structured suggestions, provider safety — **no Mongo, no approval, no publish** |
| MongoDB | Brand profiles, campaign jobs/attempts/briefs/packages/variants/reviews/feedback, policies, glossaries, prompt versions |
| Redis | BullMQ `miraaj.ai.campaigns` (+ DLQ), locks, idempotency, progress |

### 28.2 Pipeline

Approved recommendation set → verify eligibility & promotion rules → load
profile/catalog/brand → brief → strategy → master message → platform variants →
transcreation → image/video/carousel/story **briefs** → deterministic validation →
quality scores → human review → versioned package (no publish).

### 28.3 Source and audience eligibility

Consumes only approved (or explicitly overridden) Prompt 3 recommendation
revisions with active catalog services. Blocks `unsuitable` promotion and
consumer B2B mismatches (patient/student/restaurant-customer/hotel-guest/
employee-only without decision-maker evidence). Payment and regulated domains
always require human review.

### 28.4 Taxonomies and policies

Controlled enums: objectives, funnel stages, campaign types, platforms, content
formats, CTA codes. Versioned **platform policy**, **compliance policy**,
**campaign policy**, **brand profile** (Miraaj.tech v1), and **translation
glossary**. Claims engine: approved / source_supported / requires_evidence /
prohibited / unknown / human_review_required. No invented stats, clients,
awards, or guaranteed payment approval.

### 28.5 Multilingual and transcreation

Reuses `LANGUAGE_REGISTRY`, translation/glossary/`CampaignLanguageVariant`
contracts. Modes: source-only, translation, localized, transcreation,
market-specific, bilingual, multilingual package. Generate only selected
languages/locales (bounded). Preserve Miraaj.tech, Tasks.cash, URLs, contacts,
numbers, disclosures. Tier 3 and untested locales require review.

### 28.6 Queues and providers

- Queues: `miraaj.ai.campaigns`, `miraaj.ai.campaigns.dead-letter`
- Jobs: build-brief, strategy, generate, transcreate, validate, regenerate
- Providers: `AI_CAMPAIGN_PROVIDER` / `AI_TRANSLATION_PROVIDER` (`disabled`|
  `gemini`). Disabled mode: brief may exist; no fabricated copy.
- Auto-approve off by default (`CAMPAIGN_AUTO_APPROVE_ENABLED=false`).

### 28.7 Admin API and permissions

Protected `/api/admin/ai/campaigns/*`, brand profiles, and policy read/manage
routes. Permissions: `ai.campaigns.*`, `ai.campaignBriefs.*`,
`ai.brandProfiles.*`, `ai.campaignPolicies.*`, `ai.platformPolicies.*`,
`ai.compliancePolicies.*`, `ai.translationGlossaries.*`.

### 28.8 Transcreation and creative briefs

Language variants call FastAPI `/internal/v1/campaigns/transcreate` when
translation is enabled. Disabled translation leaves non-base languages as
`translation_unavailable` without fabricating copy. Packages include image,
video, carousel and story **text briefs only** (no rendering).

### 28.9 Review, regenerate and revisions

Corrections bump `currentRevision` and persist feedback. Regeneration
supersedes the package and re-enqueues the parent BullMQ job with a unique
job id. Approval remains fail-closed on audit write.

### 28.10 Out of scope (later)

Social OAuth/publishing, ad accounts, tracked links/UTM beyond placeholders, QR,
Tasks.cash, landing pages, lead capture, billing, speech/TTS, image/video
rendering, media editing, campaign analytics ingestion, public campaign UI.

## 29. Full-system observability and immutable audit logs

Prompt 1–4 share one observability layer. Diagnostic logs and immutable audit
events are related but distinct.

### 29.1 Shared log envelope

Every structured event uses:

`timestamp`, `level`, `event`, `service`, `module`, `environment`,
`requestId`, `correlationId`, `traceId`, `spanId`, `actorId`, `actorRole`,
`mediaId`, `analysisJobId`, `intelligenceJobId`, `campaignJobId`,
`attemptId`, `durationMs`, `outcome`, `safeErrorCode`, `metadata`.

Contracts live in `packages/shared-logging` (`buildStructuredLog`,
`withTraceContext`, redaction/truncation helpers). FastAPI mirrors the envelope
in `apps/ai-service/app/core/observability.py`.

### 29.2 Sinks and exporters

- Console JSON (production-friendly local/container stdout)
- In-memory sink for automated tests
- OpenTelemetry-compatible exporter abstraction (local/in-memory by default)
- Future external centralized logging provider adapter

No paid logging service is required. Production may attach an OTLP or vendor
sink later without changing event shape.

### 29.3 Redaction and truncation

Always redact authorization headers, cookies, provider keys, HMAC secrets, and
presigned URLs. Truncate OCR text, campaign content, prompts, and other bulky
fields in ordinary diagnostic logs. Never log raw provider responses, full
campaign packages, passwords, or tokens.

### 29.4 Audit versus diagnostic logs

Diagnostic logs support operations and incident investigation. Immutable audit
events record consequential administrator actions (auth failure, permission
denial, media/analysis/recommendation/campaign review outcomes, brand/policy
activation, compliance overrides, regulated/payment approvals). Audit documents
store hashed IP and truncated user-agent summaries only.

Protected query API:

- `GET /api/admin/ai/audit-events`
- `GET /api/admin/ai/audit-events/:auditEventId`

Permission: `ai.auditLogs.read`. No public log endpoints.

### 29.5 Fail-closed audit writes

Consequential actions (campaign approval, policy/catalog activation, compliance
override, regulated-domain approval) fail closed when the audit write fails.
Low-risk diagnostic log failures must not crash ordinary requests or expose
secrets.

### 29.6 Retention and rotation

Document retention for briefs, attempts, packages, reviews, feedback, BullMQ
job metadata, and audit references in ops runbooks. Rotate container/file logs
at the platform layer. Do not auto-delete approved campaign packages. Raw
provider response retention remains off by default.

### 29.7 Status

Protected system status reports logging subsystem state, last successful log
emission, audit persistence state, dropped/failed write counters, and
trace/metrics exporter state.

## 30. Prompt 5 — creative media generation, validation and rendering

Prompt 5 converts **approved** Prompt 4 campaign packages (image/video/carousel/
story briefs) into privately stored draft creative assets. NestJS owns
eligibility, orchestration, validation authority, rights, human review, and
final approval. FastAPI owns image/video/render provider abstractions, secure
retrieval, normalization, overlays, subtitles, and OCR helpers. Auto-approve
and auto-publish remain disabled.

### 30.1 Ownership

| Layer | Responsibility |
| --- | --- |
| NestJS `apps/api` | Source eligibility, jobs, assets, variants, rights, queues, review, admin APIs |
| FastAPI `apps/ai-service` | Disabled/mock image & video providers, local render, SSRF-safe fetch, OCR check |
| MongoDB | Jobs, attempts, assets, variants, reviews, rights, render specs, capabilities, model policies, prompts |
| Redis | BullMQ `miraaj.ai.creative-generation` (+ DLQ), locks, progress |
| MinIO | Private `creative/{source,normalized,rendered,previews,thumbnails,subtitles,provenance,validation}/...` |

### 30.2 Pipeline

Approved campaign package → pin revision/briefs/policies → generation job →
provider generate (or `provider_unavailable` when disabled) → retrieve/validate →
normalize → render platform variants + overlays/subtitles → OCR text check →
quality/compliance/rights scores → `awaiting_review` → human approve/correct/
reject/regenerate. Attempts are immutable; corrections create asset revisions.

### 30.3 Providers

- `AI_IMAGE_PROVIDER`: `disabled` \| `mock` \| `openai` (default `disabled`)
- `AI_VIDEO_PROVIDER`: `disabled` \| `mock` \| `runway` (default `disabled`)
- `AI_RENDER_PROVIDER`: `local` \| `disabled`
- Disabled: no fabricated commercial pixels; manual upload path remains
- Mock: deterministic test assets only; no live commercial APIs in CI
- Production adapters live only in FastAPI; API keys never enter NestJS
- `CREATIVE_AUTO_APPROVE_ENABLED` must stay `false`

### 30.4 Admin API

Protected `/api/admin/ai/creative/*` for jobs, assets, review, rights, providers,
render specifications, and manual asset upload sessions. Permissions:
`ai.creativeJobs.*`, `ai.creativeAssets.*`, `ai.creativeManualAssets.*`,
`ai.creativeRights.*`, `ai.creativeProviders.*`, `ai.renderSpecifications.*`.

### 30.5 Out of scope

Social OAuth/publishing, ad accounts, tracked links/QR, Tasks.cash, public asset
URLs, voice cloning, deepfakes, celebrity likeness, public creative UI,
`apps/web` changes.

## 31. Prompt 5.1 — production image/video provider activation

Prompt 5.1 activates optional production adapters behind the same Prompt 5
contracts. Defaults remain offline.

### 31.1 Adapters

| Provider | Type | Official surface |
| --- | --- | --- |
| `openai` | Image | OpenAI Images API (`/v1/images/generations`) via httpx |
| `runway` | Video | Runway API text-to-video + task polling via httpx |

Models are selected via `AI_IMAGE_MODEL` / `AI_VIDEO_MODEL` and active model
policies. Exact overlays/disclosures continue through local render + OCR.

### 31.2 Secret boundary

- Provider API keys exist only in the FastAPI process environment / ai-service
  Compose service.
- NestJS never receives provider keys.
- Status APIs never return keys, prompts, or signed URLs.
- Logs redact Authorization, API keys, and provider URLs.

### 31.3 Controls

- Capability + model-policy seeds for openai/runway
- Concurrency budgets (`AI_PROVIDER_MAX_ACTIVE_IMAGE_JOBS` / `VIDEO`)
- Optional cost caps without fabricating prices
- Bounded video poll + persisted `providerJobId` for worker resume
- Controlled live smoke: `AI_PROVIDER_LIVE_SMOKE_TEST_ENABLED` +
  `--confirm-live-provider-cost`

### 31.4 Smoke commands

```bash
pnpm ai:provider:health
pnpm ai:provider:smoke:image -- --campaign-package-id=<id> --creative-brief-id=<id> --confirm-live-provider-cost
pnpm ai:provider:smoke:video -- --campaign-package-id=<id> --creative-brief-id=<id> --confirm-live-provider-cost
```

Automated CI never spends money. Live smoke is `NOT RUN` without credentials.
