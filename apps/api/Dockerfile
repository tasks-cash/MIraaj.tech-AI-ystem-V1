FROM node:22-alpine AS development

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile

EXPOSE 4200
CMD ["pnpm", "dev:api"]

FROM development AS builder
RUN pnpm --filter @miraaj/api... build

FROM node:22-alpine AS production

ENV NODE_ENV=production
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 api

COPY --from=builder --chown=api:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=api:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=api:nodejs /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder --chown=api:nodejs /app/packages ./packages

USER api
EXPOSE 4200
CMD ["node", "apps/api/dist/main.js"]
