---
title: "D7: Work-type usage classification — per-prompt tagging for gating + governance"
date: 2026-08-02
status: proposed
supersedes: none
---

# D7: Work-type usage classification

## Decision

**Per-prompt work-type tagging in the data plane**, computed with a **zero-LLM-call classification cascade** (structural features → prompt-hash label cache → fastText/linear classifier → embedding-centroid fallback), with an **async sampled LLM judge for QA only**. Labels are **per-department / per-plant presets with custom labels from day 1**, emitted **per prompt** (every proxied LLM call), and are **enforcement-ready**: the same label stream feeds dashboards today and work-type gates/governance later, with the schema and event model built for gating from the start.

Locked with the requester (2026-08-02):
1. **Taxonomy is per-department/per-plant from day 1** — preset label sets shipped for known department types; admins extend with custom labels. No single global label list.
2. **Not dashboard-only** — the tag stream is the substrate for future gating (work-type-aware routing) and governance (budgets, priority, audit). Event/schema design must not foreclose enforcement.
3. **Granularity is per-prompt** — every metered LLM call carries its own tag; no session-level rollup as the unit of classification.

## Context

ARM already has two classification concepts, neither of which answers "what work is this prompt doing":

- **§6.5 `classification_context`** (D2, locked 2026-07-26) — *data-sensitivity* classification (public/internal/confidential/restricted) of **resources**, tagged at vend/return, gating model routing. DLP, not usage.
- **§1.3 `taskType`** — a **static, per-agent** attribute ("CNC toolpath optimization") describing what an agent *is*, never what each prompt *does*.

The `token_usage_event` ledger (§4.2) carries `priority_tier`, `model_id`, tokens — but no work-type. Management cannot answer "how is each agent being used, by work category, per department/plant?" except via static agent metadata.

The constraint that shapes everything: the data-plane proxy performance budget is **p50 < 25 ms, p99 < 100 ms added latency, ≥ 500 RPS per node** (§5.2), and invariant 1 requires prompt bodies to stay in the tenant VPC (fine — the classifier runs in the data plane, which is inside the VPC). Metering event emission fails open (§5.2); the classifier must follow the same rule — it must never block or add tokens to the agent's call.

## Options considered

### (a) LLM-as-judge per prompt (LangSmith online-evaluator pattern)

Classify every prompt with a small judge model. **Rejected.** Costs tokens on 100% of traffic (the exact thing the requester forbids); adds 200–500 ms per call (blows the §5.2 budget); every production platform that uses LLM judges samples 1–5% with spend caps, never 100%. Also undeterministic — a judge that drifts breaks future gating.

### (b) Rules/regex only

Zero cost, sub-ms. **Rejected as sole mechanism.** Covers ~60% of traffic on structured signals (tool names, model_id, agent type) but misses free-text intent (a prompt with no tool calls), and per-department taxonomies multiply rule maintenance. Kept as **stage 1** of the cascade, not the whole answer.

### (c) Zero-LLM cascade: structural → hash-cache → fastText/linear → embedding centroid (+ sampled LLM judge for QA) — **RECOMMENDED**

The industry-validated pattern (LiteLLM Auto Router v2 is the only in-gateway reference; the 3-tier cascade is the consensus across semantic-router literature):

| Stage | Mechanism | Cost | Latency | Coverage role |
|---|---|---|---|---|
| 1 | Structural freebies (model_id, agent type from UA, tool-call names, file paths, priority tier, department) | $0 | 0 ms | ~60%: obvious cases fully labeled from already-present metadata |
| 2 | Prompt-hash → label cache (LRU) | $0 | ns | Repeats (15–20% of gateway traffic is exact-duplicate; 40–70% for classification/extraction-heavy workloads) |
| 3 | fastText / TF-IDF+SGD→ONNX linear classifier, one tiny model per taxonomy | ~0 CPU | µs–1 ms | The general case; F1 0.85–0.92 on intent tasks — beats an 8B LLM on the same task at ~1/1000 the cost |
| 4 | Embedding centroid (MiniLM-L6 / bge-small, ONNX, in-VPC) | ~0 CPU | 6–35 ms | **Only** when stage 3 confidence < threshold; class centroids from 5–10 labeled examples; result may be `unknown` |
| QA | Sampled LLM judge (1–5%, batch cron) | 1–5% of calls × judge tokens | offline | Label-quality audit + taxonomy drift detection. The only LLM spend, ever. |

**Why per-prompt works at this cost:** stage 2's cache means repeated prompts (autocomplete, retries, tool loops) are free; stage 1 covers structural cases; only genuinely novel free-text prompts reach stage 3 (µs). Stage 4 fires on a small ambiguous tail. Worst-case added latency is dominated by stage 4 (off-budget), so stage 4 runs only when stage 3 is uncertain — and `unknown` is a first-class label, never a guess.

### (d) Session-level classification (Codex `TaskKind` pattern)

