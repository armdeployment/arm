FROM node:22-alpine

# ARM Data-Plane Server container — hosts the proxy + DB init.
# Runs on armtest.com internal network.
#
# proxy.mjs + db-init.mjs are esbuild bundles (built on the host from the
# monorepo with workspace packages @arm/profiles + @arm/classifier inlined).

WORKDIR /app

# Install runtime dependencies
RUN npm init -y && npm install pg@^8.13.0 && npm install --save-dev tsx@^4.20.0

# Copy esbuild bundles (workspace deps inlined — container needs no monorepo)
COPY dist/proxy.mjs src/proxy.mjs
COPY dist/db-init.mjs src/db-init.mjs

# Entrypoint: wait for DBs, init schema, warm models, start proxy
COPY docker/arm-server-start.sh /start.sh
RUN chmod +x /start.sh

CMD ["/start.sh"]
