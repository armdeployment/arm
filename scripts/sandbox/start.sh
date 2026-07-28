#!/usr/bin/env bash
# ARM Sandbox Quick Start
# Starts the proxy, dashboard, and ollama; pulls a small model if needed.
set -e

echo "╔══════════════════════════════════════════════════╗"
echo "║      ARM Sandbox — Demo Environment              ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# Check prerequisites
command -v ollama >/dev/null 2>&1 || { echo "❌ ollama not found. Install: brew install ollama"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "❌ Node.js not found."; exit 1; }

# Start ollama if not running
if ! ollama list >/dev/null 2>&1; then
  echo "▶ Starting ollama..."
  ollama serve &
  sleep 3
fi

# Pull a small model if needed
echo "▶ Checking models..."
ollama list | grep -q "tinyllama" || {
  echo "  Pulling tinyllama (1.1B, ~600MB) — one-time download..."
  ollama pull tinyllama
}
echo "  ✓ Models ready"

# Start proxy in background
echo "▶ Starting closed-proxy (port 8787)..."
cd "$(dirname "$0")/../.."
pnpm --filter @arm-app/proxy dev &
PROXY_PID=$!
sleep 2

# Start open-gateway in background (if desired)
echo "▶ Starting open-gateway (port 8788)..."
pnpm --filter @arm-app/open-gateway dev &
GW_PID=$!
sleep 2

# Start dashboard
echo "▶ Starting dashboard (port 3100)..."
pnpm --filter @arm-app/web dev &
WEB_PID=$!
sleep 3

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║  Sandbox ready!                                  ║"
echo "║                                                  ║"
echo "║  Dashboard:  http://localhost:3100               ║"
echo "║  Proxy:      http://localhost:8787/health        ║"
echo "║  Gateway:    http://localhost:8788/health        ║"
echo "║  Ollama:     http://localhost:11434              ║"
echo "║                                                  ║"
echo "║  Run simulator:                                  ║"
echo "║    pnpm tsx scripts/sandbox/agent-simulator.ts   ║"
echo "║                                                  ║"
echo "║  Stop: kill $PROXY_PID $GW_PID $WEB_PID          ║"
echo "╚══════════════════════════════════════════════════╝"

# Keep running
wait
