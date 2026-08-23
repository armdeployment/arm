---
title: Lo-fi Wireframes (§5.3 IA)
date: 2026-07-27
status: living
audience: design + engineering
---

# Lo-fi Wireframes

ASCII wireframes for the ARM control-plane web UI per spec §5.3 information
architecture. These define layout and content priority before high-fidelity
design. Each page maps to a route in `apps/control-plane/web/src/app/`.

---

## Shell (shared layout)

**Updated D10** (docs/guides/02-server-panels.md §1) — Adoption leads the nav, Library follows, Cost (spend) moves down; A1: agent adoption at scale is primary, cost secondary, on-prem tracked-not-targeted:

```
┌──────────┬──────────────────────────────────────────────────────┐
│ SIDEBAR  │  TOPBAR (optional: tenant switcher, user menu)        │
│          ├──────────────────────────────────────────────────────┤
│ ADOPTION │                                                       │
│ ▣ Dashbd │  PAGE CONTENT                                         │
│ ◈ Adopt. │                                                       │
│ ✓ Rollout│                                                       │
│ LIBRARY  │                                                       │
│ ▤ Library│                                                       │
│ ◇ Assign │                                                       │
│ GOVERNAN.│                                                       │
│ ⚖ Govern │                                                       │
│ 🔓Access │                                                       │
│ 📋 Audit │                                                       │
│ COST     │                                                       │
│ ◇ Agents │                                                       │
│ $  Spend │                                                       │
│ ADMIN    │                                                       │
│          │                                                       │
│ ──────── │                                                       │
│ Tenant:  │                                                       │
│ Acme     │                                                       │
│ v0.5     │                                                       │
└──────────┴──────────────────────────────────────────────────────┘
```

---

## /adoption — Activation Funnel (D10, docs/guides/02-server-panels.md §2)

The primary panel — A1: agent adoption at scale is the headline, not spend.

