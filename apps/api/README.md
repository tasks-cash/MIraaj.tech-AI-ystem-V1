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
- `miraaj.ai.intelligence`
- `miraaj.ai.intelligence.dead-letter`
- `miraaj.ai.campaigns`
- `miraaj.ai.campaigns.dead-letter`
- `miraaj.ai.creative-generation`
- `miraaj.ai.creative-generation.dead-letter`

Workers run in-process with `MEDIA_WORKER_CONCURRENCY` /
`AI_INTELLIGENCE_WORKER_CONCURRENCY` / `AI_CAMPAIGN_WORKER_CONCURRENCY` /
`AI_CREATIVE_WORKER_CONCURRENCY` and stale-job recovery.

## Prompt 3 admin endpoints

Business intelligence and Miraaj.tech service matching (no campaign generation).

| Method | Path |
| --- | --- |
| POST | `/api/admin/ai/intelligence/jobs` |
| GET | `/api/admin/ai/intelligence/jobs` |
| GET | `/api/admin/ai/intelligence/jobs/:jobId` |
| POST | `/api/admin/ai/intelligence/jobs/:jobId/retry` |
| POST | `/api/admin/ai/intelligence/jobs/:jobId/cancel` |
| GET | `/api/admin/ai/business-profiles` |
| GET | `/api/admin/ai/business-profiles/:profileId` |
| POST | `/api/admin/ai/business-profiles/:profileId/review` |
| POST | `/api/admin/ai/business-profiles/:profileId/approve` |
| POST | `/api/admin/ai/business-profiles/:profileId/reject` |
| GET | `/api/admin/ai/recommendations` |
| GET | `/api/admin/ai/recommendations/:setId` |
| POST | `/api/admin/ai/recommendations/:setId/recompute` |
| POST | `/api/admin/ai/recommendations/:setId/review` |
| POST | `/api/admin/ai/recommendations/:setId/approve` |
| POST | `/api/admin/ai/recommendations/:setId/reject` |
| GET | `/api/admin/ai/service-catalog/categories` |
| GET | `/api/admin/ai/service-catalog/services` |
| GET | `/api/admin/ai/service-catalog/services/:slug` |
| POST | `/api/admin/ai/service-catalog/services` |
| PATCH | `/api/admin/ai/service-catalog/services/:slug` |
| GET | `/api/admin/ai/service-catalog/versions` |
| POST | `/api/admin/ai/service-catalog/versions` |
| POST | `/api/admin/ai/service-catalog/versions/:versionId/activate` |

See root `.env.example` for `AI_INTELLIGENCE_*`, `AI_REASONING_*`, and
`SERVICE_MATCH_*` variables.

## Prompt 5 admin endpoints

Creative media generation from approved campaign packages (no publishing).
`CREATIVE_AUTO_APPROVE_ENABLED` remains false; all assets require human review.

| Method | Path |
| --- | --- |
| POST | `/api/admin/ai/creative/jobs` |
| GET | `/api/admin/ai/creative/jobs` |
| GET | `/api/admin/ai/creative/jobs/:creativeJobId` |
| POST | `/api/admin/ai/creative/jobs/:creativeJobId/retry` |
| POST | `/api/admin/ai/creative/jobs/:creativeJobId/cancel` |
| GET | `/api/admin/ai/creative/assets` |
| GET | `/api/admin/ai/creative/assets/:assetId` |
| POST | `/api/admin/ai/creative/assets/:assetId/review` |
| POST | `/api/admin/ai/creative/assets/:assetId/approve` |
| POST | `/api/admin/ai/creative/assets/:assetId/reject` |
| POST | `/api/admin/ai/creative/assets/:assetId/regenerate` |
| GET | `/api/admin/ai/creative/rights/:rightsRecordId` |
| GET | `/api/admin/ai/creative/providers` |
| GET | `/api/admin/ai/creative/render-specifications` |

See root `.env.example` / compose for `AI_CREATIVE_*`, `AI_IMAGE_*`, `AI_VIDEO_*`,
`AI_RENDER_*`, and `CREATIVE_*` variables.

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

Public upload UI, social publishing, Tasks.cash, billing, and speech.
