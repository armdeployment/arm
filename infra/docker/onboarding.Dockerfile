# ARM Employee Onboarding Dockerfile
# Multi-stage: build Next.js → production runner. Serves port 3300.
#
# Separate image from the dashboard on purpose: this app also serves PUBLIC
# setup-token redemption (authenticated by the signed token itself, not a
# session), so it sits at a different trust level and may be exposed to a
# different network than apps/control-plane/web.

FROM node:22-alpine AS base
RUN corepack enable pnpm && corepack prepare pnpm@11.17.0 --activate
WORKDIR /app

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/ packages/
COPY apps/onboarding/package.json apps/onboarding/
RUN pnpm install --frozen-lockfile --prod false

COPY apps/onboarding/ apps/onboarding/
RUN pnpm --filter @arm-app/onboarding build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/onboarding/.next ./apps/onboarding/.next
COPY --from=build /app/apps/onboarding/package.json ./apps/onboarding/
EXPOSE 3300
CMD ["pnpm", "--filter", "@arm-app/onboarding", "start"]
