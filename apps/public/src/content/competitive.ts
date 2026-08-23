import type { FeatureRow } from "./types";

/**
 * Sourced from docs/solutions/competitive-analysis.md (feature matrix +
 * 2026-07-31 landscape research). Names are quoted accurately; no competitor
 * claim here is invented. The framing is reordered to match A1 (adoption
 * first) — the source doc leads with a cost-governance wedge, which this
 * site demotes to the secondary beat per the locked assumption.
 */

export const categoryClaim = {
  headline: "Gateways meter traffic. Policy engines evaluate rules. Neither gets an agent into the hands of an employee who has never used one.",
  body: "LiteLLM, Portkey, and Helicone route, cache, and observe calls that already exist — they assume the employee already has a working agent. TrueFoundry's Agent Gateway and Credo AI's Agent Governor add quotas, audit, and risk scoring on top of that same assumption. Kong and Cloudflare bring generic API-gateway controls with no concept of an agent, a job function, or an accountable human. None of them ships the step before all of that: turning a person who has never opened a terminal into someone with a correctly configured, governed agent.",
};

export const competitiveMatrix: FeatureRow[] = [
  {
    capability: "Non-technical employee onboarding (questionnaire → working agent)",
    arm: "Built as the primary path (A4) — one signed client, a per-user setup token, zero configuration questions at install time",
    gateways: "Not offered — every competitor assumes an engineer configures the agent by hand",
  },
  {
    capability: "Org-tree hierarchical budgeting",
    arm: "First-class: budgets inherit down Org → Department → Group → Team → Workstream",
    gateways: "Flat per-agent or per-workflow quotas (LiteLLM, TrueFoundry); no org hierarchy",
  },
  {
    capability: "Work-type classification (what agents actually do)",
    arm: "job_function + component kind on every agent, rolled up by department",
    gateways: "Cost attribution only — visibility into spend, not into work",
  },
  {
    capability: "Accountable human per agent",
    arm: "stakeholder_user_id required on every agent, enforced at the schema level (Invariant 7)",
    gateways: "RBAC (who can act), not accountability (who answers for it)",
  },
  {
    capability: "Deployment model",
    arm: "SaaS or self-hosted control plane; per-tenant data plane always in the customer VPC",
    gateways: "TrueFoundry matches (VPC/on-prem/air-gapped); most others are SaaS-only",
  },
  {
    capability: "MCP / step-level observability",
    arm: "Not built — tracked as a gap",
    gateways: "TrueFoundry and others ship this; parity item, not a differentiator",
  },
];

export const moatParagraph =
  "The job-function library and the adoption data compound each other. Every questionnaire answer that resolves to no package is a labelled gap in library.gaps — a roadmap item, not a lost user. Every package that does get installed makes the next person with that job function faster to onboard, because the recommendation engine has one more data point about what actually works. A gateway that only meters existing traffic never sees the people who never got an agent in the first place; ARM's funnel starts before that point, so it is the only place in the stack where that gap is visible at all.";

export const competitiveSourceNote =
  "Full matrix and landscape research: docs/solutions/competitive-analysis.md.";
