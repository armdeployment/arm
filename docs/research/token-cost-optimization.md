# Research: Token Cost Optimization & the ARM Moat

**Date:** 2026-08-13 · **Status:** research input for D9 + Phase 1.5–1.7 roadmap
**Source:** dedicated token-economics sweep, cross-checked against ARM's existing machinery (ClickHouse `token_usage_event`, org-tree budgets, closed-proxy + open-gateway, D7 work-type classification, internal $/M-token pricing in `packages/db/src/schema/policy.ts`).

> The question answered here: *once every employee's job has an agent work package, how do we make the fleet cheap, and how does cheap become a moat?*

---

## 1. Token cost drivers by workload

Cost shape rule: **spend ∝ context_size × steps × retries.** The enterprise failure mode is agentic loops that resend full context every iteration.

| Workload (OEM examples) | Dominant driver | Cost shape |
|---|---|---|
| Standards review (ISO 26262, IATF 16949, PPAP/APQP) | Input-heavy: 100K+ token docs re-read by N agents/depts; loops resend full context per step | Input tokens 3–5× output price; repeats multiply linearly |
| Code generation (PLC ladder, embedded C/C++, Python data) | Output-heavy + tool loops: each compile/test round-trip resends session; sessions grow unbounded | steps × session length; 8–15 calls per finished routine |
| Report generation (8D, audit, compliance) | Retries from format non-compliance: whole-doc regeneration on schema mismatch | 2–4× output cost per report when rework counted |
| Data analysis (historian/SPC) | Tabular text serialization: time-series re-fetched, re-embedded per query; query→inspect loops | Input-dominated, multiplies with data size × iterations |
| RAG over PLM/wikis | Retrieval redundancy: same chunks retrieved across agents/depts; top-k over-stuffing | Moderate per call, duplicated fleet-wide |
| Repetitive templated outputs (defect labeling, doc triage) | Model overkill: frontier model doing small-model work; boilerplate regenerated each call | 10–100× what a small model costs |

---

## 2. Cost-saving techniques

Legend: **P** = provider-side (ARM positions for it), **A** = platform-side (ARM implements it). Savings are rough industry ranges.

### 2.1 Routing & tiering

| Technique | OEM application | Savings | Risk | Side |
|---|---|---|---|---|
| Model routing/tiering | Defect-labeling, doc triage, form extraction on small models; 8D root-cause reasoning on frontier; confidence-gated escalation | **70–90%** on routed calls | Edge-case misses; needs calibration + fallback + audit trail | **A** — open-gateway + `allowed_models` policy is built for this; D7 `work_type` is the routing key |
| Offline/open-model fallback | Nightly report generation, batch classification, backlog triage; background-tier agents | **60–95%** vs frontier API | Latency, throughput ceiling; privacy-sensitive data must stay on-prem anyway (invariant 1) | **A** — open-gateway + priority-tier auto-downgrade |
| Fine-tuned small models | Defect-labeling classifier, 8D section drafting, PPAP form completion, work-instruction summarization | **90%+** marginal cost (fixed GPU amortization) | Training/maintenance overhead; distribution shift per product line; needs per-task eval harness | **A** — model registry + per-work-type eval loop |

### 2.2 Caching

| Technique | OEM application | Savings | Risk | Side |
|---|---|---|---|---|
| Prompt caching | Canonical system prompts, standards excerpts as static prefix, tool schemas | **50–90% off input** on repeat calls | Provider TTL (5 min–1 h) — benefits only under bursty/repeated usage | **P** — ARM positions via canonical-prompt templates in packages |
| Semantic cache | "What does ISO 26262 §8.4.5 say?" asked by 40 agents across plants | **40–80%** on repeated consultation | **Staleness = compliance risk**; key on doc version + confidence | **A** — data-plane cache keyed on tenant + doc version |
| Embedding reuse | PLM corpus embedded once per tenant, shared across agents/depts | Modest per call, compounds fleet-wide | Vector drift on doc updates | **A** — per-tenant vector store |

### 2.3 Context management

| Technique | OEM application | Savings | Risk | Side |
|---|---|---|---|---|
| Summarization-first (map-reduce) | Compress 500-page standards into hierarchical summaries before reasoning | **50–80%** on doc review | Normative clauses lose exact wording — hybrid: summary for orientation + targeted full-text retrieval for cited clauses | **A** |
| RAG instead of full-context | PLM docs, wikis, historical 8D reports, PPAP archives | **60–95%** vs full-doc stuffing | **Silent omission** — retrieval miss in compliance context is the top quality risk; needs provenance + citations | **A** |
| Prompt compression (LLMLingua-class) | Verbose meeting notes, legacy spec prose | **30–60%** | Never compress normative/critical clauses; allowlist of compressible content types | **A** |
| Context-window discipline | Long code-gen sessions (PLC projects), multi-day workflows | **30–70%** on long-running agents | Losing constraints set at step 3; needs explicit memory protocol | **A** — session manager in data plane |

