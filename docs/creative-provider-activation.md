# Creative media provider activation (Prompt 5.1)

Providers stay **disabled by default**. Automated tests never call live APIs and
never spend money.

## Secret boundary

| Location | Allowed |
| --- | --- |
| `apps/ai-service` process env / Compose `ai-service` | Provider API keys |
| NestJS `api` container | Provider **selection** env only (`AI_IMAGE_PROVIDER=openai`, etc.) — **no keys** |
| MongoDB / Redis / MinIO / Git / logs / status APIs | **Never** keys, signed URLs, or full prompts |

Set keys only in a local untracked `.env` or the platform secret store:

```bash
# apps/ai-service / Compose ai-service only
AI_IMAGE_PROVIDER=openai
AI_IMAGE_PROVIDER_API_KEY=
AI_IMAGE_MODEL=gpt-image-1
AI_VIDEO_PROVIDER=runway
AI_VIDEO_PROVIDER_API_KEY=
AI_VIDEO_MODEL=gen3a_turbo
```

Production startup fails safely if a provider is selected without its key.

## Model policies and capabilities

Idempotent seeds create:

- Capability `image-openai` / `video-runway`
- Model policies `creative-model-policy-openai-v1` / `creative-model-policy-runway-v1`
- Default policy remains disabled selection until operators change env

Human review remains mandatory. Auto-approve stays false.

## Health

```bash
pnpm ai:provider:health
# or
pnpm --filter @miraaj/ai-service provider:health
```

Protected admin:

- `GET /api/admin/ai/creative/providers/status`
- `POST /api/admin/ai/creative/providers/health-check`

## Controlled live smoke (opt-in)

Requires:

1. Valid credentials on ai-service
2. `AI_PROVIDER_LIVE_SMOKE_TEST_ENABLED=true`
3. Approved Prompt 4 campaign package + creative brief IDs
4. Explicit `--confirm-live-provider-cost`

```bash
pnpm ai:provider:smoke:image -- \
  --campaign-package-id=<id> \
  --creative-brief-id=<id> \
  --confirm-live-provider-cost

pnpm ai:provider:smoke:video -- \
  --campaign-package-id=<id> \
  --creative-brief-id=<id> \
  --confirm-live-provider-cost
```

Without credentials or flags, report status as
`NOT RUN — credentials not configured` (do not claim a live pass from mocks).

## Disable immediately

Set `AI_IMAGE_PROVIDER=disabled` and/or `AI_VIDEO_PROVIDER=disabled`, restart
ai-service (and api if selection env changed). Cancel pending provider jobs via
admin creative job cancel / provider job cancel endpoints.

## Verify privacy

- Assets under private MinIO `creative/...` prefixes
- Short-lived admin presign only
- No public ACL
- Grep logs for `sk-`, `Bearer`, `X-Amz-Signature` must be redacted
