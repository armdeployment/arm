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

Updated D10 (docs/guides/02-server-panels.md §1) — adoption leads, cost
moved down (A1: agent adoption at scale is the primary value prop):

| Route | Description |
|---|---|
| `/` | Role home — adoption + approvals lead, spend condensed to a strip |
| `/adoption` | Activation funnel, stall breakdown, time-to-value, coverage, gaps, recent activations |
| `/rollout` | Questionnaire designer, campaigns, download artifacts, live campaign funnel |
| `/library` | Search + facets over packages and components (replaces the retired `/catalog`) |
| `/assignments` | Org tree × package assignment matrix |
| `/governance` | Package budgets, approvals inbox, cost-per-work-product |
| `/agents` | Agent registry with status filters |
| `/spend` | Cost per active seat & per work product (primary); closed-vs-self-hosted model mix (secondary) |
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

## Local Dev Database (Wave 3 — real Postgres/ClickHouse)

Every router in this repo defaults to `ARM_FIXTURE_MODE=1` (in-memory
fixtures, no DB required) — that's what every command above uses. To run
against real databases instead (currently wired: `adoption-router.ts`'s six
procedures; `docs/solutions/2026-08-21-d10-adoption-first-restructure.md`
§8's Wave 3):

```bash
# Start local Postgres + ClickHouse (dev-only — not the enterprise
# simulation or the data-plane proxy stack, see the compose file's header)
docker compose -f infra/compose/docker-compose.dev-db.yml up -d

# Apply migrations (--force: non-interactive, fine against a fresh dev DB)
DATABASE_URL=postgres://arm:arm_dev_password@localhost:5432/arm \
  pnpm --filter @arm/db exec drizzle-kit push --force
CLICKHOUSE_URL=http://arm:arm_dev_password@localhost:8123 \
  node scripts/dev/apply-clickhouse-migrations.mjs

# Seed activation_event with data derived from the same deterministic
# fixture population adoption-router.ts uses in fixture mode, so both
# modes tell the same story. Tenant must match the caller — apps/control-
# plane/web's dev route hardcodes "tn_demo" (src/app/api/trpc/[trpc]/
# route.ts); the trpc test suite's live-ClickHouse tests default to
# d9d9d9d9-0000-4000-8000-000000000001 instead (ARM_SEED_TENANT_ID
# overrides either way).
CLICKHOUSE_URL=http://arm:arm_dev_password@localhost:8123 ARM_SEED_TENANT_ID=tn_demo \
  node scripts/dev/seed-clickhouse-adoption.mjs

# Run the dashboard against real data
ARM_FIXTURE_MODE=0 CLICKHOUSE_URL=http://arm:arm_dev_password@localhost:8123 \
  pnpm --filter @arm-app/web dev
```

`packages/trpc/test/adoption-router.test.ts`'s live-ClickHouse integration
tests (`describe.skipIf(!process.env.CLICKHOUSE_URL)`) run automatically
once `CLICKHOUSE_URL` is set — that's the regression check for this wiring.

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