**Rejected for the unit of classification** (per user lock #3) — per-prompt is the requirement because a session spans many work types (one conversation can go bug-fix → test → docs) and gating needs the prompt-level label, not the session-level average. Sessions remain a **rollup dimension** in analytics (session_id already joins events), not the classification unit.

## Rationale

1. **Zero token cost, in budget.** The cascade's worst stage (embedding) is off the hot path; the common path (stages 1–3) is sub-ms and µs of CPU. No LLM call is ever made per prompt. The only LLM spend is the sampled QA judge — an explicit, capped, batch operation.
2. **Per-department/plant taxonomies from day 1.** The taxonomy is a **control-plane config resource** (new table, §4.1 delta): `WorkTypeTaxonomy(tenant_id, scope_type, scope_id, labels[])` — preset label sets seeded per department type (manufacturing/tech per D6 profiles) and per plant, editable as custom labels. The classifier stack selects the model by the agent's department/workstream (agents already carry scope); one fastText model per taxonomy is ~3 MiB and trains in seconds — per-taxonomy models are cheap, so custom labels don't require retraining a global model. This follows the D6 governing rule: presets set defaults, they never gate capabilities.
3. **Enforcement-ready by construction.** Every tag is emitted with `classifier_version` + `confidence` + stage path, so a later work-type gate (e.g. "research prompts never route to Claude", "critical-tier work cannot run on background budget") is deterministic, auditable, and re-labelable after taxonomy changes. `unknown` results are gated by policy default, not by guess. Gate decisions will emit `access_audit_event(decision=deny, reason="work_type_gate")` — the same typed-record pattern as the §6.5 classification gate (D2).
4. **Greenfield differentiation.** Research (2026-08-02) confirms no production gateway offers free server-side per-request work-type tagging today — LangSmith charges tokens (sampled), Helicone/Langfuse/Portkey tag only caller-attached metadata. This is a spec §1.3 differentiator ARM can own, and it pairs directly with the existing §1.3 work-type classification claim (which today is static-only).

## Consequences

### Data model (§4.2 delta)

`token_usage_event` gains:
- `work_type LowCardinality(String)` — primary label (from the agent's department taxonomy; NULL until the cascade resolves, i.e. `unknown` is stored as-is, never guessed)
- `usage_tags Array(LowCardinality(String))` — secondary tags (structural, e.g. `tool:web_search`, `model:claude-sonnet`)
- `classifier_version UInt32` + `classifier_stage Enum('structural','cache','linear','embedding','unknown')` — enables re-labeling when taxonomies change and gate-audit forensics
- `work_type_confidence Float32` (0–1, stage-dependent)

New control-plane table `WorkTypeTaxonomy` (§4.1): per-scope label sets + presets, `tenant_id`-carrying like every multi-tenant table.

### Data plane (§5.2 delta)

- Classifier stages run inside the Closed-Proxy and Open-Gateway paths (both are in-VPC; prompt bodies never leave).
- Failure semantics mirror metering: classification **fails open** for labeling (event emission), **fails closed** for future work-type gates (a call that cannot be classified is denied or defaulted per policy — decided at gate design time, not left implicit).
- Added latency budget: stage 1–3 must land inside the existing p50 < 25 ms budget (they're sub-ms); stage 4 (embedding) is off-budget by design and capped by the low-confidence threshold; the 1.2 load harness measures classifier stages explicitly.
- Training pipeline: offline bootstrap from Snorkel-style weak labels (static `taskType` + policy + agent metadata) + a few hundred stakeholder-labeled prompts per taxonomy; retraining is a cron/CI job, never inline.

### Guardrails (§14.1)

- `guardrails/taxonomy-scope`: every `WorkTypeTaxonomy` row references an existing org-tree node and is `tenant_id`-scoped; presets never gate capabilities (D6 rule).
- `guardrails/work-type-unknown`: a classifier that returns `unknown` for ≥ threshold% of a taxonomy's traffic is red (drift detector) — mirrors the "guards asserting a negative fail loudly on empty input" quality bar.

### Phase plan

- **Phase 1 (this PR series):** taxonomy table + presets, cascade stages 1–3 + cache, tag emission on `token_usage_event`, dashboard breakdown by work-type (replaces/augments the static §1.3 claim). No gating.
- **Phase 1.4+:** work-type gating (routing rules keyed on `work_type`), work-type budget reservations, audit reasons `work_type_gate`. The event schema above is built so this is a policy rule, not a migration.

## Sub-decisions to lock

1. **Label cardinality per prompt**: one primary `work_type` + up to N secondary tags (recommend 1 + ≤5); a prompt in `unknown` is stored as-is, never coerced.
2. **Taxonomy edit policy**: presets are copy-on-provisioning (edits don't mutate the shared preset); custom labels are admin-managed per scope; label renames trigger re-labeling of the trailing window (async job, `classifier_version` guards it).
3. **Confidence threshold for gating** (Phase 1.4): e.g. classify at ≥ 0.85 → gate applies; 0.65–0.85 → default policy; < 0.65 or `unknown` → fail-closed per policy. Fix at gate-design time with the §5.1 routing work.
4. **Where the label cache lives**: in-process LRU per data-plane node (bounded, e.g. 10K entries, TTL-matched to session length) — no new store in Phase 1.
5. **Sampled QA rate**: 1% of traffic, monthly taxonomy-drift report; judge model = cheapest capable model, batch cron, no user-visible latency.

## Doc-update obligations

- `docs/arm-spec.md`: §1.3 (work-type classification now per-prompt, not static-only), §4.2 (event columns), new §4.1 `WorkTypeTaxonomy`, §5.2 (classifier stages + latency accounting), §6.5→new §6.7 (work-type gate hook points, Phase 1.4), §14.1 (two new guardrails), §8 dashboard flow (work-type breakdown panel).
- `docs/CONCEPTS.md`: add **Work-Type Tag**, **Classification Cascade**, **Unknown-Is-Not-Guessed**.
- `docs/open-decisions.md`: D7 entry (this record).
- `docs/solutions/competitive-analysis.md`: note the differentiator (free per-request work-type tagging — no incumbent does this).
