# ARM Control Plane Dockerfile (sandbox/demo)
# Multi-stage: build Next.js → production runner.

FROM node:22-alpine AS base
RUN corepack enable pnpm && corepack prepare pnpm@11.17.0 --activate
WORKDIR /app

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/ packages/
COPY apps/control-plane/web/package.json apps/control-plane/web/
RUN pnpm install --frozen-lockfile --prod false

COPY apps/control-plane/web/ apps/control-plane/web/
RUN pnpm --filter @arm-app/web build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/control-plane/web/.next ./apps/control-plane/web/.next
COPY --from=build /app/apps/control-plane/web/package.json ./apps/control-plane/web/
EXPOSE 3100
CMD ["pnpm", "--filter", "@arm-app/web", "start"]
