# Miraaj.tech AI Service

Private FastAPI foundation for the Miraaj.tech AI System.

This phase provides health endpoints and NestJS-to-Python internal authentication only.
OCR, Gemini analysis, media processing, and campaign generation belong to later phases.

## Local setup

```bash
pnpm ai:install
cp .env.example .env
pnpm --filter @miraaj/ai-service dev
```

Host development defaults to `127.0.0.1:8200`. Docker binds Uvicorn to the
container network and publishes it only on host loopback. Production must use a
private service network and must not assign this service a public domain.

## Health checks

```bash
curl http://localhost:8200/health
curl http://localhost:8200/ready
curl http://localhost:8200/version
```

## Tests

```bash
pnpm ai:test
```

The service is internal-only. Only NestJS and authorized infrastructure health
checks may reach it in production.
