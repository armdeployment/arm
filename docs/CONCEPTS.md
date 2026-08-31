# Concepts

Shared domain vocabulary for ARM — entities, named processes, and status concepts with project-specific meaning. Glossary only, not a spec; the normative text lives in `arm-spec.md`. New named concepts are added when introduced (see AGENTS.md working agreements).

## Identity & Ownership

### Sub-Account

The per-agent LLM credential identity (`sub_account_id`) presented to the data-plane proxy/gateway. It is the metering join key on the LLM side and is linked 1:1 to an `agent_id`. A sub-account is not an identity in its own right — it is the credential face of an Agent. See also: Agent Identity Pairing, Bypass Agent.

### Agent Identity Pairing

The rule that one agent has exactly two stable IDs — `sub_account_id` (LLM/metering side) and `agent_id` (access side) — linked 1:1, so a single agent's spend and resource access can be joined in analytics. Any feature that introduces a third identifier for the same agent breaks cross-domain joins by construction. See also: Sub-Account.

### Scope-Owned Agent

An agent spawned automatically to run on behalf of an org-tree node (org/department/group/team/workstream) rather than created by an individual user: `owner_user_id` is NULL, `scope_type`/`scope_id` points at its node, and `spawned_by` records `automation` or `template`. It uses the same data-plane paths, metering, and permission model as a user-owned agent. See also: Stakeholder, Priority Tier, Re-attestation.

### Stakeholder

The single accountable human (`stakeholder_user_id`, non-null) attached to every agent — user-owned or scope-owned. The stakeholder is accountable for the agent's spend, access, and behavior; receives budget/security alerts; and is requester-of-record for the agent's JIT access requests. For user-owned agents the stakeholder defaults to the owner; for scope-owned agents it is assigned at spawn time (default: scope admin or template author). An agent without a stakeholder is anonymous automation and is forbidden by invariant 7. See also: Scope-Owned Agent, Re-attestation.

### Re-attestation

The process triggered when a stakeholder departs or a scope is reorganized: the affected agents must be transferred to another human stakeholder or retired within a bounded window. Agents past the window are disabled, not left running — an unowned running agent is a zombie spend + dangling-access incident class. See also: Stakeholder, Scope-Owned Agent.

## Metering & Billing

### Meter-Agent

The data-plane component that consolidates metadata events from proxy, gateway, plugins, and connectors, dedupes concurrent agents, and pushes them to the control plane over mTLS. It is the single egress point for usage data — which is what makes the Metadata-Only Boundary auditable in one place. See also: Metadata-Only Boundary.

### Metadata-Only Boundary

The trust rule (invariant 1) defining what crosses from data plane to control plane: tokens, cost, audit decisions, agent id, timestamps — and **never** prompt bodies, resource content, or raw credentials. The boundary is enforced as code (event schemas carry no content fields; egress allowlist on control-plane write endpoints), not by convention. See also: Meter-Agent, Guardrail.

### Bypass Agent

An agent whose LLM traffic does not pass through the data-plane proxy (e.g. claude code using its own provider OAuth). Metering falls back to plugin-ingest metadata or the lagging provider billing-API, so live quota enforcement is impossible by construction — caps apply only after reconciliation. The Phase 1 mitigation is provider-side delegate-key spend caps; treating a bypass agent as enforceable in real time is a design error. See also: Sub-Account, Billing Drift.

### Billing Drift

The divergence between provider billing-API dollars and proxy-metered dollars for the same tenant/period, surfaced as an alert above a 5% threshold. Drift indicates untracked bypass traffic, metering loss, or attribution error; it must be explained before the books close, not averaged away. See also: Bypass Agent, Permission Drift.

## Access Control

### Mint / Proxy / Sync

The three credential-vending strategies, chosen per resource type. **Mint**: issue short-lived scoped credentials (S3 via STS AssumeRoleWithWebIdentity, GCS via Workload Identity/signed URLs). **Proxy**: ARM data plane brokers every call against a vaulted master credential (DBs, internal systems). **Sync**: reconcile the external system's own permissions to match ARM grants (SharePoint/Graph). Strategy choice is type-driven (spec §6.2); a resource type using the wrong strategy inherits that strategy's failure modes (e.g. minted URLs are bearer tokens until TTL). See also: Permission Drift.

### Deny-Override

