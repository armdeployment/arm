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
