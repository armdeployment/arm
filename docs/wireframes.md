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

```
┌──────────┬──────────────────────────────────────────────────────┐
│ SIDEBAR  │  TOPBAR (optional: tenant switcher, user menu)        │
│          ├──────────────────────────────────────────────────────┤
│ ▣ Dashbd │                                                       │
│ ◇ Agents │  PAGE CONTENT                                         │
│ $  Spend │                                                       │
│ 🔓Access │                                                       │
│ 📋 Audit │                                                       │
│          │                                                       │
│ ──────── │                                                       │
│ Tenant:  │                                                       │
│ Acme     │                                                       │
│ v0.5     │                                                       │
└──────────┴──────────────────────────────────────────────────────┘
```

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

```
┌──────────────────────────────────────────────────────┐
│  Spend                                               │
│  LLM metering, cost attribution, savings (§7)       │
│                                                      │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐     │
│  │ Total   │  │ Closed  │  │ Self-   │  │ Savings │     │
│  │ Monthly │  │ Models  │  │ Hosted  │  │ Opport. │     │
│  │ $5,975  │  │ $4,710  │  │ $1,265  │  │ $1,884  │     │
│  └────────┘  └────────┘  └────────┘  └────────┘     │
│                                                      │
│  ┌──────────────────────────────────────────────────┐│
│  │ Spend Trend (30 days)                            ││
│  │ [area chart — same as dashboard]                 ││
│  └──────────────────────────────────────────────────┘│
│  ┌──────────────────────────────────────────────────┐│
│  │ Spend by Model                                   ││
│  │ [bar chart — same as dashboard]                  ││
│  └──────────────────────────────────────────────────┘│
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
