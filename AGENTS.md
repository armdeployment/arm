# AGENTS.md

Agent entry point for ARM. Read this first, then follow links for depth.

## What This Project Is

ARM (Agent Resource Management) is an HR-style platform for AI agents: identity, metering, routing, budgeting, policy enforcement, and resource-access control for every LLM agent an organization spawns. Hybrid deployment: SaaS control plane + per-tenant data plane in the customer VPC.

`docs/arm-spec.md` (spec v0.1) is the **source of truth** until code lands.

## Status

Pre-1.0. The repo currently contains specification and governance documents only; code lands per the phase plan in `docs/arm-spec.md` §9. Sections marked *(target)* describe intended state.

## Repository Map

```
.
├── docs/
│   ├── arm-spec.md          # Product + architecture spec (source of truth)
│   ├── open-decisions.md    # Decisions to lock: D1 multi-tenant, D2 classification gate, D5 policy-cache SLA
│   ├── permission-rules.md  # Tiered-delegation / deny-override contract
│   ├── CONCEPTS.md          # Shared domain vocabulary
│   ├── solutions/           # Dated decision/solution records (target)
│   └── figures/             # Rendered diagrams
└── AGENTS.md                # This file
```

Full target layout (apps, packages, infra, guardrails, tests): spec §15.

## Non-Negotiable Invariants

Summary — full wording in spec §11:

1. Prompt bodies + resource content **never** leave the tenant VPC. Control plane is metadata + audit only.
2. One agent identity, two stable IDs (`sub_account_id` ↔ `agent_id`, linked 1:1).
3. Higher-level deny always wins ("higher" = closer to the Org root).
4. Short-lived credentials everywhere credentials are minted.
5. Hybrid IdP: ARM-issued OIDC where federated; sealed tenant vault where not.
6. ClickHouse partitioned by `(tenant_id, toYYYYMM(ts))` from day 1.
7. Every agent has exactly one accountable human stakeholder (`stakeholder_user_id`).
8. Priority is policy, not self-declared; elevated tiers require scope-admin approval.

These are enforced as **executable guardrails** (spec §14.1), not prose. Never merge a change that weakens an invariant without updating the spec and the guardrail in the same PR.

## Architecture Rules

### Dependency Direction *(target)*

```
packages/proto → packages/config → packages/{db,clickhouse,policy,billing,auth} → packages/trpc → apps/*
```

- `packages/proto` has zero internal imports (zod contracts only).
- Data-plane apps must not import control-plane-only packages; shared code crosses only via `proto`/`config`.
- Enforced by `scripts/guardrails/boundaries` *(target)*.

### Trust Boundaries

- Agent → data plane: full LLM wire protocol + resource IO with scoped tokens.
- Data plane → control plane: **metadata-only** events over mTLS (boundary table: spec §3.3).
- Dashboard viewers: aggregates only — never prompts, content, or secrets.

## Working Agreements

- **Spec travel rule**: changes to architecture, data model, API surface, or invariants update `docs/arm-spec.md` (and derived docs) in the same PR.
- **New named concepts** go into `docs/CONCEPTS.md` when introduced.
- **Decisions**: pending ones live in `docs/open-decisions.md`; resolved ones get a dated record in `docs/solutions/` (frontmatter: `title`, `date`, `status`, `supersedes`).
- **Guard quality**: every security guardrail needs a **mutation proof** (break the protected thing, watch the guard go red, restore byte-identically). Guards asserting a negative must fail loudly on empty input — a lint that scans zero files is red, not green.
- **Secrets**: never commit, print, or summarize secret values. `.env*` files are ignored local state. Do not fabricate credentials; when blocked by missing credentials, run the non-credentialed checks you can and report the credential gate explicitly.
- **Merge authority is explicit and non-delegable**: never merge a PR, enable auto-merge, or take any equivalent action unless the user explicitly requested that exact action in the current conversation. Report the ready state instead.
- **Before starting work**: check for parallel/duplicate work (`git branch -a`, open PRs).

## How to Run *(target — lands with 1.0)*

```bash
pnpm install
make dev             # control-plane web + api (local)
make dev:data-plane  # docker-compose data plane (single node)
make test            # unit/integration
make guardrails      # executable invariant checks (mutation-proofed)
```

## CI Checks *(target)*

| Workflow | Trigger | What it checks |
|---|---|---|
| `typecheck.yml` | PR + push to main | `tsc --noEmit` across workspaces |
| `guardrails.yml` | PR + push to main | Invariants-as-code (spec §14.1) |
| `contract-check.yml` | PR (schema changes) | Generated types match committed output |
| `security-audit.yml` | PR + daily cron | Dependency advisories; baselined entries carry justification |

This table is kept in sync with `.github/workflows/*` by a CI check once workflows exist.

## External References

- [Spec](docs/arm-spec.md) — architecture, data model, phases, risks, guardrails
- [Open decisions](docs/open-decisions.md)
- [Permission rules](docs/permission-rules.md)
- [Concepts](docs/CONCEPTS.md)
