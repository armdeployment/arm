# ARM scheduled workers.
#
# Runs as two Kubernetes CronJobs (daily and hourly) from the control-plane
# chart. Before this existed the workers module had no entrypoint and no
# scheduler — its own comment carried `TODO(1.1): wire to Vercel Cron Jobs /
# Cloud Scheduler / K8s CronJob`, and none of its jobs had ever run on a
# schedule anywhere.

FROM node:22-alpine AS base
RUN corepack enable pnpm && corepack prepare pnpm@11.17.0 --activate
WORKDIR /app

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/ packages/
COPY apps/control-plane/workers/package.json apps/control-plane/workers/
RUN pnpm install --frozen-lockfile --prod false
COPY apps/control-plane/workers/ apps/control-plane/workers/
RUN pnpm --filter @arm-app/workers build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps ./apps

# The schedule argument is supplied by the CronJob, not baked in — the same
# image serves both the daily and hourly schedules.
ENTRYPOINT ["node", "--import", "tsx", "apps/control-plane/workers/src/cli.ts"]
CMD ["daily"]
