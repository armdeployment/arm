# ARM schema migration runner.
#
# infra/README listed "no migration runner in the deploy path — schema is
# applied by the scripts the root README documents, by hand" as a known gap.
# This is that runner: the same three steps the README documents, in one
# image, so a deploy can apply them as a Helm pre-install/pre-upgrade hook
# instead of relying on someone remembering.
#
# It is deliberately the SAME scripts rather than a reimplementation. A
# migration path that diverges from the one developers run locally is a
# migration path nobody has tested.

FROM node:22-alpine AS base
RUN corepack enable pnpm && corepack prepare pnpm@11.17.0 --activate
WORKDIR /app

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/ packages/
RUN pnpm install --frozen-lockfile --prod false
COPY scripts/ scripts/

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/package.json /app/pnpm-workspace.yaml ./

# Entry is the script, not a shell one-liner, so a failure in either step
# fails the Job rather than being swallowed by `&&` semantics.
COPY infra/docker/migrate-entrypoint.sh /usr/local/bin/arm-migrate
RUN chmod +x /usr/local/bin/arm-migrate
CMD ["/usr/local/bin/arm-migrate"]
