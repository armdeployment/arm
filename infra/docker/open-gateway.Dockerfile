# ARM Closed-Proxy Dockerfile (spec §9 1.2)
# Multi-stage: build with npm/pnpm → dist → runtime.
# Production runs on port 8788 (configurable via GATEWAY_PORT).

FROM node:22-alpine AS base
RUN corepack enable pnpm && corepack prepare pnpm@11.17.0 --activate
WORKDIR /app

# ---- Build stage ----
FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/proto/package.json packages/proto/
COPY packages/config/package.json packages/config/
COPY apps/data-plane/open-gateway/package.json apps/data-plane/open-gateway/
RUN pnpm install --frozen-lockfile --prod false

COPY packages/proto/ packages/proto/
COPY packages/config/ packages/config/
COPY apps/data-plane/open-gateway/ apps/data-plane/open-gateway/
RUN pnpm --filter @arm-app/open-gateway build

# ---- Runtime stage ----
FROM base AS runtime
ENV NODE_ENV=production
ENV GATEWAY_PORT=8788

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps ./apps

EXPOSE 8788
CMD ["node", "--import", "tsx", "apps/data-plane/open-gateway/src/index.ts"]
