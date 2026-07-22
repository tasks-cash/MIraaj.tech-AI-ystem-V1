# Miraaj.tech AI Service

Prompt 6 provides HMAC-only `/internal/v1/distribution/assets`, `/proofs/verify`, and `/status`. QR generation/decoding, branded headers, OCR, duplicate checks and deterministic scoring run locally without OpenAI or Runway.

Private FastAPI processing service for the Miraaj.tech AI System (Prompt 2).

Owns media inspection, normalization support, OCR (Tesseract), script/language
detection, and vision adapters (Gemini first). Does **not** connect to MongoDB
and is **not** publicly exposed.

## Local setup

```bash
pnpm ai:install
cp .env.example .env
pnpm --filter @miraaj/ai-service dev
```

Host development defaults to `127.0.0.1:8200`. Docker publishes only on host
loopback. Production must use a private service network.

## Health and readiness

```bash
curl http://127.0.0.1:8200/health
curl http://127.0.0.1:8200/ready
curl http://127.0.0.1:8200/version
```

Readiness reports OCR engine/packs, OpenCV, Pillow, PDF renderer, and vision
provider state without exposing secrets.

## Internal HMAC routes

All `/internal/v1/*` mutations require the existing HMAC headers (service ID,
timestamp, request/correlation IDs, idempotency key, body SHA-256, signature).

| Method | Path |
| --- | --- |
| POST | `/internal/v1/media/inspect` |
| POST | `/internal/v1/media/ocr` |
| POST | `/internal/v1/media/analyze` |
| GET | `/internal/v1/providers/status` |
| GET | `/internal/v1/ocr/status` |
| POST | `/internal/v1/intelligence/business-profile` |
| POST | `/internal/v1/intelligence/needs` |
| POST | `/internal/v1/intelligence/contradictions` |
| GET | `/internal/v1/intelligence/providers/status` |
| POST | `/internal/v1/campaigns/strategy` |
| POST | `/internal/v1/campaigns/generate` |
| POST | `/internal/v1/campaigns/transcreate` |
| POST | `/internal/v1/campaigns/quality-check` |
| POST | `/internal/v1/campaigns/compliance-check` |
| GET | `/internal/v1/campaigns/providers/status` |
| POST | `/internal/v1/creative/generate-image` |
| POST | `/internal/v1/creative/generate-video` |
| POST | `/internal/v1/creative/render/image-variant` |
| POST | `/internal/v1/creative/render/text-overlay` |
| POST | `/internal/v1/creative/render/subtitles` |
| POST | `/internal/v1/creative/render/thumbnail` |
| POST | `/internal/v1/creative/validate-media` |
| POST | `/internal/v1/creative/ocr-check` |
| GET | `/internal/v1/creative/jobs/{providerJobId}/status` |
| POST | `/internal/v1/creative/jobs/{providerJobId}/cancel` |
| GET | `/internal/v1/creative/providers/status` |

Media bytes are fetched from short-lived signed object URLs only. Hosts must be
listed in `MEDIA_FETCH_ALLOWED_HOSTS`. Redirects and arbitrary URLs are rejected.

## OCR

Installed packs (Docker image): `ara eng fra spa deu por ita nld tur rus`.

Key env vars: `OCR_LANGUAGES_DEFAULT`, `OCR_LANGUAGES_INSTALLED`,
`OCR_MAX_LANGUAGES_PER_JOB`, `OCR_PRELIMINARY_LANGUAGES`, `OCR_MIN_CONFIDENCE`.

## Vision

`VISION_PROVIDER_ENABLED=false` by default. When enabled, `GEMINI_API_KEY` must
exist only in this service runtime. Invalid provider JSON is schema-validated
and may get one bounded repair retry.

## Business reasoning (Prompt 3)

`app/api/internal_intelligence.py` classifies the Prompt-2-style
`businessSignals` / `audienceSignals` / OCR summary into ranked business and
audience types, decision-maker likelihood, promotion eligibility,
needs/pain points/objectives, contradictions, and regulated-domain flags.

- `AI_REASONING_PROVIDER=disabled` (default): a deterministic, local
  rule-based classifier. Never calls an LLM and never reads free text
  (`ocrSummary`, `additionalContext`) for decision-making — only structured
  `code`/`confidence` signals drive classification. Free text is scanned only
  for prompt-injection phrasing (EN/AR/FR) to raise a review flag.
- `AI_REASONING_PROVIDER=gemini`: reuses `GEMINI_API_KEY`. Requests wrap
  untrusted source content in explicit delimiters and instruct the model to
  never follow instructions found inside them, never infer sensitive traits,
  and never perform face recognition or identity claims. Responses are
  schema-validated with one bounded JSON-repair retry, same pattern as the
  vision provider.

This module never connects to MongoDB, never exposes a public route, and
never generates campaigns — it only returns reasoning signals for other
internal services to act on.

## Campaign generation + transcreation (Prompt 4)

`app/api/internal_campaigns.py` drafts campaign strategy and creative
content, transcreates existing content into another language, and runs
deterministic quality/compliance checks. NestJS remains the sole authority on
approval, publishing, and MongoDB persistence — this service only returns
structured drafts and safety signals.

- `AI_CAMPAIGN_PROVIDER=disabled` (default): `strategy` and `generate`
  return an empty, `requiresReview=true` shell tagged
  `CAMPAIGN_PROVIDER_DISABLED` — never fabricated marketing copy.
  `quality_check` and `compliance_check` still run (they are fully
  deterministic and provider-independent).
