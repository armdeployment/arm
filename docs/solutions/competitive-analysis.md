---
title: Competitive Analysis — ARM vs TrueFoundry Agent Gateway
date: 2026-07-27
status: living
audience: product + engineering
---

# Competitive Analysis: ARM vs TrueFoundry Agent Gateway

## Review methodology (gstack)

Systematic comparison of TrueFoundry Agent Gateway's public product surface against
ARM's spec v0.5 and current implementation. Focus on gaps for three verticals:
general company, manufacturing, finance.

---

## Feature comparison matrix

| Capability | TrueFoundry Agent Gateway | ARM (current) | ARM (differentiation potential) |
|---|---|---|---|
| **Org-tree hierarchical budgeting** | ❌ Per-agent/per-workflow quotas only | ✅ Implemented (10 dept, 60 agents, $16K/mo) | **Strong differentiator** — no competitor does this |
| **Priority tiers (critical/std/bg)** | ❌ Not mentioned | ✅ Schema + policy layer | Unique auto-downgrade/throttle/queue |
| **Dept-level work-type classification** | ❌ Cost attribution only | ✅ taskType on all agents + workTypes query | **Strong differentiator** — see WHAT agents do |
| **Classification clearance gating** | ❌ Not mentioned (custom guardrails generic) | ✅ clearance field on agents (planned DLP gate) | Differentiator when enforced |
| **Stakeholder accountability** | ❌ RBAC only (role-based) | ✅ stakeholder_user_id NOT NULL per agent | Human accountability = trust for enterprises |
| **Dual delivery (SaaS + self-hosted)** | ✅ VPC / On-Prem / Air-Gapped | ✅ Schema supports both (§3.4) | Parity |
| **SSO / RBAC** | ✅ Yes | 🔶 Packages/auth skeleton exists | Need to implement |
| **Agent quotas (token/cost)** | ✅ Per agent/workflow/env | 🔶 Budget caps per scope exist | Parity |
| **Audit trails** | ✅ Full logging | ✅ access_audit_event table | Parity |
| **MCP integration** | ✅ Agent-to-tool MCP | ❌ Not planned yet | **Needs adding** for enterprise tool access |
| **Step-level observability** | ✅ Latency, errors, retries | ❌ OTel baseline only | **Needs adding** for enterprise parity |
| **Open source** | ✅ Linux Foundation project | ❌ Proprietary (for now) | Consider if needed |
| **Deployment** | VPC, On-Prem, Air-Gapped | Docker Compose + Helm planned | Parity planned |
| **Pricing** | Per-request + enterprise custom | Not defined (deferred) | TBD |

---

## Vertical gap analysis

### General Company

**Needs**: Cost visibility, budget control, SSO, easy onboarding.

| Gap | Priority | Current state | Recommendation |
|---|---|---|---|
| SSO / IdP integration | 🔴 High | auth package skeleton | Complete OIDC SSO + Okta/Entra connector |
| Quick-start onboarding | 🟡 Medium | arm agent init planned | Needs implementation before 1.1 |
| Per-user dashboard | 🟢 Nice | Org-scoped only | Add user-scoped views (my agents, my spend) |
| API for external portals | 🟢 Nice | tRPC exists but no REST | Add REST bridge for existing BI tools |

### Manufacturing Company

**Core needs**: Data residency, work-type classification, hierarchical plant→line→team structure, confidential spec protection, integration with PLM/MES systems.

| Gap | Priority | Current state | Recommendation |
|---|---|---|---|
| **Confidential classification gating** | 🔴 High | clearance field exists, gate not enforced | **Implement DLP gate**: confidential content blocked from public models (§6.5) |
| **Work-type dashboard** | 🔴 High | taskType + workTypes query exist | **Build classification UI**: what each department's agents DO |
| MES/PLM integration connector | 🟡 Medium | Not planned | Add as Phase 1.5 connector target |
| Plant-level hierarchy (5+ levels) | 🟡 Medium | 4 levels (org→dept→grp→team) | Add plant/line levels for manufacturing tree |
| Air-gapped deployment | 🟡 Medium | Planned (1.2) | Prioritize for manufacturing compliance |

### Finance Company

**Core needs**: Compliance (SOX, PCI), data classification, audit trails, stakeholder sign-off, budget control per cost center, PII protection.

| Gap | Priority | Current state | Recommendation |
|---|---|---|---|
| **PII/PCI classification enforcement** | 🔴 High | classificationClearance exists | **Add PII classification level + routing gate** |
| **Stakeholder sign-off workflow** | 🔴 High | JIT approval skeleton exists | **Complete approval workflow** with email/webhook |
| Cost-center hierarchy | 🟡 Medium | org-tree can map to cost centers | Add cost_center_id to scopes |
| Compliance reporting | 🟡 Medium | No compliance report | Add audit export (CSV, SOC2, SOX) |
| Retention policy enforcement | 🟡 Medium | Not addressed | Add configurable retention on access_audit_event |

---

## Key differentiators to double down on

### 1. Org-tree hierarchical budgeting

TrueFoundry does per-agent/per-workflow quotas. **No competitor** models the org tree
as a first-class entity for budget flow. ARM's tree view + treemap + drill-down gives
management a complete picture that no gateway product offers.

**Action**: Make this the centerpiece of ARM's marketing and first-run experience.
The CEO should see their org tree with spend on day one.

### 2. Department-level work-type classification

TrueFoundry tracks *cost* per agent. ARM tracks *what the agent does* (taskType).
For manufacturing: "CNC toolpath optimization" vs "Defect detection" tells management
where agent value is created. For finance: "Invoice processing" vs "Cash forecasting"
shows automation ROI per function.

**Action**: Build the work-classification dashboard as the second tab/section.
Show work-type breakdown per department, with classification clearance overlay.

### 3. Classification clearance + LLM routing gate

Neither TrueFoundry nor competitors offer content-classification-gated model routing.
For manufacturing: confidential CAD specs → ONLY self-hosted models. For finance:
PII data → restricted model pool. This is a compliance kill-feature.

**Action**: Implement the classification gate (§6.5) in Phase 1.1, not 1.2.
It's the most defensible compliance feature.

### 4. Stakeholder accountability model

TrueFoundry has RBAC (role-based). ARM has human accountability (stakeholder).
For finance: a named person is accountable for each agent's spend and access.
For manufacturing: the plant manager is responsible for agents on their floor.

**Action**: Surface stakeholder info in every agent row. Add stakeholder dashboard.
Enable stakeholder notifications for budget alerts and JIT requests.

---

## Recommended phase adjustment

Based on this analysis, suggest moving these from deferred phases into 1.1:

1. **Classification DLP gate** (§6.5) — was Phase 2, move to 1.1 for compliance value
2. **Step-level agent observability** — parity with TrueFoundry, move to 1.2
3. **MCP connector integration** — enterprise tool access parity, move to 1.3
4. **Stakeholder approval notifications** — email/webhook, move to 1.1

---

## Verdict

**ARM is differentiated where it counts**: org-tree budgeting and work-type classification
are features no competitor (including TrueFoundry) offers. The largest gaps to close for
enterprise credibility are SSO integration, MCP support, and step-level observability —
all parity features that TrueFoundry already ships.

For manufacturing and finance specifically, the classification clearance gate + stakeholder
accountability are the strongest sales arguments. ARM should lead with these in messaging
and prioritize their implementation in 1.1.
