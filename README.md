# ARM — Agent Resource Management

HR-style control plane for AI agents: identity, metering, routing, budgeting, policy enforcement, and resource-access control.

Full spec: [`docs/arm-spec.md`](docs/arm-spec.md) (v0.5). Entry point for agents and humans: [`AGENTS.md`](AGENTS.md).

---

## Quick Start — Frontend Dashboard

### Prerequisites

| Tool | Version | Check |
|---|---|---|
| Node.js | ≥ 22.16 | `node -v` |
| pnpm | 11.17+ (via corepack) | `pnpm -v` |

### 1. Install dependencies

```bash
corepack enable pnpm
pnpm install
```

### 2. Start the dashboard (development mode)

```bash
cd apps/control-plane/web
pnpm build && pnpm start
```

Open **http://localhost:3100** in your browser.

The dashboard runs entirely on fixture data — no database or external services required. Data flows through the real tRPC pipeline:

```
Browser → tRPC hooks → /api/trpc → tenant middleware → fixture data → UI
```

### 3. Production build

```bash
cd apps/control-plane/web
pnpm build
pnpm start
```

Same URL: **http://localhost:3100**

---

## What You'll See

| Route | Description |
|---|---|
| `/` | Dashboard — spend stats, trend chart, model breakdown, agent table |
| `/agents` | Agent registry with status filters |
| `/spend` | Cost analysis: closed vs self-hosted, savings opportunities |
| `/access` | JIT access request approval queue |
| `/audit` | Access audit log viewer (placeholder — lands 1.1) |

---

## Testing

```bash
# All tests (unit + guardrails)
pnpm test

# Frontend unit tests
pnpm --filter @arm-app/web test

# End-to-end (Playwright — builds + starts server automatically)
cd apps/control-plane/web
pnpm e2e
```

---

## Public Site + Live Demo

`apps/public` is the marketing site (`docs/guides/04-public-site-demo.md`) — the
ninety-second story, the product deep-dive, architecture and security pages, and a
`/demo` landing page that links out to the dashboard above. Statically exported, no
external hosts besides Google Fonts, no fabricated data.

```bash
cd apps/public
pnpm build             # next build (output: "export" — writes ./out)
pnpm start             # serve ./out on http://localhost:3200

# or, for local editing:
pnpm dev                # next dev --port 3200
```

Routes: `/`, `/product`, `/architecture`, `/security`, `/demo`, `/faq`.

```bash
pnpm --filter @arm-app/public test      # vitest — content-driven component tests
pnpm --filter @arm-app/public e2e       # playwright — nav, a11y (axe), overflow, links
pnpm --filter @arm-app/public figures   # regenerate docs/figures/*.svg from src/content
```

---

## Full Monorepo Commands

```bash
pnpm install          # install all workspace deps
pnpm build && pnpm start              # start dev server (dashboard)
pnpm build            # build all packages
pnpm typecheck        # tsc --noEmit across all workspaces
pnpm test             # run all test suites
pnpm guardrails       # executable invariant checks (6 guards)
pnpm format:check     # prettier check
```

---


## Sandbox Demo Environment

Run a complete ARM demo locally with simulated agents and real metering:

```bash
# One-time: pull a small local model (no GPU needed)
ollama pull tinyllama

# Start everything (proxy, gateway, dashboard, ollama)
bash scripts/sandbox/start.sh

# In another terminal: run the agent simulator
pnpm tsx scripts/sandbox/agent-simulator.ts

# Open http://localhost:3100 to see live metering
```

The simulator spawns agents from the manufacturing org tree making realistic
requests. You'll see live metering, DLP gate enforcement, priority-based quota,
and security flags on the dashboard.

```bash
# Options
NUM_AGENTS=20 INTERVAL_MS=1000 DURATION_SEC=600 pnpm tsx scripts/sandbox/agent-simulator.ts
```

### Docker (alternative)

```bash
docker compose -f infra/compose/docker-compose.sandbox.yml up
docker exec <ollama-container> ollama pull tinyllama
pnpm tsx scripts/sandbox/agent-simulator.ts
```

## Troubleshooting

**`pnpm install` fails with ignored builds** — run `pnpm install` again after the first attempt; the `allowBuilds` config in `pnpm-workspace.yaml` permits esbuild/sharp postinstall scripts.

**Port 3100 already in use** — kill the stale process: `lsof -ti:3100 | xargs kill -9`

**Playwright reuses a stale server** — kill all next processes before running e2e: `pkill -f next && pnpm e2e`

**Browser shows "Loading…" indefinitely** — the tRPC API route (`/api/trpc`) is dynamic; ensure you're running `pnpm build && pnpm start` or `pnpm start` (not opening the HTML file directly).