- `AI_CAMPAIGN_PROVIDER=gemini`: reuses `GEMINI_API_KEY` and
  `AI_CAMPAIGN_MODEL`/`AI_CAMPAIGN_PROVIDER_TIMEOUT_SECONDS`/
  `AI_CAMPAIGN_PROVIDER_MAX_RETRIES`. `sourceContent` (OCR summary /
  free-text context) is always wrapped as untrusted input and scanned for
  prompt-injection phrasing (EN/AR/FR); a match forces
  `prompt_injection_detected` into `reviewReasonCodes` regardless of what the
  model returned.
- `AI_TRANSLATION_PROVIDER=disabled|gemini` (`AI_TRANSLATION_MODEL`,
  `AI_TRANSLATION_TIMEOUT_SECONDS`, `AI_TRANSLATION_MAX_RETRIES`) backs
  `/campaigns/transcreate`. The disabled provider returns empty translated
  text and `translation_unavailable` rather than echoing the source text.
- Deterministic safety (`app/services/campaign/safety.py`, always active,
  independent of provider): blocks prohibited claims (guaranteed results,
  fake statistics, "no KYC", etc.), blocks sensitive-trait targeting and
  face-recognition requests, verifies protected tokens (`Miraaj.tech`,
  `Tasks.cash`, URLs, emails, phone numbers, currency amounts, numbers) are
  preserved after transcreation, requires an EN/AR/FR payment disclosure
  whenever `paymentServicePresent` is set, sets `direction: "rtl"` for
  Arabic-family targets and `"ltr"` otherwise, and scores semantic drift to
  flag human review when a translation likely lost meaning.
- `AI_CAMPAIGN_MAX_INPUT_CHARS` / `AI_CAMPAIGN_MAX_OUTPUT_CHARS` bound
  request/response size; oversized requests are rejected with
  `CAMPAIGN_INPUT_TOO_LARGE` before any provider call.

This module never connects to MongoDB, never approves, and never publishes —
NestJS owns those steps and should treat every response as a draft pending
human review when `requiresReview` is `true`.

## Creative media generation + rendering (Prompt 5 / 5.1)

`app/api/internal_creative.py` generates/renders creative media helpers for
Nest creative jobs. Defaults keep commercial APIs offline.

- `AI_IMAGE_PROVIDER=disabled` (default) / `mock` / `openai`: disabled returns
  `provider_unavailable` with **no fabricated commercial pixels**; mock
  returns deterministic PNG via Pillow (no network); openai uses the official
  Images API (`/v1/images/generations`) when `AI_IMAGE_PROVIDER_API_KEY` is set.
- `AI_VIDEO_PROVIDER=disabled` (default) / `mock` / `runway`: same pattern; mock
  tries OpenCV MP4 / poster frames; runway submits `POST /v1/text_to_video` and
  polls `GET /v1/tasks/{id}` (header `X-Runway-Version: 2024-11-06`).
- `AI_RENDER_PROVIDER=local` (default) / `disabled`: local Pillow letterbox,
  metadata strip, LTR/RTL text overlay, WebVTT+SRT, thumbnails/previews, and
  OCR round-trip against Prompt 2 Tesseract when available.
- Secrets stay in FastAPI only (`AI_IMAGE_PROVIDER_API_KEY`,
  `AI_VIDEO_PROVIDER_API_KEY`). Empty keys are treated as unset. Selecting
  openai/runway without a key fails settings validation outside `APP_ENV=test`.
- `CREATIVE_MAX_*` / `CREATIVE_PROVIDER_DOWNLOAD_*` bound payload and SSRF-safe
  signed-URL retrieves (`media_fetch` allowlist). For live provider output
  retrieval, extend `MEDIA_FETCH_ALLOWED_HOSTS` with
  `api.openai.com`, `oaidalleapiprodscus.blob.core.windows.net`, and
  `api.dev.runwayml.com` (no secrets in the allowlist).
- Job helpers: `GET /internal/v1/creative/jobs/{providerJobId}/status`,
  `POST /internal/v1/creative/jobs/{providerJobId}/cancel`.
- Readiness exposes `imageProvider`, `videoProvider`, `renderProvider`
  (misconfigured when openai/runway selected without a key).
- Usage metadata is recorded when returned; costs are never fabricated
  (`costUnknown=true` unless the provider reports a cost).

### Controlled live smoke (costs money — never run in CI)

```bash
# Safe health (no spend)
.venv/bin/python scripts/provider_smoke.py health

# Live image — requires AI_PROVIDER_LIVE_SMOKE_TEST_ENABLED=true + OpenAI key
.venv/bin/python scripts/provider_smoke.py smoke-image \
  --campaign-package-id=<approved-id> \
  --creative-brief-id=<approved-id> \
  --confirm-live-provider-cost

# Live video — requires AI_PROVIDER_LIVE_SMOKE_TEST_ENABLED=true + Runway key
.venv/bin/python scripts/provider_smoke.py smoke-video \
  --campaign-package-id=<approved-id> \
  --creative-brief-id=<approved-id> \
  --confirm-live-provider-cost
```

Without credentials the smoke commands report
`NOT RUN — credentials not configured` instead of inventing success.

This module never connects to MongoDB, never approves, and never publishes.

## Tests

```bash
pnpm ai:test
# or
pnpm --filter @miraaj/ai-service test
```

Automated tests mock httpx (`MockTransport`) and never call real OpenAI or
Runway APIs.

## Out of scope (later prompts)

Service matching, speech/TTS, public upload UI, MongoDB access, and
approval/publishing workflows (owned by NestJS).
