FROM node:22-alpine

# ARM Data-Plane Server container — hosts the proxy + DB init.
# Runs on armtest.com internal network.

WORKDIR /app

# Install runtime dependencies
RUN npm init -y && npm install pg@^8.13.0 && npm install --save-dev tsx@^4.20.0

# Copy source files
COPY src/proxy.ts src/proxy.ts
COPY src/db-init.ts src/db-init.ts

# Entrypoint: wait for DBs, init schema, warm models, start proxy
COPY docker/arm-server-start.sh /start.sh
RUN chmod +x /start.sh

CMD ["/start.sh"]