### 2.4 Execution economics

| Technique | OEM application | Savings | Risk | Side |
|---|---|---|---|---|
| Agentic-loop budget caps | Any autonomous workflow (data analysis, code-gen) | **50–90%** on runaway agents (the tail is where money dies) | Premature abort of near-complete work; pair with checkpoint/resume | **A** — natural fit with ARM budget/throttle machinery |
| Tool-call minimization | One call fetching all required historian queries instead of query→inspect→query | **20–50%** on agentic flows (each round trip = full context resend) | Fewer validation checkpoints | **A** — tool-bundle design in packages |
| Output token limits | Report tasks that over-generate boilerplate | **5–30%** | Truncation mid-content; per-work-type tuned | **A** — policy-enforced per role |
| Canonical prompts + schema-validated outputs | Templated 8D/audit reports get format right first time | **20–50%** (eliminates whole-job re-runs) | Upfront engineering cost; template versioning | **A** — packages are the template distribution channel |
| Structured-output mode | Form extraction, report JSON, tool-call arguments | **0–40%** (kills JSON-retry rework) | Slight latency; schema lock-in | **P** — ARM selects models that support it |
| Batch processing | Nightly classification backlogs, weekly rollups, embedding jobs | **~50%** on batchable work | 24 h TAT limits applicability | **P** — ARM schedules eligible work |
| Streaming | UX/latency perception | **~0%** — same tokens billed | None | **P** — note in cost models; never budget "streaming savings" |

**Net portfolio effect:** a well-tuned OEM work package lands **70–85% below naive frontier-model-per-call** spend via the stack: open-model base + routing + caching + summarization + loop caps. The frontier model touches only the reasoning steps.

---

## 3. Metering & the moat

### 3.1 Telemetry to capture per event (joinable to `agent_id` → role → dept → work-type)

- Core: tokens, model, tier, `work_type` (D7), **cache_read vs cache_write tokens** (prompt-cache hit rate), semantic-cache hit/miss + version key
- Agentic health: tool-call counts, steps, retries, loop-cap aborts per task
- Escalation events: routed-up count (small→big), tier downgrades, budget-exceeded/approved counts

### 3.2 The moat metric — cost per finished work product

- Normalize spend by **unit of completed work**: `$/8D report`, `$/PPAP submission`, `$/audit`, `$/defect classified`, `$/PLC routine merged`, `$/SPC analysis run`
- Track **tokens-per-unit alongside dollars-per-unit** (tokens deflate price changes and model mix; dollars answer the CFO). Both, always, in the same table.
- Quality counterweight: **rework rate** (human corrections per unit) and success rate — "cheapest per 8D" ≠ "best per 8D". A unit costing 2× but with zero rework wins on total cost of quality.

### 3.3 Why this is the moat

1. **"Cost per finished work product" is the enterprise conversation.** Procurement and CIOs think in unit costs of quality (PPM, COPQ), not tokens. ARM is the only surface where agent spend meets completed-work telemetry. Cross-customer anonymized benchmarks (per industry profile) enable: *"your $/8D is 3.2× the cohort median — here's the routing fix."* That is the churn-defeating dashboard.
2. **ROI proof is structural, not narrative.** Every technique in §2 emits a provable delta: cache hit rate × cache-read price, routed-down calls × price delta, loop caps = aborted runaway spend. The savings estimator should be a **causally-attributed ledger**, not a model — auditors believe event-level attribution.
3. **Accumulated config is the switching cost.** Per-role routing policies, per-work-type fine-tunes, canonical prompt caches, tuned budgets — all live in ARM and cannot be ported by a competitor. The data flywheel (D7 labels, routing outcomes, per-unit benchmarks) improves with every tenant.
4. **Compliance-shaped savings are sticky.** Saving money on ISO/IATF document review is only acceptable to an OEM if provenance/citation quality is preserved — so ARM must **co-meter cost AND verifiability** (citations present, clause-version-keyed caches). That pairs the CFO's metric with the quality manager's requirement, and no generic LLM gateway sells that pair.

**Guardrail constraint:** benchmarks are aggregates only, never cross-tenant row-level (invariant: dashboard viewers see aggregates only). Per-tenant "cost per unit" derives from the tenant's own events; cross-tenant comparison happens on distribution statistics.
