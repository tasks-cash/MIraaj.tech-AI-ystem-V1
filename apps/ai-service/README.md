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

## Tests

```bash
pnpm ai:test
```

Automated tests never call the real Gemini API.

## Out of scope (later prompts)

Campaign generation, service matching, speech/TTS, public upload UI, and full
translation/transcreation engines.
