#!/bin/sh
set -e

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  ARM Enterprise Server — arm.armtest.com                 ║"
echo "║  Data-Plane Proxy + Control-Plane DB                     ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ── Wait for Postgres ──
echo "▸ Waiting for PostgreSQL..."
until node -e "
  const { Client } = require('pg');
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  c.connect().then(() => c.end()).then(() => process.exit(0)).catch(() => process.exit(1));
" 2>/dev/null; do
  sleep 1
done
echo "  ✓ PostgreSQL ready"

# ── Wait for ClickHouse ──
echo "▸ Waiting for ClickHouse..."
until node -e "
  fetch('${CLICKHOUSE_URL}/?query=SELECT%201', {
    headers: { Authorization: 'Basic ' + Buffer.from('arm:arm_dev_password').toString('base64') }
  }).then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1));
" 2>/dev/null; do
  sleep 1
done
echo "  ✓ ClickHouse ready"

# ── Initialize database ──
echo "▸ Initializing database schema + seed data..."
node_modules/.bin/tsx src/db-init.ts
echo ""

# ── Pre-warm Ollama models ──
echo "▸ Pre-warming Ollama models..."
for model in minicpm5-1b qwen3.5; do
  echo -n "  $model... "
  curl -s "${OLLAMA_URL}/v1/chat/completions" \
    -H "Content-Type: application/json" \
    -d "{\"model\":\"$model\",\"messages\":[{\"role\":\"user\",\"content\":\"OK\"}],\"max_tokens\":1}" > /dev/null 2>&1 && echo "warm" || echo "skip"
done
echo ""

# ── Start proxy ──
echo "▸ Starting ARM data-plane proxy on :8787..."
echo "  Internal: http://arm.armtest.com:8787"
echo "  Upstream: ${OLLAMA_URL}"
echo ""
exec node_modules/.bin/tsx src/proxy.ts
