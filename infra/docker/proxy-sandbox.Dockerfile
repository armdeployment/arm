FROM node:22-alpine
RUN corepack enable pnpm && corepack prepare pnpm@11.17.0 --activate
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/ packages/
COPY apps/data-plane/proxy/package.json apps/data-plane/proxy/
RUN pnpm install --frozen-lockfile
COPY apps/data-plane/proxy/src/ apps/data-plane/proxy/src/
ENV PROXY_PORT=8787
EXPOSE 8787
CMD ["pnpm", "--filter", "@arm-app/proxy", "exec", "tsx", "src/index.ts"]
