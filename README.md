# Miraaj.tech AI System

Existing multilingual Next.js website plus the NestJS and private FastAPI foundation for
the Miraaj.tech AI System.

## Local training with Docker

```bash
cp .env.example .env
docker compose up --build
```

Local services:

- Web: `http://localhost:3200`
- API: `http://localhost:4200`
- AI health: `http://localhost:8200/health`
- MinIO console: `http://localhost:9201`
- MongoDB: `localhost:27020`
- Redis: `localhost:6383`

## Local development without Docker

```bash
corepack enable
corepack prepare pnpm@9.15.9 --activate
cp .env.example .env
pnpm install
pnpm ai:install
pnpm dev:infra
pnpm dev:all
```

## Quality checks

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm ai:test
pnpm build
```

## Production upload

Deploy the same repository to Vercel, Render, Railway, or a compatible platform with
`pnpm build`. Use managed MongoDB, Redis, and S3-compatible storage in production.
Configure all secrets in the platform dashboard. The FastAPI service must use private
networking and must not be exposed directly to browser clients.

See `docs/miraaj-ai-system-architecture.md` for the audited architecture and execution
strategy.
# Tasks.cash-V2-new-level
# Tasks.cash-V2-new-level
# MIraaj.tech-AI-ystem-V1
# MIraaj.tech-AI-ystem-V1
# MIraaj.tech-AI-ystem-V1
