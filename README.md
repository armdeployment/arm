<div align="center">

# ARM — Agent Resource Management

**An HR-style control plane for AI agents:** identity, metering, routing,
budgeting, policy enforcement, and resource access — for every agent in a
company, not just the ones engineers run.

[![Guardrails](https://github.com/armdeployment/arm/actions/workflows/guardrails.yml/badge.svg)](https://github.com/armdeployment/arm/actions/workflows/guardrails.yml)
[![Typecheck](https://github.com/armdeployment/arm/actions/workflows/typecheck.yml/badge.svg)](https://github.com/armdeployment/arm/actions/workflows/typecheck.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

</div>

---

## The problem

A company buys AI agents the way it buys laptops — but has none of the
machinery it has for laptops. Nobody can answer: _Who has an agent? What
is it allowed to touch? What did it cost? Did it actually get used?_

ARM is the missing layer. An employee gets their agent in about a minute
through a wizard with no terminal, no config file, and no API key. Their
manager gets a dashboard showing adoption, spend, and approvals. Security
gets a policy engine and an audit trail. Prompt bodies never leave the
tenant's own network.

## See it work

[![ARM — the complete system, end to end](demo/arm-full-demo-poster.png)](https://github.com/armdeployment/arm/blob/main/demo/arm-full-demo.mp4)

**▶ [Play the full demo — 1:47](https://github.com/armdeployment/arm/blob/main/demo/arm-full-demo.mp4)**

The whole system in one pass: an employee installing their agent with no
terminal, a manager reading adoption and spend, the server-side component
library, and the metered data plane. Every screen in it is a real capture
from a live run against real Postgres and ClickHouse — not a mockup.

## Quick start — 60 seconds, no dependencies

No database, no Docker, no API key. Every router ships with in-memory
fixtures (`ARM_FIXTURE_MODE=1`, the default), so the whole dashboard runs
on a laptop with nothing installed but Node.

```bash
corepack enable pnpm
pnpm install
pnpm --filter @arm-app/web build && pnpm --filter @arm-app/web start
```

Open **<http://localhost:3100>**. Data flows through the real pipeline —
`Browser → tRPC → tenant middleware → data source → UI` — the only thing
swapped is what sits at the end of it.

| Prerequisite | Version              | Check     |
| ------------ | -------------------- | --------- |
| Node.js      | ≥ 22.16              | `node -v` |
| pnpm         | 11.17 (via corepack) | `pnpm -v` |

There's also a `Makefile` wrapping the common tasks, if you prefer it:
`make bootstrap` (pins pnpm via corepack), `make install`, `make dev`,
`make dev-data-plane`, `make test`, `make guardrails`, `make typecheck`,
`make lint`, `make clean`.

### Try the employee side too

```bash
pnpm --filter @arm-app/onboarding build && pnpm --filter @arm-app/onboarding start
```

Open **<http://localhost:3300>** → answer a few multiple-choice questions →
get a package recommendation and a real 6-character activation code. Then
redeem it with the installer, which opens a browser wizard rather than
asking you to type anything:

```bash
pnpm --filter @arm-app/cli run setup
```

> The `run` is load-bearing. `pnpm setup` is a **built-in pnpm command**
> that configures `PNPM_HOME` and edits your shell profile — without
> `run`, pnpm answers it itself and ARM's installer never starts.

## What you get

Every surface below can be started on its own. The two control-plane apps
are built then started; the data-plane services run straight from source.

| Surface                 | Port | Start it with                                                                        | What it is                                                              |
| ----------------------- | ---- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| Control-plane dashboard | 3100 | `pnpm --filter @arm-app/web build && pnpm --filter @arm-app/web start`               | Manager view: adoption funnel, spend, approvals, library, policy, audit |
| Employee onboarding     | 3300 | `pnpm --filter @arm-app/onboarding build && pnpm --filter @arm-app/onboarding start` | Questionnaire → package recommendation → download / activation code     |
| Public site             | 3200 | `pnpm --filter @arm-app/public dev`                                                  | Marketing + docs site (statically exported)                             |
| Data-plane proxy        | 8787 | `pnpm --filter @arm-app/proxy dev`                                                   | The metered LLM gateway agents actually call — check `/health`          |
| Artifact cache          | 8788 | `pnpm --filter @arm-app/artifact-cache dev`                                          | Content-addressed component blob delivery — check `/health`             |

```bash
# the two data-plane services, verified up
curl localhost:8787/health   # {"status":"ok","service":"closed-proxy",...}
curl localhost:8788/health   # {"status":"ok","service":"artifact-cache",...}
```

### Dashboard routes

| Route           | Description                                                         |
| --------------- | ------------------------------------------------------------------- |
| `/`             | Role home — adoption and approvals lead; spend condensed to a strip |
| `/adoption`     | Activation funnel, stall breakdown, time-to-value, coverage, gaps   |
| `/library`      | Search + facets over work packages and components (the artifactory) |
| `/assignments`  | Org tree × package assignment matrix                                |
| `/governance`   | Package budgets, approvals inbox, cost-per-work-product             |
| `/organization` | Org tree editor — add, rename, reparent, delete                     |
| `/spend`        | Cost per active seat and per work product; model mix                |
| `/access`       | Just-in-time access request approval queue                          |
| `/agents`       | Agent registry with status filters                                  |
| `/audit`        | Access audit log viewer                                             |

## Architecture

ARM splits along a hard trust boundary, and that split is the product:

```
┌─ CONTROL PLANE ────────────┐        ┌─ DATA PLANE (tenant VPC) ──────────┐
│  metadata + audit ONLY     │        │  where prompts and content live    │
│                            │        │                                    │
│  • catalog / library       │◄──────►│  • proxy — meters, gates, routes   │
│  • policy + budgets        │ config │  • artifact cache                  │
│  • adoption analytics      │  only  │  • connectors                      │
│  • approvals + audit       │        │  • meter agent                     │
└────────────────────────────┘        └────────────────────────────────────┘
```

**Prompt bodies and resource content never cross into the control plane.**
That is Invariant 1 in [`docs/arm-spec.md`](docs/arm-spec.md) §11, and it's
enforced by executable checks, not convention (see Guardrails below).

## Running against real infrastructure

The fixture mode above is for evaluating and developing. To run against
real Postgres and ClickHouse:

```bash
# 1. Start local Postgres + ClickHouse
docker compose -f infra/compose/docker-compose.dev-db.yml up -d

# 2. Apply schema + migrations
DATABASE_URL=postgres://arm:arm_dev_password@localhost:5432/arm \
  pnpm --filter @arm/db exec drizzle-kit push --force
CLICKHOUSE_URL=http://arm:arm_dev_password@localhost:8123 \
  node scripts/dev/apply-clickhouse-migrations.mjs

# 3. Seed — from the same fixtures the in-memory path uses, so both
#    modes tell the same story
DATABASE_URL=postgres://arm:arm_dev_password@localhost:5432/arm \
  node scripts/dev/seed-postgres-catalog.mjs
DATABASE_URL=postgres://arm:arm_dev_password@localhost:5432/arm \
  node scripts/dev/seed-postgres-library.mjs
CLICKHOUSE_URL=http://arm:arm_dev_password@localhost:8123 \
  node scripts/dev/seed-clickhouse-adoption.mjs

# 4. Run against it
ARM_FIXTURE_MODE=0 \
  DATABASE_URL=postgres://arm:arm_dev_password@localhost:5432/arm \
  CLICKHOUSE_URL=http://arm:arm_dev_password@localhost:8123 \
  pnpm --filter @arm-app/web dev
```

Currently wired to real databases: `adoption-router` (ClickHouse, all six
procedures), `catalog-router` (Postgres, all six), and `library-router`
(Postgres, 9 of 12 — the rest are profile-preset data by design). Every
other router still serves fixtures in both modes; that's a known, tracked
state, not a silent gap.

See [`.env.example`](.env.example) for every environment variable,
[`docs/sso-setup.md`](docs/sso-setup.md) for connecting it to your identity
provider, and [`infra/README.md`](infra/README.md) for the honest state of
each deployment path.

## How far you can take it today

ARM is pre-1.0, and it's worth being blunt about where it currently stops
so you don't discover it halfway through a rollout.

| You want to…                                      | State         | What's involved                                                                                                                                  |
| ------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Evaluate it on a laptop                           | **Works now** | The quick start above. No database, no config.                                                                                                   |
| Run it against real Postgres + ClickHouse         | **Works now** | The section above. Three routers read real data; the rest serve fixtures in both modes.                                                          |
| Pilot it with a team you control                  | **Works now** | Point it at your IdP ([`docs/sso-setup.md`](docs/sso-setup.md)), set `ARM_SETUP_TOKEN_SECRET`, accept that quota resets when the proxy restarts. |
| Deploy it for untrusted / multi-tenant production | **Not yet**   | ARM verifies IdP tokens but does not obtain them, and no admin flow provisions a tenant. See below.                                              |

**Authentication works now.** Set `ARM_OIDC_ISSUER_URL`,
`ARM_OIDC_JWKS_URL` and `ARM_OIDC_AUDIENCE` and both apps verify real
bearer tokens against your IdP's JWKS; with none of them set under
`NODE_ENV=production` they refuse every authenticated request rather than
falling back to a shared identity. `make mock-idp` lets you prove the
wiring end to end without an Okta or Entra tenant.
[`docs/sso-setup.md`](docs/sso-setup.md) has working config for Entra,
Okta and Google.

**What still gates untrusted production**, in order of how likely you are
to hit it:

- ARM verifies bearer tokens but does not run the browser login flow that
  obtains one — put a reverse proxy that does (oauth2-proxy, an ingress
  auth annotation) in front of it.
- The `groups` claim is not mapped to ARM roles yet; RBAC resolves from
  `roleTable`, so roles are assigned in ARM rather than inherited from
  your IdP.
- No tenant-provisioning or first-admin flow: tenants and org trees come
  from the industry-profile seeds in
  [`packages/profiles`](packages/profiles), not from an admin UI.
- The proxy's quota store is in memory, so a restart resets consumption.

[SECURITY.md](SECURITY.md) lists the known gaps in full. Read it before
deploying anywhere real.

## Sandbox — watch agents actually spend money

Runs simulated employees making real LLM calls through the real proxy, with
real metering, DLP gates, and priority-based quota:

```bash
ollama pull tinyllama                     # small local model, no GPU needed
bash scripts/sandbox/start.sh             # proxy, gateway, dashboard, ollama
pnpm tsx scripts/sandbox/agent-simulator.ts
```

Then watch <http://localhost:3100> populate.

## Testing and guardrails

```bash
pnpm test        # unit + integration across every workspace
pnpm typecheck   # tsc --noEmit everywhere
pnpm guardrails  # 20 executable invariant checks
pnpm lint
pnpm format:check
```

The guardrails are the unusual part. Every cross-cutting invariant in the
spec maps to a check that fails the build — content egress, tenant
isolation, artifact integrity, questionnaire determinism, least privilege.
Each security-critical one also carries a **mutation proof**: a test that
deliberately breaks the protected behaviour and asserts the check goes red,
because a guard that cannot fail is worse than no guard.

Live-database integration tests activate automatically when `DATABASE_URL`
/ `CLICKHOUSE_URL` are set, and skip cleanly when they aren't.

## Repository layout

```
apps/
  control-plane/web        Manager dashboard (Next.js)
  control-plane/api        Control-plane API surface
  control-plane/workers    Background jobs
  data-plane/proxy         Metered LLM gateway — the hot path
  data-plane/artifact-cache, connectors, meter-agent, open-gateway
  onboarding               Employee questionnaire → download
  public                   Marketing + docs site
  cli                      The `arm` client (setup, doctor, refine)
  simulation               Enterprise simulation harness
  arm-video                Remotion sources for the demo videos
packages/
  proto                    Shared wire contracts (zod) — the seam
  client-core              Client engine: manifests, install, GUI wizard
  trpc                     Control-plane routers
  profiles                 Industry presets (pure data)
  questionnaire            Deterministic recommendation engine
  artifactory, catalog, discovery, policy, auth, billing,
  classifier, clickhouse, db, config, agent-sdk
infra/                     Compose, Dockerfiles, Helm, Terraform
docs/                      Spec, guides, and dated design records
scripts/                   Guardrails, seeds, sandbox tooling
```

## Documentation

| Doc                                                                | What's in it                                                                                                                                                                                                             |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`docs/CONCEPTS.md`](docs/CONCEPTS.md)                             | The vocabulary — package, component, org node, budget, work product. Read first if a term here is unfamiliar.                                                                                                            |
| [`docs/agent-onboarding-guide.md`](docs/agent-onboarding-guide.md) | **The employee's guide.** How someone connects their agent, the connections wizard (OAuth and PAT tiers), manual setup for all four agent types, and troubleshooting.                                                    |
| [`docs/sso-setup.md`](docs/sso-setup.md)                           | **The operator's guide.** Connecting ARM to Entra, Okta or Google; what happens when you don't; and a local OIDC issuer for testing it without an IdP tenant.                                                            |
| [`docs/arm-spec.md`](docs/arm-spec.md)                             | The specification. §11 is the invariant list — start there.                                                                                                                                                              |
| [`infra/README.md`](infra/README.md)                               | What deploys today, how it was verified, and what each path still cannot do.                                                                                                                                             |
| [`docs/solutions/`](docs/solutions/)                               | Dated design records — _why_ a subsystem looks the way it does, including what was deliberately left undone                                                                                                              |
| [`docs/guides/`](docs/guides/)                                     | Design guides written _during_ the build and kept as a record. Written for the sub-agents that implemented each subsystem, so they read as work allocation ("owner agent", "wave") — useful as history, not as a how-to. |
| [`AGENTS.md`](AGENTS.md)                                           | Working agreement for both human and AI contributors                                                                                                                                                                     |
| [`packaging/README.md`](packaging/README.md)                       | Release + code-signing runbook                                                                                                                                                                                           |

## Troubleshooting

**`pnpm install` fails with ignored builds** — run it again; the
`allowBuilds` config in `pnpm-workspace.yaml` permits esbuild/sharp
postinstall scripts on the second pass.

**Port already in use** — `lsof -ti:3100 | xargs kill -9`

**Dashboard stuck on "Loading…"** — the tRPC route is dynamic; use
`pnpm build && pnpm start`, not a static file open.

**Playwright reuses a stale server** — `pkill -f next && pnpm e2e`

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Run
`pnpm typecheck && pnpm test && pnpm guardrails` before opening a PR — CI
runs the same.

## License

[Apache License 2.0](LICENSE). See [NOTICE](NOTICE).