```
┌──────────────────────────────────────────────────────┐
│  Adoption                              [job fn: ▾]   │
│  Activation funnel, stalls, time-to-value, coverage  │
│                                                       │
│  ┌────────┐  ┌──────────┐  ┌──────────┐              │
│  │ Weekly  │  │ Activated│  │ Eligible │              │
│  │ Active  │  │ Seats    │  │ Seats    │              │
│  │  109    │  │  145     │  │  368     │              │
│  └────────┘  └──────────┘  └──────────┘              │
│                                                       │
│  ┌──────────────────────────────────────────────────┐│
│  │ Activation Funnel                    [sample data]││
│  │ Invited          ████████████████████████ 341     ││
│  │ Quest. started   █████████████████████░░░ 304 89% ││
│  │ ...                                                ││
│  │ Weekly active    ██████░░░░░░░░░░░░░░░░░░ 109 75% ││
│  └──────────────────────────────────────────────────┘│
│  ┌────────────────────┐  ┌────────────────────────┐  │
│  │ Where Stalls        │  │ Time to Value           │  │
│  │ ██████ MDM push  30 │  │ p50 8m · p90 34m        │  │
│  │ ████ Mobile aband.14│  │ [histogram, target 10m] │  │
│  └────────────────────┘  └────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐│
│  │ Coverage — job function × package × seats         ││
│  │ Process Engineer   │ No package — gap │ 0/15 │ 15 ││
│  │ Quality Engineer    │ Quality Eng.     │11/42 │ 31 ││
│  └──────────────────────────────────────────────────┘│
│  ┌────────────────────┐  ┌────────────────────────┐  │
│  │ Coverage Gaps        │  │ Recent Activations      │  │
│  │ Process Eng. →Library│  │ [live table, 15s poll]  │  │
│  └────────────────────┘  └────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

Every panel is a deferred-shell (footprint-matched skeleton → explicit
empty/error states → stale-data badge); funnel + stalls + time-to-value
carry an `sr-only` accessible `<table>` fallback (WCAG 2.1 AA).

---

## /rollout — Campaigns & Questionnaire (D10, docs/guides/02-server-panels.md §3)

```
┌──────────────────────────────────────────────────────┐
│  Rollout                                             │
│  Questionnaire designer, campaigns, download artifacts│
│                                                       │
│  ┌────────────────────┐  ┌────────────────────────┐  │
│  │ Questionnaire        │  │ Campaigns                │
│  │ No questionnaire     │  │ [org node id___] [Issue] │
│  │ published yet        │  │ Status: not_implemented  │
│  │ [Publish new version]│  │ (single-token surface)   │
│  │  (disabled — no       │  │                          │
│  │   publish procedure)  │  │                          │
│  └────────────────────┘  └────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐│
│  │ Download Artifacts — not available yet             ││
│  │ (no procedure in the frozen onboarding contract)   ││
│  └──────────────────────────────────────────────────┘│
│  ┌──────────────────────────────────────────────────┐│
│  │ Live Campaign Funnel — reuses /adoption's funnel   ││
│  └──────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────┘
```

---

## /library — Search + Facet Rail (D10, docs/guides/02-server-panels.md §4)

Replaces the retired `/catalog` (which now redirects here).

```
┌──────────────────────────────────────────────────────┐
│  Library                                             │
│  [Search packages and components…______________]     │
│  [Packages] [Components] [Discovery]                 │
│  ┌────────┐ ┌───────────────────────────────────────┐│
│  │ Kind    │ │  Quality Engineer      [copilot]      ││
│  │ Job fn  │ │  quality_engineer                     ││
│  │ Data cl.│ │  8D/PPAP/SPC copilot…                 ││
│  │ Mode    │ │  [2 components] [$950/mo cap]         ││
│  │ Source  │ │  human-in-the-loop      [Request]     ││
│  │         │ └───────────────────────────────────────┘│
│  │         │  … 5 more package cards (real data,      │
│  │         │    catalog.listPackages) …                │
│  └────────┘                                           │
└──────────────────────────────────────────────────────┘
```

Packages tab reads real `catalog.listPackages`; Request calls
`catalog.requestAssignment` for real (previously visual-only). Components /
Discovery tabs are wired to the Wave-0 `library.*` placeholder — well-built
empty states until docs/guides/01-library-artifactory.md lands.

---

## / — Dashboard

```
┌──────────────────────────────────────────────────────┐
│  Dashboard                                           │
│  Agent Resource Management — …                       │
│  ● Live via tRPC · tenant: tn_demo                   │
│                                                      │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐     │
│  │ Monthly │  │ Active  │  │ Proxied │  │ Budget  │     │
│  │ Spend   │  │ Agents  │  │ Traffic │  │ Util.   │     │
│  │ $5,975  │  │ 47      │  │ 84%     │  │ 73%     │     │
│  └────────┘  └────────┘  └────────┘  └────────┘     │
│                                                      │
│  ┌──────────────────────────┐  ┌──────────────┐     │
│  │ Spend Trend (30 days)     │  │ Agents by    │     │
│  │                           │  │ Priority Tier│     │
│  │ ╱╲    ╱╲                 │  │              │     │
│  │╱  ╲  ╱  ╲   ╱╲          │  │   ◐ donut    │     │
│  │    ╲╱    ╲╱  ╲          │  │ crit · std   │     │
│  │ claude gpt glm           │  │ · background │     │
│  └──────────────────────────┘  └──────────────┘     │
│                                                      │
│  ┌──────────────────────┐  ┌──────────────────┐     │
│  │ Spend by Model       │  │ Top Agents       │     │
│  │ ████ Claude  $2720   │  │ incident-triage  │     │
│  │ ████ GPT-4o  $1990   │  │ hot-issue-resolv │     │
│  │ ██   GLM     $925    │  │ code-review-bot  │     │
│  │ █    DeepSk  $340    │  │ test-gen         │     │
│  └──────────────────────┘  └──────────────────┘     │
└──────────────────────────────────────────────────────┘
```

---

## /agents — Agent List

```
┌──────────────────────────────────────────────────────┐
│  Agents                             [all] [active] [disabled] │
│  Governed identities — Invariant §11.7              │
│                                                      │
│  8 agents · tenant: tn_demo                         │
│  ┌────────────────────────────────────────────────┐  │
│  │ Agent       │ Tier   │ Stakeholder │ Scope    │  │
│  ├─────────────┼────────┼─────────────┼──────────┤  │
│  │ incident-…  │ CRIT   │ @s.chen     │ Team:SRE │  │
│  │ hot-issue-… │ CRIT   │ @s.chen     │ Team:Pay │  │
│  │ code-revie… │ STD    │ @j.park     │ Team:Plt │  │
│  │ test-gen    │ STD    │ @j.park     │ Team:Plt │  │
│  │ ux-optimizer│ BG     │ @m.kim      │ Dept:Prd │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

