
# Architecture overview

MIC is a pnpm monorepo with Turbo orchestration.

- `apps/api` — NestJS gateway and business logic
- `apps/admin` — RBAC console
- `apps/web` — public SSR pages (aggregated content)
- `apps/ai-service` — FastAPI OCR/classification
- `apps/worker` — BullMQ processors
- `packages/*` — shared libraries (crypto, auth, database, queue, etc.)

Multi-tenant model: Tenant → Project → Environment → API Client.
Every project-owned query scopes by `tenantId` + `projectId` + `environment`.