The resolution rule (invariant 3) that a deny at a higher scope rank always wins over any allow at a lower rank — including a lower-rank explicit grant. "Higher" means closer to the Org root. The full algorithm and constraint-merge rules live in `permission-rules.md`; it is verified by property-based tests with randomized trees and deny injection. See also: Classification Gate.

### Permission Drift

The divergence between ARM's recorded sync-strategy grants and the external system's actual permissions (notably SharePoint/Graph). Stale grants left active are a standing-access incident, so drift detection ships from day one of the SharePoint connector (1.4), not as a follow-up. See also: Mint / Proxy / Sync, Billing Drift.

### Classification Gate

The single bidirectional link between the LLM-policy and access-policy domains: a resource's classification restricts which LLM may receive its content (confidential+ never routes to closed external models). The Phase 1 enforcement point is an open decision (open-decisions.md D2) because content DLP is Phase 2 — the gate must fire in the data plane without inspecting content. See also: Deny-Override, Metadata-Only Boundary.

### Work-Type Tag

The per-prompt usage label computed by the Classification Cascade for every metered LLM call: one primary `work_type` (from the agent's department/plant taxonomy, e.g. "bug-fix", "test", "CNC toolpath optimization") plus up to ~5 secondary `usage_tags` (structural, e.g. `tool:web_search`). A tag is never a guess — `unknown` is stored as-is. Distinct from the static per-agent `taskType` (what an agent _is_) and from §6.5 `classification_context` (data _sensitivity_ of resources); the three compose: `work_type` × clearance × sensitivity. Tags are enforcement-ready: events carry `classifier_version` + `confidence` + `stage`, so work-type gates (Phase 1.4+) are deterministic and re-labelable. See also: Classification Cascade, Unknown-Is-Not-Guessed, D7.

### Classification Cascade

The zero-LLM-call pipeline that computes Work-Type Tags in the data plane: (1) structural freebies (model_id, agent type, tool-call names, file paths, tier) → (2) prompt-hash label cache (repeats are free) → (3) fastText/linear classifier, one tiny model per taxonomy (µs–1ms, F1 ~0.85–0.92) → (4) embedding-centroid fallback only on low confidence → (5) async sampled LLM judge (1–5%, batch cron) for QA and taxonomy-drift detection — the only LLM spend. Stage 4 is off the §5.2 hot-path budget by design. See also: Work-Type Tag, Unknown-Is-Not-Guessed.

### Unknown-Is-Not-Guessed

The rule that classification never fabricates a label: any prompt the cascade cannot resolve with confidence is tagged `unknown` (or `classifier_stage='unknown'`) and stored as-is. At labeling time this fails open (the call proceeds, the event carries no work_type); at gate time (Phase 1.4+) the policy engine decides `unknown`'s outcome — default fail-closed — rather than trusting a coerced label. Drift detection monitors the `unknown` rate per taxonomy; a taxonomy whose traffic is overwhelmingly unknown is red, not tuned. See also: Work-Type Tag, Classification Cascade.

## Priority & Budget

### Priority Tier

The preemption class attached to every agent: `critical` (incident/hot-issue resolvers, revenue-path), `standard` (default), `background` (UX optimization, upgrades, experiments). Tier assignment is policy, not self-declared: `critical` requires scope-admin approval and is audited (invariant 8). See also: Tier Ladder, Scope-Owned Agent.

### Tier Ladder

The ordered degradation applied under budget pressure: `background` agents are (1) auto-downgraded to open models, (2) throttled, (3) queued/blocked with `429 + Retry-After`; `standard` throttles only after the critical reserve is exhausted; `critical` draws on the reserve until hard cap. The ladder is uniform across proxy and gateway paths; the response always surfaces the actually-served model. See also: Priority Tier, Critical Reserve.

### Critical Reserve

The budget fraction reserved per scope (`priority_reservations_json`, e.g. `critical_reserve_pct: 20`) that only `critical` agents may draw on once the general budget is pressured. Whether critical agents hard-cap at reserve exhaustion or keep drawing with alerts is Open Item 5 (InfoSec + finance sign-off). See also: Tier Ladder, Background Floor.

### Background Floor

The minimum budget slice or scheduled windows reserved per scope for `background` work (`background_floor_pct`), so chronic budget pressure cannot starve optimization/upgrade agents to zero. Monitored via a starvation metric; without it the tier ladder silently converts "lower priority" into "never runs". See also: Critical Reserve, Tier Ladder.

## Policy Distribution

### Policy Cache

The data-plane-local copy of LLM/access policy used for per-call enforcement, so enforcement survives control-plane outages and adds no hot-path latency. Its staleness is an enforcement gap: a newly added deny has no effect until the cache refreshes. Invalidation semantics and a staleness SLA are open decision D5; freshness is reported via `policy_version` + `last_refresh` on every pull. See also: Fail-Closed / Fail-Open.

### Fail-Closed / Fail-Open

The two degradation modes when the control plane is unreachable. **Fail-closed** (quota/routing/access decisions): the agent is blocked — safer, and the default. **Fail-open** (metering event emission only): events are buffered and retried, never blocking the LLM call. The split is deliberate: losing metering data is recoverable via reconciliation; allowing unquota'd spend or unauthorized access is not. Sign-off: spec §13 Open Item 3. See also: Policy Cache.

## Web UI & UX

### Impact Preview

The mandatory pre-confirmation summary for any mutation with spend/access impact (policy switch, budget change, tier change, grant, key rotation): affected agents/resources and the $ delta are shown before the confirm action enables. One-click actions on shared policy only feel safe when the blast radius is shown first — the full pattern is preview → confirm → audit event → reversible window where applicable. See also: Tier Ladder, Guardrail.

### Deferred-Shell Panel

The UI-stability rule for async dashboard content: a footprint-matched skeleton occupies a panel's exact grid slot from the first layout pass, and arriving content replaces the shell in place — grid geometry never changes when data lands (adopted from worldmonitor's layout-shift lessons). Panels also carry explicit loading/empty/error states and a stale-data badge when ledger freshness exceeds threshold. See also: Spec Travel Rule.

