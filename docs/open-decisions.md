# Decision Log — D1/D2/D5 locked 2026-07-26; D6/D7 proposed 2026-08-02; D9 proposed 2026-08-13

Captured from spec reviews (`docs/arm-spec.md`). These are design-level decisions that ripple across components and cannot be patched with prose alone; they need a sign-off. Each item lists the blocking phase, why it matters, and the decision frame.

**Status: D1/D2/D5 LOCKED on 2026-07-26** (resolutions inline; spec v0.3 reflects them — §3.4, §4.1, §5.1, §6.5). **D6 PROPOSED 2026-08-02** — pending architecture + product sign-off; full write-up in `docs/solutions/2026-08-02-d6-industry-profile.md`. **D7 PROPOSED 2026-08-02** — requester answers locked (per-department/plant taxonomies, enforcement-ready, per-prompt); full write-up in `docs/solutions/2026-08-02-d7-work-type-classification.md`. **D9 PROPOSED 2026-08-13** — Work Packages (role-scoped tool bundles + Tool Registry + one-command provisioning); full write-up in `docs/solutions/2026-08-13-d9-work-packages.md`, roadmap in `docs/solutions/2026-08-13-work-package-roadmap.md`, research inputs in `docs/research/`.

## D1 — Multi-tenant isolation model [blocks 1.0 schema] ✅ DECIDED (2026-07-26): option (b)

**Problem.** The control plane is SaaS multi-tenant and ClickHouse is partitioned by `tenant_id` (invariant 6, non-negotiable). But the Postgres OLTP schema (§4.1) only carries `tenant_id` on `Resource` and `DelegateKey` — the org tree, `User`, `Agent`, `PermissionGrant`, `Budget`, `LLMPolicy`, `ResourceRole`, etc. have **no `tenant_id`**. The risk table lists "mandatory tenant filter on all queries" (§12), yet the schema can't express that filter for most tables.

**Why it matters.** Row-level isolation is unenforceable as written; every Drizzle query and every ClickHouse join depends on it. This is foundational — wrong here means a security incident class, not a refactor.

**Decision frame — pick one:**

- **(a) `Organization == Tenant`** (1:1). Then `Organization.id` is the tenant boundary; every child table inherits `org_id` (= `tenant_id`). Simplest; one org per tenant.
- **(b) `Tenant` sits above `Organization`** (SaaS hosts multi-org tenants / holding companies). Add a `Tenant(id, …)` entity and `tenant_id` FK on `Organization` plus every multi-tenant table.

Either way: **`tenant_id` must propagate to every multi-tenant table** (org tree, users, agents, sub-accounts, grants, roles, budgets, LLM policies, connectors). Recommend a Repo-level lint: every Drizzle table that is not global/system must have a non-null `tenant_id` column and every query must filter on it ( enforcement via a tRPC middleware-scoped `where`).

**Update (2026-07-26):** the enforcement mechanism is now planned regardless of which option is chosen — `guardrails/tenant-isolation` schema lint + tRPC tenant-scope middleware with cross-tenant fixtures (spec §14.1), mutation-proofed per §14.2.

**Decision needed by:** start of 1.0 schema work.
**Owner:** architecture + InfoSec.

**Resolution (2026-07-26): option (b) — `Tenant` above `Organization`.** Key question asked at lock time: does (b) still allow big enterprises to self-host while small companies use ARM's SaaS? **Yes — (b) is deployment-neutral.** The schema choice determines what multi-tenancy the database can _express_; the delivery model determines _where the control plane runs_. Self-hosted enterprise is the degenerate single-tenant case of the same schema (one `Tenant` row, same guardrails, not a fork): the ARM-operated multi-tenant SaaS control plane serves small/mid companies, while a customer-operated control plane + data plane serves regulated enterprises. (b) also pairs naturally with pass-through master keys for the self-hosted tier (§13 Open Item 2) — in that deployment ARM-the-vendor holds nothing, which is exactly what regulated buyers want. Option (a) would have made self-hosting marginally simpler but foreclosed multi-org tenants (holding companies, MSPs, business units) on SaaS with no clean upgrade path. Spec changes: §3.4 (delivery models), §4.1 (`Tenant` entity + `tenant_id` propagation note), ER diagram, §13 item 2 note.

---

## D2 — Classification→LLM-routing gate enforcement point [blocks 1.4 claim] ✅ DECIDED (2026-07-26): option (a)

**Problem.** §5.1/§6.5/§11 (invariant 1) call classification-gates-LLM-routing "the single bidirectional link between the LLM and access policy domains," and §1.4 ships "classification tag enforcement on LLM routing" in Phase 1. But:

