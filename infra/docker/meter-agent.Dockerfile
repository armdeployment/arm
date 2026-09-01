# ARM Meter-Agent Dockerfile (spec §5.2, §9 1.2)
# Multi-stage: build with pnpm → runtime.
# Production runs on port 8789 (configurable via METER_AGENT_PORT).
#
# The buffer directory MUST be a persistent volume. This is the process that
# holds metering events between the proxy emitting them and the control plane
# accepting them, and it is deliberately at-least-once: events survive a
# restart precisely because they are on disk. Mounting it as ephemeral storage
# gives back the data loss the disk buffer exists to prevent.

FROM node:22-alpine AS base
RUN corepack enable pnpm && corepack prepare pnpm@11.17.0 --activate
WORKDIR /app

# ---- Build stage ----
FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/proto/package.json packages/proto/
COPY packages/config/package.json packages/config/
COPY apps/data-plane/meter-agent/package.json apps/data-plane/meter-agent/
RUN pnpm install --frozen-lockfile --prod false

COPY packages/proto/ packages/proto/
COPY packages/config/ packages/config/
COPY apps/data-plane/meter-agent/ apps/data-plane/meter-agent/
RUN pnpm --filter @arm-app/meter-agent build

# ---- Runtime stage ----
FROM base AS runtime
ENV NODE_ENV=production
ENV METER_AGENT_PORT=8789
ENV METER_AGENT_BUFFER_DIR=/data/meter-buffer

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps ./apps

EXPOSE 8789
CMD ["node", "--import", "tsx", "apps/data-plane/meter-agent/src/index.ts"]