### Industry Profile

A **provisioning-time bundle of default config** (D6) that shapes a tenant's initial setup — departments, personas, classification taxonomy, DLP patterns, resource types, budget periods, UI panels. Selected once in an onboarding wizard at tenant creation; materialized as normal per-tenant config rows. The governing rule: **the profile only sets defaults, never gates a capability** — everything that makes ARM good for manufacturing is a capability any tenant could enable. Orthogonal to delivery model (SaaS/self-hosted) and commercial tier. Shipped presets: Tech, Manufacturing, Custom. Enforced by `guardrails/no-profile-branching`. See also: Preset, Capability Toggle.

### Preset

A named, shipped Industry Profile bundle (Tech, Manufacturing, Custom). Pure data — no functions, no code branches. Stored in `packages/profiles` and applied at tenant provisioning time.

### Capability Toggle vs Profile Default

The distinction that keeps hybrid companies first-class. A **profile default** is what the preset seeds (e.g. manufacturing seeds OT resource types as enabled). A **capability toggle** is what a tenant can turn on/off independently (e.g. a tech tenant can enable OT resources without switching to the manufacturing preset). The profile never gates a capability — it only sets the starting state. `guardrails/no-profile-branching` enforces that runtime code never branches on `industryProfile`.

## Work Packages & Agent Enablement

### Work Package

The versioned, role-scoped bundle that makes an agent useful for a specific job (D9, updated D10): pinned components (see Component), permission grants, model-routing policy, budget template, starter prompts, and job-function tags. Materialized from Industry Profile presets — presets set defaults, never gate capabilities (D6 rule) — and copy-on-provisioning: editing a preset never mutates an installed package; version bumps trigger guided upgrades (D7 lock pattern). `approval_required` (A6) controls whether a questionnaire recommendation for this package auto-approves or routes to an approver. The package is the unit of governance: budgets, approvals, metering, and Cost-Per-Work-Product telemetry all roll up by package. Ships in two modes: automated agent (scope-owned, unattended) and Copilot Mode (employee-adjacent). See also: Component Registry, Manifest v2, Package Assignment, Copilot Mode, Job Function.

### Component

