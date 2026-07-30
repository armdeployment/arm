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

# ── Pre-warm Ollama models (using node fetch — curl not in alpine) ──
echo "▸ Pre-warming Ollama models..."
node -e '
(async () => {
  const models = ["minicpm5-1b", "qwen3.5"];
  for (const m of models) {
    process.stdout.write("  " + m + "... ");
    try {
      const r = await fetch(process.env.OLLAMA_URL + "/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: m, messages: [{ role: "user", content: "OK" }], max_tokens: 1 }),
        signal: AbortSignal.timeout(120000),
      });
      console.log(r.ok ? "\u2713 warm" : "error " + r.status);
    } catch (e) { console.log("skip: " + String(e).slice(0, 50)); }
  }
})();
' 2>&1
echo ""

# ── Start proxy ──
echo "▸ Starting ARM data-plane proxy on :8787..."
echo "  Internal: http://arm.armtest.com:8787"
echo "  Upstream: ${OLLAMA_URL}"
echo ""
exec node_modules/.bin/tsx src/proxy.ts
