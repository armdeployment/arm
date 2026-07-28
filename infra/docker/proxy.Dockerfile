# ARM Closed-Proxy Dockerfile (spec §9 1.2)
# Multi-stage: build with npm/pnpm → dist → runtime.
# Production runs on port 8787 (configurable via PROXY_PORT).

FROM node:22-alpine AS base
RUN corepack enable pnpm && corepack prepare pnpm@11.17.0 --activate
WORKDIR /app

# ---- Build stage ----
FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/proto/package.json packages/proto/
COPY packages/config/package.json packages/config/
COPY apps/data-plane/proxy/package.json apps/data-plane/proxy/
RUN pnpm install --frozen-lockfile --prod false

COPY packages/proto/ packages/proto/
COPY packages/config/ packages/config/
COPY apps/data-plane/proxy/ apps/data-plane/proxy/
RUN pnpm --filter @arm-app/proxy build

# ---- Runtime stage ----
FROM base AS runtime
ENV NODE_ENV=production
ENV PROXY_PORT=8787

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps ./apps

EXPOSE 8787
CMD ["node", "--import", "tsx", "apps/data-plane/proxy/src/index.ts"]
