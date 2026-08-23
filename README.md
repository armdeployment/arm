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

## Employee Onboarding (questionnaire → download → first value)

The employee-facing path is a web questionnaire, not a CLI role key
(D10/D11 — `docs/solutions/2026-08-21-d11-questionnaire-provisioning.md`,
`docs/guides/03-client-downloader.md`):

```bash
cd apps/onboarding
pnpm build && pnpm start   # port 3300
```

Open **http://localhost:3300** → answer a few multiple-choice questions
(no free text — Invariant 1) → get a package recommendation → download a
`.armsetup` file or a 6-character activation code. The employee's machine
then runs the ONE signed generic `arm` client (never a per-user compiled
binary — A4):

```bash
arm setup --token <jwt-or-6-char-code> --tenant-url <url>   # non-interactive
arm setup --setup-file path/to/downloaded.armsetup           # double-click target
arm setup                                                     # interactive prompt
arm setup --role <key> --tenant-url <url>                     # advanced/CI path (unchanged D9 behaviour)
arm doctor                                                    # re-run verification, print the failure taxonomy
```

Build the signed platform installer for the current OS:

```bash
node packaging/build-sea.mjs   # → packaging/dist/arm(.exe), unsigned-dev unless signing env vars are set
```

See `packaging/README.md` for the full release/signing runbook and
`docs/agent-onboarding-guide.md` for the end-to-end employee guide.

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
