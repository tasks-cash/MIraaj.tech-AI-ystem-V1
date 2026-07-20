# Miraaj.tech API

NestJS orchestration API for the Miraaj.tech AI System.

Owns authenticated admin media upload sessions, MongoDB persistence, MinIO
coordination, BullMQ workers, analysis job state, confidence routing, and human
review endpoints. Calls FastAPI over HMAC for processing only.

## Local setup

```bash
cp ../../.env.example .env   # or use root .env
pnpm --filter @miraaj/api dev
```

Port: **4200**. Requires MongoDB, Redis, MinIO, and the AI service.

## Prompt 2 admin endpoints

All routes require temporary admin bearer auth (`ADMIN_API_TOKEN`) and AI
permissions.

| Method | Path |
| --- | --- |
| POST | `/api/admin/ai/media/upload-sessions` |
| POST | `/api/admin/ai/media/upload-sessions/:sessionId/complete` |
| GET | `/api/admin/ai/media/upload-sessions/:sessionId` |
| GET | `/api/admin/ai/media/:mediaId` |
| POST | `/api/admin/ai/analysis/jobs` |
| GET | `/api/admin/ai/analysis/jobs` |
| GET | `/api/admin/ai/analysis/jobs/:jobId` |
| GET | `/api/admin/ai/analysis/results/:resultId` |
| POST | `/api/admin/ai/analysis/jobs/:jobId/retry` |
| POST | `/api/admin/ai/analysis/jobs/:jobId/cancel` |
| POST | `/api/admin/ai/analysis/results/:resultId/review` |
| POST | `/api/admin/ai/analysis/results/:resultId/approve` |
| POST | `/api/admin/ai/analysis/results/:resultId/reject` |
| GET | `/api/admin/ai/system-status` |

## Queues

- `miraaj.ai.media.validate`
- `miraaj.ai.media.analyze`
- `miraaj.ai.media.dead-letter`

Workers run in-process with `MEDIA_WORKER_CONCURRENCY` and stale-job recovery.

## Media limits

See root `.env.example` for `MEDIA_*`, `CONFIDENCE_*`, and `BULLMQ_*` variables.
All values are validated at startup; unlimited settings are rejected.

## Storage

Private MinIO bucket (`S3_BUCKET`) with non-guessable keys under
`media/original|normalized|ocr|previews/...`. Presigned upload/read URLs are
short-lived. No public bucket access.

## Tests

```bash
pnpm --filter @miraaj/api test
```

## Out of scope

Public upload UI, campaign generation, service matching, billing, and speech.