- Invariant 1: prompt bodies never leave the tenant VPC; control plane is metadata-only.
- DLP content inspection is deferred to Phase 2 (§6.5, §13).
- No user flow (§8.x) shows the gate firing; §8.4's LLM lifecycle has no classification check.

So **where does the gate fire in Phase 1?** Without content inspection, nothing in Phase 1 can both _know_ a resource's classification _and_ gate an LLM call.

**Why it matters.** Phase 1 claims a security linkage it cannot currently enforce. Implementers would either ship a no-op or bolt on ad-hoc content scanning (violating invariant 1 if it touches the control plane).

**Decision frame — pick the Phase-1 enforcement point:**

- **(a) Connector-return tagging (recommended):** when a resource connector returns content to the agent, the data plane tags the agent's _working context_ with `max(classification) seen`. The Closed-Proxy / Open-Gateway consult this tag at call time and refuse closed-external-model routing while the agent holds `confidential+` context. Stays entirely in the tenant VPC (invariant 1 preserved); no content inspection — only classification metadata carried.
- **(b) Defer the linkage to Phase 2** alongside DLP. Then remove the "Phase 1 ships classification enforcement" claim from §1.4 / §5.1 / §6.5 and mark invariant "single bidirectional link" as Phase 2.

**Decision needed by:** start of 1.4.
**Owner:** architecture + InfoSec.

**Resolution (2026-07-26): option (a) — context tagging at vend/return.** One refinement surfaced during write-up: for _mint_-strategy connectors (S3/GCS/SharePoint) ARM never sees the agent→resource bytes, so tagging must fire at **credential-vending** time (the grant implies imminent access); for _proxy_-strategy connectors (DB/internal) it fires at **response** time. The per-agent `classification_context` is session metadata held in the data plane with a sliding ~30-min TTL; gate decisions emit `access_audit_event(decision=deny, reason="classification_gate")`. Full mechanism: spec §6.5. `permission-rules.md` §3 updated accordingly.

---

## D5 — Policy-cache invalidation semantics & staleness SLA [blocks 1.3] ✅ DECIDED (2026-07-26): option (b) primary, (a) deferred

**Problem.** The data plane enforces quota + `allowed_models` against a **policy cache** (§8.4: `P->>PE: check quota + allowed_models` reads the cache, not the control plane). Invariant 3 ("higher-level deny always wins") is meaningless against a stale cache — a newly added Org-level `DENY` has an enforcement gap until the cache refreshes. That gap = policy bypass window for a security-gating system.

**Why it matters.** Undefined staleness is a silent bypass. "Action item 3" in spec §13 decides _fail-open/closed when the control plane is unreachable_, but unresolved is _what happens in the steady state between pushes_.

**Decision frame — specify the contract:**

- **Invalidation** (pick):
  - **(a) Push on change:** control plane pushes invalidation to data plane on every policy mutation (`LLMPolicy`, `PermissionGrant`, `Budget`). Requires a durable control→data-plane notification bus + ack.
  - **(b) TTL pull + change token:** data plane pulls every `N` s, plus a monotonically increasing `policy_version` checked on every call to detect mid-TTL mutations.
- **Staleness SLA** (pick): hard cap on max permissible staleness for `DENY`-class rules (e.g., ≤5 s) vs `ALLOW`/quota rules (e.g., ≤60 s). **DENY must propagate faster than ALLOW** — recommend asymmetric TTL or per-rule-class push.
- **Conflict:** if cache is older than SLA and control plane is unreachable, follow Open Item 3 (fail-closed for access, fail-open only for _metering emission_, never for quota/DENY).

**Decision needed by:** end of 1.2 (so the 1.3 permission engine can build against it).
**Owner:** architecture + InfoSec.

