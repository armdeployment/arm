---
title: "D9: Work Packages — role-scoped agent tool bundles for governance + zero-friction employee onboarding"
date: 2026-08-13
status: proposed
supersedes: none
---

# D9: Work Packages (Tool Registry + Role Bundles + One-Command Provisioning)

## Decision

**A Work Package is a versioned, role-scoped bundle of everything an employee's agent needs to do their job** — MCP tools, skills, sub-agent configurations, permission grants, model-routing policy, budget template, starter prompts, and document templates — materialized from Industry Profile presets (D6 pattern), copy-on-provisioning (D7 lock), and distributed through an extended `/.well-known/arm-agent` manifest plus a one-command `arm setup` CLI. Tools become first-class entities in a **Tool Registry** with per-tool authorization (`tool:action` verbs, extending D8). Work Packages ship in **two modes**: *automated agent* (scope-owned, runs unattended) and *copilot mode* (employee-adjacent, human-in-the-loop — the default for every human job role). The package is the unit of governance: budgets, approvals, metering, and `cost-per-work-product` telemetry all roll up by package.

The product requirement this serves, verbatim from the requester: **management must be able to govern AI usage across automated and copiloted agents per employee/job function, and every employee — including non-technical lower/middle/upper management — must be able to start using a correctly-configured agent (opencode pre-installed with MCPs, skills, sub-agents, permissions) in minutes, without writing a single config file.**

## Context

ARM today provisions *agents*, not *roles*. The pieces exist but nothing ties them into an employee-facing unit:

- **`arm agent init`** (§8.1, `apps/cli`) detects agent type and writes a minimal LLM-routing config — but installs **no tools, no skills, no permissions, no role defaults** (`docs/agent-onboarding-guide.md` is 143 lines of manual config for the bare minimum).
- **`secondaryTagPresets`** (`tool:*`, `resource:*` strings in profile taxonomies) are seeded but **never read at runtime** — they hint at tool bundles without being one.
- **Resource catalog + connectors** (`proxy|mint|sync`) is the closest architectural analog to a tool registry, but covers data stores, not tools.
- **Role presets (D8)** carry permission bundles but are not linked to any tool/skill provisioning.
- **Budgets** are scoped to org-tree nodes, not roles or work types; **there is no per-tool authorization** — `docs/solutions/competitive-analysis.md:229` already flags "Add MCP registry + per-tool authorization" as the fastest-closing enterprise gap.
- Phase 4 of the spec defers first-party agent plugins; D9 pulls the governance-critical half of that forward.

Meanwhile, the OEM research (`docs/research/oem-job-taxonomy.md`, `oem-work-package-design.md`, `token-cost-optimization.md`) produced ~250 job types across 20 functions with per-role daily-work/tool/token profiles — the seed content for package presets — and identified **cost-per-work-product** (`$/8D`, `$/PPAP`, `$/PLC routine merged`) as the enterprise metric that turns ARM from a metering tool into a governance moat.

## Options considered

### (a) Tool Registry only — publish MCP servers, let tenants hand-assemble bundles

Solves per-tool authorization but not ease-of-use: every employee still edits config files, and management still has no unit to govern. **Rejected as the primary shape** (the Registry is kept as a sub-component of (b)).

### (b) Work Packages — role-scoped preset bundles + Tool Registry + one-command provisioning — **RECOMMENDED**

Packages are data, not code, following the D6 governing rule (**presets set defaults, never gate capabilities**): every tool, skill, and template in a package is something any tenant could assemble; the package just makes it one click. Copy-on-provisioning follows the D7 lock: editing a preset never mutates an installed package; version bumps trigger guided upgrades.

### (c) Agent-side config only (no server-side package entity)

Config templates could live purely in the CLI. **Rejected**: without a server-side `work_package` entity there is nothing to meter against, budget, approve, audit, or benchmark — governance would be unenforceable prose.

## Rationale

