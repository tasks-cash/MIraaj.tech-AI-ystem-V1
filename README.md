# Miraaj.tech AI System

Prompt 6 adds backend-only campaign distribution assignments, opaque tracked links, local QR/header rendering, private proof verification, human review, and a disabled-by-default Tasks.cash outbox. See [distribution tasks](docs/distribution-task-guide.md), [proof verification](docs/proof-verification-guide.md), and [tracked-link security](docs/qr-tracked-link-security.md).

API-only backend for the Miraaj.tech AI System: NestJS API, private FastAPI AI
service, MongoDB, Redis, MinIO, and in-process BullMQ workers.

A legacy Next.js app remains under `apps/web` but is **not** part of the default
Docker runtime and must not be treated as the production surface for this project.

## Local training with Docker (default: backend only)

```bash
cp .env.example .env
docker compose up -d --build
```

`docker compose up -d` starts only the AI-system backend:

- NestJS API: `http://localhost:4200`
- FastAPI AI (loopback): `http://127.0.0.1:8200/health`
- MinIO API / console (loopback): `http://127.0.0.1:9200` / `http://127.0.0.1:9201`
- MongoDB (loopback): `localhost:27020`
- Redis (loopback): `localhost:6383`

BullMQ workers run inside the NestJS API process (media, intelligence, campaigns,
creative generation).

Production image (`openai`) and video (`runway`) adapters run only inside the
FastAPI AI service. Provider API keys must never be passed to the NestJS API
container. See [docs/creative-provider-activation.md](docs/creative-provider-activation.md).

```bash
pnpm ai:provider:health
```

Live smoke tests are opt-in and disabled by default.

### Optional legacy web profile

The `web` service is gated behind the Compose profile `web` and does not start by
default:

```bash
docker compose --profile web up -d web
```

## Local development without Docker

```bash
corepack enable
corepack prepare pnpm@9.15.9 --activate
cp .env.example .env
pnpm install
pnpm ai:install
pnpm dev:infra
pnpm --filter @miraaj/api --filter @miraaj/ai-service --parallel dev
```

`pnpm dev:infra` starts MongoDB, Redis, and MinIO via Compose (no web container).

## Quality checks

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm ai:test
pnpm build
```

## Production upload

Deploy the NestJS API and private FastAPI AI service to a compatible platform
(Render, Railway, or similar) with `pnpm build`. Use managed MongoDB, Redis, and
S3-compatible storage. Configure all secrets in the platform dashboard. The
FastAPI service must use private networking and must not be exposed directly to
browser clients.

See `docs/miraaj-ai-system-architecture.md` for the audited architecture and
execution strategy.