**Update (2026-07-26):** freshness monitoring is now planned either way — the data plane reports `policy_version` + `last_refresh` on every pull, and a control-plane health surface flags caches stale beyond SLA (spec §14.1, adopted from worldmonitor's seed-metadata freshness pattern).

**Resolution (2026-07-26): option (b) pull-first, (a) push deferred to Phase 2+ — recorded as a reasoned pushback on the initial (a) preference.** The reliability intuition inverts under analysis: push's worst case is _unbounded_ — a missed invalidation (dropped long-lived stream, NAT timeout, customer proxy killing idle connections) leaves stale policy in force indefinitely, and any robust push design needs a pull backstop anyway. Pull's worst case is _bounded_ — staleness can never exceed TTL + pull latency, and it self-heals every cycle. Operational surface also favors pull: the data plane already maintains outbound mTLS to the control plane for metering, so pull adds zero inbound connectivity into customer VPCs (a real advantage in enterprise security review), while push requires a fleet of per-tenant long-lived streams to monitor and fail over. Where push genuinely wins is latency, not reliability — so it is kept as a Phase 2+ optimization layered on the same channel, never replacing the pull. **Contract:** 10 s pull interval; monotonic `policy_version`; DENY-class propagation SLA ≤15 s; ALLOW/quota ≤60 s; past-SLA + unreachable control plane → fail-closed for DENY-class (Open Item 3). Spec §5.1 updated. Revisit if Phase 1 field data shows 15 s deny propagation is too slow.

---

## D6 — Industry profile: preset vs runtime mode [blocks tenant onboarding + manufacturing-fit] 🔶 PROPOSED (2026-08-02)

**Problem.** The seed tenant is already manufacturing-flavored (Acme Manufacturing Corp; CNC toolpath / defect / demand-forecast agents), and the governance engine is industry-neutral — yet several dimensions that differ between a tech company and a manufacturer are _hardcoded_: DLP patterns in `apps/simulation/src/proxy.ts`, personas in spec §2, demo data in `apps/control-plane/web/src/lib/mock-data.ts`, classification ranks as a single axis. The natural product ask is a user-facing selector: "Manufacturing mode" vs "Tech mode." The question is the right _shape_: a runtime `mode` enum that branches behavior, or a provisioning preset of defaults.

**Why it matters.** This sets the pattern for all vertical expansion. A runtime mode creates `if (mode === …)` across proxy/policy/UI, couples behavior to tenant identity, doesn't scale past two industries (healthcare/finance are already on the roadmap — `docs/solutions/competitive-analysis.md`), and forces hybrid companies (tech + hardware, manufacturer + software org) to lose one flavor's defaults. The decision also implies a data-model change (`tenant.industryProfile`) and a guardrail to prevent drift — wrong here means a refactor across every enforcement path.

**Decision frame — pick one:**

- **(a) Runtime `mode` enum on Tenant**, branches in code. Simple to conceptualize; single switch.
- **(b) Industry Profile — declarative preset applied at provisioning (data, not code).** A bundle of default config (role catalog, classification taxonomy, resource-type allowlist, DLP patterns, tier display names, budget-period presets, persona→home-panel mapping, seed agents). Selected in an onboarding wizard at tenant creation; materialized as per-tenant config rows. Runtime reads config, never `mode`; UI may _display_ the profile. **(recommended)**
- **(c) Hybrid** — (b) for behavioral config + a registry-driven `uiExperience` label for presentation only. Specialization of (b).

The governing rule under (b): **everything that makes ARM good for manufacturing is a capability every tenant could have; the profile only sets defaults, never gates a capability.** This keeps hybrid companies first-class and scales to N industries with no new branching. Orthogonal to existing axes (any profile × any delivery model §3.4 × any tier). Manufacturing becomes the first preset to exercise OT resource types, plant/line/shift scoping, dual-axis classification (sensitivity + regulatory flag), shift-aware stakeholder routing, and offline policy TTL.

**Sub-decisions to lock with the main one:** (1) switchable after provisioning? → recommend no (re-seed + migration), use Custom for à-la-carte; (2) does profile gate capabilities? → no; (3) first-preset set → Tech + Manufacturing + Custom only; (4) selector location → tenant-creation onboarding wizard, one-time; (5) N>2 industries → mechanism scales, do not pre-build.

**Decision needed by:** start of tenant-onboarding work / manufacturing-fit slice.
**Owner:** architecture + product.

**Resolution (2026-08-02): PROPOSED — option (b), not yet locked.** Full rationale, comparison table (the ~10 dimensions that differ), phased plan (quick-win preset chooser → clean target with capabilities fully decoupled), consequences, the `guardrails/no-profile-branching` mutation-proofed guard, and doc-update obligations live in `docs/solutions/2026-08-02-d6-industry-profile.md`. Sign-off pending.

---

## D7 — Work-type usage classification: per-prompt tagging for gating + governance [blocks 1.1 dashboard + work-type gate] 🔶 PROPOSED (2026-08-02)

**Problem.** ARM classifies _data sensitivity_ per resource (§6.5, D2) and assigns each agent a _static_ `taskType` (§1.3) — but nothing classifies what each prompt actually _does_. Management can't answer "how are agents being used, by work category, per department/plant?", and future work-type-aware routing/governance has no substrate. Naive fixes fail the requirements: an LLM judge per call costs tokens on 100% of traffic (forbidden) and blows the §5.2 latency budget; rules-only covers ~60% and misses free-text intent.

**Why it matters.** This is a spec §1.3 differentiator (department-level work-type classification) that today exists only as static agent metadata, and research (2026-08-02) confirms no production gateway does free server-side per-request work-type tagging. It also sets the schema for `token_usage_event` — the enforcement path (gating) is Phase 1.4+, so the event model must be built enforcement-ready now or a migration is needed later.

**Decision frame — pick the classification mechanism + locking the three requester answers:**

- **(a) LLM-as-judge per prompt** — rejected: token cost on 100% of traffic, 200–500 ms added latency, drift makes future gating undeterministic.
- **(b) Rules/regex only** — rejected as sole mechanism (~60% coverage); kept as cascade stage 1.
- **(c) Zero-LLM cascade (recommended): structural freebies → prompt-hash label cache → fastText/linear classifier (µs–1ms, F1 0.85–0.92) → embedding centroid only on low confidence → async sampled LLM judge for QA (1–5%, batch).**
- **(d) Session-level classification (Codex TaskKind)** — rejected as the unit: per-prompt is required (a session spans many work types; gating needs the prompt label). Sessions remain a rollup dimension only.

**Requester answers (locked 2026-08-02):** (1) taxonomy is **per-department/per-plant presets + custom labels from day 1** (one tiny model per taxonomy, selected by the agent's scope — follows the D6 preset-never-gates rule); (2) **enforcement-ready** — the tag stream feeds work-type gating + governance later; events carry `classifier_version`/`confidence`/`stage` and `unknown` is stored as-is (fail-closed per policy at gate time, never guessed); (3) **per-prompt** granularity — every metered LLM call gets its own tag.

**Decision needed by:** start of 1.1 dashboard work (tag emission) / 1.4 (gating rules).
**Owner:** architecture + product + InfoSec (for the gate contract).

**Resolution (2026-08-02): PROPOSED — option (c), requester answers locked, not yet signed off.** Full mechanism, cost/latency table, `token_usage_event` column deltas, `WorkTypeTaxonomy` table, guardrails, phased plan (1.0: tagging only; 1.4+: gating), sub-decisions (label cardinality, taxonomy edit policy, confidence thresholds, cache placement, QA rate), and doc-update obligations live in `docs/solutions/2026-08-02-d7-work-type-classification.md`.

---

## D9 — Work Packages: role-scoped agent tool bundles for governance + zero-friction employee onboarding [blocks 1.5+ work packages] 🔶 PROPOSED (2026-08-13)

**Problem.** ARM provisions _agents_, not _roles_. `arm agent init` writes a minimal LLM-routing config but installs no tools, skills, permissions, or role defaults — every employee hand-edits config files, and management has no unit to govern (budgets are org-node-scoped; there is no per-tool authorization; `secondaryTagPresets` are seeded but never read at runtime). The requester's product requirement: management must govern AI usage across automated and copiloted agents per employee/job function, and every employee — including non-technical lower/middle/upper management — must be able to start using a correctly-configured agent (opencode pre-installed with MCPs, skills, sub-agents, permissions) in minutes without writing a config file.

**Why it matters.** This is the governance×ease-of-use intersection that decides whether ARM is a metering dashboard or the enterprise AI control plane. It also pulls forward the governance-critical half of the deferred Phase 4 agent-plugins work, and turns the D7 work-type stream into enforceable money (per-work-type routing, budgets, and `cost-per-work-product` benchmarks).

**Decision frame — pick one:**

- **(a) Tool Registry only** (publish MCP servers, tenants hand-assemble bundles) — rejected: no ease-of-use, no governance unit.
- **(b) Work Packages (recommended):** versioned, role-scoped bundles of tools/skills/sub-agent configs/permissions/routing/budget/templates, materialized from Industry Profile presets (D6 pattern: presets set defaults, never gate capabilities), copy-on-provisioning (D7 lock), distributed via extended `/.well-known/arm-agent` manifest + one-command `arm setup`. Tools become first-class Registry entities with `tool:*` authorization verbs (D8 extension). Two modes: **automated agent** (scope-owned) and **copilot mode** (employee-adjacent, human-in-the-loop — default for human job roles). The package is the unit of metering, budgeting, approval, and `cost-per-work-product` telemetry.
- **(c) Agent-side config only** (no server-side entity) — rejected: governance would be unenforceable prose.

**Research basis (2026-08-13):** ~250 OEM job types across 20 functions with per-role daily-work/tool/token profiles (`docs/research/oem-job-taxonomy.md`, `docs/research/oem-work-package-design.md`), and a token-economics sweep (`docs/research/token-cost-optimization.md`) showing a 70–85% savings stack (routing + caching + summarization + loop caps) that is only expressible with a package entity.

**Decision needed by:** start of 1.5 work (post-1.4 resource connectors).
**Owner:** architecture + product.

**Resolution (2026-08-13): PROPOSED — option (b), not yet locked.** Full rationale, data-model deltas (`tool`, `work_package`, `package_assignment`, event columns), guardrails, phase plan (1.5 foundation → 1.6 one-command provisioning + copilot mode → 1.7 governance loop + moat metrics), sub-decisions (role-level granularity, opencode-first runtime, `tool:invoke/configure/publish` verbs, tiered approval defaults, 10-package pilot set), and doc-update obligations live in `docs/solutions/2026-08-13-d9-work-packages.md`; the build plan (personas, ease-of-use contract, component-by-component changes, gantt, exit gates, risks) in `docs/solutions/2026-08-13-work-package-roadmap.md`.

---

## Already-addressed in v0.1 review (recorded for traceability)

These were flagged in review and resolved by spec patches + risk-row additions; kept here so they don't get re-opened without reason:

| Was                                           | Resolved by                                                      |
| --------------------------------------------- | ---------------------------------------------------------------- |
| Master provider-key custody not in risk table | New risk row in §12 (HSM/KMS, rotation, anomaly alerts)          |
| Bypass-agent live enforcement gap             | New risk row in §12 (provider-side delegate-key spend caps)      |
| GCS signed-URL bearer-token leak              | New risk row in §12 (short TTL, prefix scoping, audit)           |
| fail-open vs fail-closed wording (§5.2)       | Clarified: quota/routing fail-closed, event emission fail-open   |
| §3.3 diagram bug (GW prompts → Vault)         | Fixed: G → GPU Pool                                              |
| §3.2 spurious `Proxy --> RC` edge             | Removed                                                          |
| §6.2 dangling `Files -.-> ARM` edge           | Removed                                                          |
| User↔Role missing junction                    | Added `UserRole(user_id, role_id)` + ERD edge                    |
| `AssumeRole` with OIDC token                  | Corrected to `AssumeRoleWithWebIdentity` (3 sites)               |
| `auto_downgrade_to` silent drift              | Auto-downgrade contract: response surfaces served model          |
| "One canonical join key" wording              | Invariant 2 reworded; both event tables already carry `agent_id` |
| Repo filename mismatch                        | repo-layout section references `arm-spec.md`                     |
| "Higher-level" ambiguous                      | §6.1 defines higher = closer to Org root                         |

These do **not** need sign-off; they're recorded only for history.

---

## Adopted engineering practices (worldmonitor review, 2026-07-26)

Reviewed `github.com/koala73/worldmonitor` (mature production TS monorepo) and adopted the following practices into spec §14/§15, `AGENTS.md`, and `docs/CONCEPTS.md`:

| Practice (theirs)                                                                                                            | ARM adoption                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Architecture rules enforced as executable lints (`lint-boundaries`, api-contract, safe-html, rate-limit, secret-dump checks) | §14.1 invariants-as-code table: every §11 invariant maps to a guardrail script/test (`scripts/guardrails/`)                              |
| "Vacuous Guard" / "Mutation Proof" testing philosophy                                                                        | §14.2 guard quality standards: mutation proof required for every security guardrail; empty input = red                                   |
| Third-Party Rot split + Baselined Advisories with written justification                                                      | §14.1 dependency-security gate; §14.2 failure-split rule                                                                                 |
| Seed-meta freshness monitoring + health endpoints                                                                            | §14.1 policy-cache freshness row (data plane reports `policy_version` + `last_refresh`; health surface flags stale caches) — input to D5 |
| `AGENTS.md` repo entry point + `CONCEPTS.md` shared vocabulary                                                               | `AGENTS.md` (root) + `docs/CONCEPTS.md` created                                                                                          |
| ARCHITECTURE.md ownership rule ("doc updates in the same PR")                                                                | §14.3 Spec Travel Rule                                                                                                                   |
| `docs/solutions/` dated decision records with frontmatter                                                                    | §14.3 + `docs/solutions/` in target layout (§15)                                                                                         |
| Tiered pre-push gate (state-dependent vs tree-dependent, diff-scoped)                                                        | §14.3 pre-push gate (1.0 deliverable)                                                                                                    |
| CLI + machine-readable agent discovery (llms.txt, `.well-known`)                                                             | §8.1 `arm agent init` onboarding CLI; §5.2 `/.well-known/arm-agent` discovery; `apps/cli` in §15 layout                                  |
| CI workflow table kept in sync by a CI check; merge authority explicit                                                       | `AGENTS.md` CI table + working agreements                                                                                                |