1. **The package is where governance and ease-of-use meet.** Management governs by approving/publishing package versions, setting per-package budgets and tool allowlists, and reading `cost-per-work-product` dashboards. Employees never see any of it: they run `arm setup`, pick their role, and get a working agent. One entity, two audiences, zero config files for the employee.
2. **HR-style provisioning is the mental model the market already has.** A new hire is assigned a role; the role brings an agent toolkit. `stakeholder_user_id` (invariant 7) maps naturally: every copilot package is bound to a human employee; every automated package to an accountable owner.
3. **Metering economics demand the unit.** Token cost concentrates in doc-heavy and codegen roles (research: High-token families = CAE, safety/cyber, legal, calibration, 8D/PPAP). A per-package budget + routing profile (cheap models for volume roles, frontier only for reasoning steps) delivers the 70–85% savings stack in `token-cost-optimization.md` — none of which is expressible without a package entity.
4. **It converts the D7 work-type stream into money.** `work_type` labels per package enable routing rules and budget reservations keyed on actual work, closing the D7 Phase 1.4+ promise with a concrete enforcement surface.
5. **Moat via accumulated config.** Per-role routing policies, fine-tuned small models per package, canonical prompt caches, and per-unit benchmarks accumulate in ARM and cannot be ported. Cross-tenant anonymized benchmarks ("your $/8D is 3.2× cohort median") are only publishable with a normalized package taxonomy.

## Consequences

### Data model (§4.1 delta)

New control-plane tables, all `tenant_id`-carrying:

- `tool(id, tenant_id, name, kind ['mcp','http_api','cli','connector'], endpoint, auth_strategy, data_classification, owner_user_id, review_status, pricing_hint)`
- `tool_version(tool_id, version, manifest_sha256, config_schema, changelog)` — immutable; packages pin exact versions
- `work_package(id, tenant_id, role_key, name, family, mode ['automated','copilot'], description)`
- `work_package_version(package_id, version, tools[{tool_id, tool_version, scopes}], skills[], subagent_configs[], permissions[], model_routing, budget_template, starter_prompts[], template_refs[], min_agent_version)`
- `package_assignment(id, tenant_id, package_version_id, assignee_type ['user','agent','org_node'], assignee_id, status ['requested','approved','active','revoked'], approver_user_id, approved_at)`
- `tool_grant` — or extend `permission_grant` with `tool:*` verbs (D8 extension); deny-override applies unchanged (invariant 3)

`token_usage_event` gains (Phase 1.5+, additive columns): `package_id`, `package_version_id`, `steps UInt16`, `tool_calls UInt16`, `cache_read_tokens UInt64`, `semantic_cache_hit UInt8` — the substrate for per-unit cost attribution.

### Provisioning & agent runtime

