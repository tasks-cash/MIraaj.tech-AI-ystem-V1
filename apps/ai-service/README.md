# Miraaj.tech AI Service

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

## Tests

```bash
pnpm ai:test
```

Automated tests never call the real Gemini API.

## Out of scope (later prompts)

Service matching, speech/TTS, public upload UI, MongoDB access, and
approval/publishing workflows (owned by NestJS).