The D10 generalization of `tool` (A3): one registry entity with a `kind` discriminator — `mcp`, `http_api`, `cli`, `connector` (**callable**, authorized with the unrenamed D8-extended `tool:*` verbs: `tool:invoke`, `tool:configure`, `tool:publish`) or `plugin`, `skill`, `subagent`, `template`, `prompt_pack` (**installable** — configured into an agent's runtime, never invoked, and carry no verb). There is no parallel skill/plugin table; `kind` is the only discriminator. Every component carries a data classification so the D2 Classification Gate extends uniformly to it — a component touching `restricted` data is never callable from a closed external model, whether or not it's callable at all. See also: Component Registry, Artifact Digest.

### Component Registry

The catalog of Components behind Work Packages (D10, replaces Tool Registry): `component` + immutable, content-addressed `component_version` rows (manifest, `manifest_sha256`, optional `blob_digest`, `requires` — dependencies on other component slugs+ranges). `source_kind` distinguishes first-party (ARM-shipped), tenant-authored, and imported (promoted from a Discovery Candidate) components; `review_status` gates whether a component may be referenced by a published Work Package version (`guardrails/component-review`). A real artifactory (A2) — immutable, versioned, signed-manifest storage with a pluggable blob backend — not a metadata-only registry. See also: Component, Artifact Digest, Discovery Candidate.

### Artifact Digest

The content hash (`sha256:<hex>`) that identifies a component's binary payload (`component_blob.digest`, referenced by `component_version.blob_digest`). Never a mutable URL — a manifest field that should carry a digest and instead carries an http(s) location is an integrity violation (`guardrails/artifact-integrity`). Blob storage is pluggable (`fs`/`s3`/`oci`, A2) and carries a `residency` (`control_plane` vs `tenant`): tenant-authored content must never sit at `control_plane` residency (Invariant 1, `guardrails/blob-residency`) — only first-party artifacts may. See also: Component Registry, Manifest v2, Metadata-Only Boundary.

### Artifact Cache

The tenant-VPC data-plane service (`apps/data-plane/artifact-cache`, D10) that serves component blobs to the ARM client by digest: local cache → tenant blob backend → (first-party only) upstream control-plane CDN, verifying the Artifact Digest on every cache fill. Digest-keyed with **no TTL** — content-addressed bytes can never go stale, so a cache entry is correct forever; the only reason to evict is an LRU size cap. Emits `component_pull_event` (metadata only) per served request. Never re-signs or rewrites what it serves — a digest mismatch is refused outright, not "corrected." See also: Artifact Digest, Component Registry, Metadata-Only Boundary.

### Manifest v2

The D10 canonical, hashed manifest shape for a Work Package version (guide 00 §4) — a deliberate wire break from the v1 (tool-shaped) manifest, with no compatibility reader. Exactly eight fields, snake_case, in this order, with arrays sorted deterministically: `manifest_version` (always 2), `components` (sorted by `component_id`), `permissions` (sorted), `model_routing`, `budget_template`, `starter_prompts` (insertion order), `min_agent_version`, `job_functions` (sorted). `manifest_sha256` covers the canonical JSON encoding of exactly this object — recursively sorted object keys, no whitespace — so the DB-side (`@arm/catalog`) and client-side (`@arm/client-core`) canonicalizers must produce byte-identical output, proven against a shared committed golden vector. See also: Work Package, Component, Artifact Digest.

### Job Function

The questionnaire/recommendation taxonomy entity (D10) that Work Packages and Components attach to (`component_job_function`, `work_package_job_function` junctions): a `key`, `name`, `function_family`, and `industry_profile` (default-source, not runtime-branched — same D6 discipline as Industry Profile). The Questionnaire resolves a respondent's answers to a `resolved_job_function_key`, which drives package recommendation (`recommendForJobFunction`) and gap analysis (`gaps` — job functions with no assigned package). See also: Questionnaire, Work Package, Industry Profile.

### Questionnaire

The structured, adoption-first onboarding flow (D10) that replaces manual role-picking: a versioned graph of question nodes (`questionnaire_definition.graph`), each `single`/`multi`/`scale` — **never `text`** (A5) — whose answered options carry `signals` (job-function and component weights) that resolve a respondent to a Job Function and a set of recommended package versions. Answers are **structured only** (`questionnaireAnswerSchema`: string/string-array/number/boolean, keyed by question id) — free-text questionnaire input never reaches the control plane, the same Metadata-Only Boundary discipline applied to a new surface. See also: Job Function, Setup Token, Metadata-Only Boundary.

### Setup Token

The per-user signed credential (A4) that lets one signed generic ARM client install and activate a recommended package, without a per-user compiled binary. Issued after questionnaire recommendation (auto-approved if every recommended package has `approval_required = false`, A6; otherwise after approver sign-off), redeemed exactly once. The control plane stores only `token_sha256` — never the token itself (Invariant 4, the same short-lived-credential discipline applied to onboarding) — plus a short human-relayable `activation_code` for out-of-band redemption. See also: Work Package, Questionnaire, Activation Funnel.

### Activation Funnel

The adoption-first metric spine (A1 — agent adoption at scale is the _primary_ value prop, ahead of cost saving and on-prem LLM): the ordered `activation_event.step` sequence from `invited` through `questionnaire_started`/`completed` → `token_issued` → `downloaded` → `installed` → `runtime_ready` → `connections_started`/`completed` → `first_metered_call` → `weekly_active`, partitioned `(tenant_id, toYYYYMM(ts))` like every other event table (Invariant 6). Drives the `/adoption` dashboard's funnel, stall detection, time-to-value, and job-function coverage panels — the first-class surface reflecting A1's ordering, not a metric bolted onto spend/cost panels. See also: Setup Token, Metadata-Only Boundary.

### Discovery Candidate

An external component observed by a Discovery Source (an MCP registry, git index, HTTP index, or marketplace feed) pending human triage (D10): `status` moves `new → triaged → promoted|rejected`. A candidate's `raw_manifest` is unverified, as-fetched data — never trusted until promotion re-validates it through the same integrity gate real components pass (`guardrails/artifact-integrity`). Promotion sets `promoted_component_id`, turning the candidate into a real Component Registry entry. See also: Component Registry, Component.

### Copilot Mode

A Work Package deployment where the agent is employee-adjacent and human-in-the-loop: the default mode for every human job role. The employee is the accountable `stakeholder_user_id` (invariant 7); every consequential action surfaces for one-tap approval inside the chat surface. Contrast: automated mode (scope-owned agent, unattended, policy + budget enforced, alerts to its stakeholder). See also: Work Package, Stakeholder.

### Package Assignment

The HR-style link between a Work Package version and who may use it: a user (copilot mode), an agent, or an org-tree node (bulk/automated mode), with status `requested → approved → active → revoked`, an approver, and timestamps. New hires get their role package on day one; revocation is instant and audited. See also: Work Package.

### Guided Provisioning (`arm setup`)

The zero-config onboarding path (D9/1.6): SSO → role picker (assignment-aware) → runtime auto-detect/install (opencode first) → signed config written from the package manifest (MCP servers with short-lived scoped tokens, skills, sub-agents, permissions) → metered round-trip verification. The employee asks two questions and touches zero config files; config integrity is re-checked at every agent start. The manual config path remains as the advanced fallback only. See also: Work Package, Package Assignment.

### Cost-Per-Work-Product

The governance metric that normalizes agent spend by completed work: `$/8D report`, `$/PPAP submission`, `$/PLC routine merged` — computed from `work_type`-labeled tasks attributed to package versions. Always tracked as tokens-per-unit (deflates price changes and model mix) alongside dollars-per-unit (answers the CFO), with a rework-rate counterweight so "cheapest per unit" never silently means "worst per unit". The basis for cross-tenant anonymized benchmarks (aggregates only — dashboard viewers never see row-level cross-tenant data). See also: Work Package, Work-Type Tag.

## Repo Governance

### Guardrail

### Guardrail

An executable check that enforces an invariant or architecture rule (spec §14.1) — a lint, schema test, property test, or CI gate. Invariants documented only in prose are aspirations; the guardrail is what makes them true. Every security-critical guardrail requires a Mutation Proof. See also: Mutation Proof, Vacuous Guard.

### Mutation Proof

The standard of evidence that a guardrail actually guards: deliberately break the protected behavior, observe the guardrail go red, restore the source byte-identically. Reading a guard establishes what it intends; only the mutation establishes what it covers. The obligation applies recursively to guards that protect other guards. See also: Vacuous Guard, Guardrail.

### Vacuous Guard

A check that reports success without having examined what it claims to cover, because its input silently shrank — a lint scanning zero files, a test whose fixture cannot produce the violation. Guards asserting a negative ("no violations found") fail open by construction, so ARM's rule is inverted: empty input is red, not green. A vacuous guard is worse than no guard because it also supplies confidence. See also: Mutation Proof.

### Baselined Advisory

A dependency vulnerability the security gate knowingly tolerates, recorded per-lockfile with written justification for why the vulnerable path is unreachable here (build-time-only chain, fix blocked on a semver-major parent, ...). The baseline is an exemption list with reasoning, not a suppression; an advisory outside it fails the gate repo-wide, and entries that no longer match a live advisory are surfaced as stale. See also: Guardrail.

### Spec Travel Rule

The ownership rule that any change to architecture, data model, API surface, or invariants updates `docs/arm-spec.md` (and derived docs) in the same PR. Docs that trail code are how invariants quietly stop being true. See also: Guardrail.