- `arm setup` (extension of `arm agent init`): SSO → role picker (from the employee's org-tree node + assigned packages) → auto-detect/install agent runtime (opencode first) → fetch package manifest from control plane → write runtime config (MCP servers with short-lived scoped tokens, skills, sub-agents, permissions) → verify a metered round-trip. Zero manual config for the employee.
- **Client artifacts (one engine, three shapes):** ARM Desktop (`arm_client.exe`/`.app`/`.deb` — the default for non-technical employees), the `arm` CLI (headless, CI/fleet), and MDM packages (Intune/Jamf/winget/homebrew) for org-wide silent rollout — all built on `packages/client-core`. A **connections wizard** inside the client resolves third-party credentials per package tool: Tier A one-click OAuth where federated (Jira/GitHub/Google/BigQuery/AWS SSO), Tier B server-pushed step-by-step guides for PAT/service-account flows; secrets never land in config files (OS keychain or tenant-vault broker, invariants 4/5). Full UX + distribution spec: roadmap doc §5.
- `/.well-known/arm-agent` manifest gains a `packages` section (package id, version, integrity hash, min runtime version) so runtimes can self-update.
- Plugin-ingest registers opencode as a first-class metered runtime with package-aware config writing.
- Automated-mode packages provision scope-owned agents server-side (existing §8.5 lifecycle) with the package's permission + budget template.

### Governance surface

- Per-package budgets + per-work-type reservations (closes D7 Phase 1.4 item); package-level `llm_policy` (allowed models, auto-downgrade, per-agent day caps).
- Tool request flow: employee requests a tool → scope-admin approves → `package_assignment` update (approval inbox + webhook, mirroring §6.4 JIT).
- Dashboards: package utilization per org node, `$/work-product` with rework-rate counterweight, savings ledger (causally-attributed), approval inbox, plain-language policy editor for non-technical managers.

### Guardrails (§14.1 additions)

- `package-integrity`: every package version pins existing tool versions; templates/skills are content-addressed (sha256); no dangling references. Mutation-proofed.
- `package-least-privilege`: a package's permissions must not exceed its role preset baseline plus explicit per-tenant grants (deny-override applies).
- `tool-endpoint-scope`: tool endpoints must be tenant-VPC or approved SaaS tagged with data classification — connects tools to the invariant-1/D2 classification gate; a `restricted`-data tool is never callable from a closed external model.
- `package-drift`: installed package versions must trail the preset release channel by ≤ N versions or surface a guided upgrade (mirrors policy-cache freshness, D5).

### Phase plan (summary — full roadmap in `2026-08-13-work-package-roadmap.md`)

- **Phase 1.5 — Work Package foundation:** Tool Registry + package tables, profile presets (10 pilot packages seeded from OEM research), CRUD + guardrails, dashboard page, budget/reservation schema extension. No provisioning yet.
- **Phase 1.6 — One-command provisioning + copilot mode:** `arm setup` with role packages, scoped-token minting, opencode config writer (MCP + skills + sub-agents + permissions), plugin-ingest metering, template gallery, chat-first onboarding UX. Pilot: 5–10 roles × real employees.
- **Phase 1.7 — Governance loop:** per-package budgets + approvals + `$/work-product` dashboards + savings ledger + benchmarks; pilot expansion; re-attestation cadence.

## Sub-decisions to lock

1. **Package granularity:** role-level packages (e.g. `quality_engineer`) with family-level variants (`quality_engineer_plant` vs `_supplier`), never per-person. Recommend role-level as the default; per-person deltas via assignment overrides, not package forks.
2. **First runtime:** opencode is the reference implementation (MCP + skills + sub-agents + permissions config all first-class). Claude Code and Copilot follow after the opencode path is proven.
3. **Tool authorization verbs:** `tool:invoke`, `tool:configure`, `tool:publish` (D8 extension); deny-override + inheritance unchanged.
4. **Approval defaults:** copilot-mode tool requests auto-approve for `public`-data tools; `internal`+ require scope-admin; `confidential`+ require scope-admin + stakeholder sign-off (same tiered-delegation spirit as D8).
5. **Pilot package set (10):** `quality_engineer` (8D/PPAP/SPC), `sqe_supplier_quality` (VDA 6.3/SCAR), `plc_programmer` (TIA/Studio5000 codegen), `maintenance_technician` (fault→fix→CMMS loop), `material_planner` (MRP exception triage), `production_supervisor` (shift reports/andon), `warranty_analyst` (claims/early-warning), `data_analyst_plant` (historian/SPC), `office_worker_general` (chat + docs + SharePoint — the volume default), `exec_assistant` (KPI briefings/approvals inbox). Full specs in the roadmap doc.
6. **Metering granularity:** one `package_version_id` per event + per-task `steps`/`tool_calls`; `$/work-product` computed from work-type-labeled tasks, not raw prompts.

## Doc-update obligations

- `docs/arm-spec.md`: §1.3 (copilot mode + work packages), §4.1 (new tables), §4.2 (event columns), §6.2/6.3 (tool authorization verbs), §6.4 (tool request approval), §8.1 (arm setup flow), new §8.6 (package lifecycle), §9 (phases 1.5–1.7), §14.1 (four new guardrails), §15 (repo layout: `packages/catalog`).
- `docs/CONCEPTS.md`: add **Work Package**, **Tool Registry**, **Copilot Mode**, **Package Assignment**, **Cost-Per-Work-Product**.
- `docs/open-decisions.md`: D9 entry (this record).
- `docs/solutions/competitive-analysis.md`: note the differentiator (role-scoped tool bundles with per-tool authorization + per-unit cost benchmarks — no incumbent sells the pair).
- `docs/agent-onboarding-guide.md`: rewrite as the `arm setup` user-facing flow (the current manual-config version becomes the fallback/advanced path).