---

## /spend — Cost Breakdown

**Updated D10** (docs/guides/02-server-panels.md §1): the primary chart is
now cost-per-active-seat + cost-per-work-product; closed-vs-self-hosted
model mix is demoted to a secondary, "reported not campaigned for" panel
(A1: on-prem is nice-to-have):

```
┌──────────────────────────────────────────────────────┐
│  Spend                                               │
│  Cost per active seat & per work product — secondary │
│  to adoption (A1); model mix is reported, not         │
│  campaigned for                                       │
│                                                      │
│  ┌────────────────────┐  ┌────────────────────────┐  │
│  │ Cost per Active Seat │  │ Cost per Work Product   │  │
│  │ = spend ÷ weekly-    │  │ [sample data]           │  │
│  │   active (adoption.  │  │ 8D Report      $214     │  │
│  │   activeUsers)        │  │ PPAP Sub.      $312     │  │
│  │   $148/mo             │  │ → /governance detail    │  │
│  └────────────────────┘  └────────────────────────┘  │
│                                                      │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐     │
│  │ Total   │  │ Budget  │  │ Closed  │  │ Self-   │     │
│  │ Monthly │  │ Used    │  │ Models  │  │ Hosted  │     │
│  │ $16,170 │  │ 73%     │  │ $4,710  │  │ $1,265  │     │
│  └────────┘  └────────┘  └────────┘  └────────┘     │
│                                                      │
│  Model Mix — Secondary (on-prem tracked, not targeted)│
│  ┌──────────────────────────┐  ┌──────────────────┐ │
│  │ Spend Trend (30 days)     │  │ Spend by Model    │ │
│  └──────────────────────────┘  └──────────────────┘ │
└──────────────────────────────────────────────────────┘
```

---

## /access — JIT Approval Queue

```
┌──────────────────────────────────────────────────────┐
│  Access                                              │
│  JIT access requests — short-TTL (§6.4)             │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │ Pending Approvals (2)                          │  │
│  ├──────────────┬──────────────────┬─────────────┤  │
│  │ Agent        │ Resource         │ Status      │  │
│  ├──────────────┼──────────────────┼─────────────┤  │
│  │ incident-…   │ s3://prod-logs/  │ ⏳ pending  │  │
│  │ data-pipe…   │ db://analytics/  │ ⏳ pending  │  │
│  └──────────────┴──────────────────┴─────────────┘  │
└──────────────────────────────────────────────────────┘
```

---

## /audit — Access Audit Log (placeholder, lands 1.1)

```
┌──────────────────────────────────────────────────────┐
│  Audit                                               │
│  Access audit events — every decision logged (§4.2) │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │            Audit log viewer                    │  │
│  │  Reads from ClickHouse access_audit_event     │  │
│  │  — lands with 1.1                              │  │
│  │                                                │  │
│  │  [allow · deny · jit_grant]                   │  │
│  │  [PARTITION BY (tenant_id, toYYYYMM(ts))]     │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```
