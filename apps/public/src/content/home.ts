import type { DeploymentRow } from "./types";

/**
 * The ninety-second story. Order is locked by A1 (docs/guides/README.md):
 * adoption at scale → governance → cost → deployment. Do not reorder without
 * updating A1 first.
 */

export const hero = {
  eyebrow: "Agent Resource Management",
  headline: "Most employees with an AI seat never get a working agent.",
  subhead:
    "Companies buy AI seats and a small technical minority configures something useful. Everyone else never gets a correctly set up agent — adoption stalls, and nobody can see it happening. ARM is the HR system for AI agents: it gets a governed, metered agent into everyone's hands, and shows management who's actually using it.",
  ctaLabel: "See it work",
  ctaHref: "/demo",
  secondaryCtaLabel: "Read the product story",
  secondaryCtaHref: "/product",
};

export const problem = {
  title: "The adoption gap is invisible until someone measures it",
  body: "A CIO can see the AI seat count and the AI bill. What almost nobody can see is the gap between them: how many of those seats are attached to a person who has an agent that actually works, configured for their job, inside the company's guardrails. That gap is where the AI budget quietly evaporates.",
};

export const adoptionSection = {
  kicker: "01 — Adoption at scale",
  title: "From questionnaire to a working agent, in minutes, with no terminal",
  body: "An employee opens a link, answers a handful of multiple-choice questions about their job — no free text, nothing that could contain sensitive content — and gets a recommendation: the package built for their role, in plain language. One download, one signed client, one setup token. No role key to type, no config file to edit.",
  screenshots: [
    {
      src: "/screenshots/orgtree-manufacturing.png",
      width: 1100,
      height: 1243,
      alt: "Manufacturing org tree showing departments, agent counts, and spend rolling up from Team to Org level",
      caption: "The org tree a manager sees, built from the questionnaire's structured answers — not free text.",
    },
    {
      src: "/screenshots/profile-tech-review.png",
      width: 1100,
      height: 952,
      alt: "Package recommendation review screen showing a recommended work package with its included components and required approvals",
      caption: "What the employee sees at the end of the questionnaire: the recommended package, plainly described.",
    },
    {
      src: "/screenshots/profile-manufacturing-done.png",
      width: 1100,
      height: 785,
      alt: "Completed provisioning screen confirming an agent is configured and ready to use",
      caption: "Provisioning complete — the agent is configured, metered, and governed before the employee writes a prompt.",
    },
  ],
  managementLede: "The other half of adoption is visibility for the people paying for it.",
  managementBody:
    "The activation funnel shows a CIO which departments actually have working agents and where people are stalling — at the questionnaire, at download, at first connection. A department with high spend and low activation is a different problem than one with neither, and today almost no one can tell the two apart.",
};

export const governanceSection = {
  kicker: "02 — Governance that comes with it, not bolted on after",
  title: "Every agent has one accountable human",
  points: [
    {
      title: "One stakeholder per agent",
      body: "stakeholder_user_id is required at the schema level (Invariant 7) — no anonymous automation, including agents a system spawns on its own.",
    },
    {
      title: "Budgets inherit down the org tree",
      body: "Org → Department → Group → Team → Workstream. A team's budget is a slice of its department's, not a number typed in twice.",
    },
    {
      title: "Tool access is authorized and audited",
      body: "Every permission is a well-formed grant, not a wildcard. Higher-level deny always wins in resolution (Invariant 3) — a policy set at the org root cannot be overridden by a looser one further down.",
    },
    {
      title: "Prompt bodies never leave the customer's network",
      body: "The control plane sees metadata and audit events only — tokens, cost, timestamps, decisions. Prompt content and resource bodies stay in the tenant's own VPC (Invariant 1). See /architecture for the boundary diagram.",
    },
  ],
};

export const costSection = {
  kicker: "03 — Cost control (secondary, by design)",
  title: "Cost per active seat, not just cost per token",
  body: "Once agents are actually adopted, the next question is what they cost per person actually using one, and per unit of work produced — not just a token bill. Budgets and priority tiers keep spend inside limits set at the right level of the org; the savings ledger shows what switching a workstream to a self-hosted open model would save, with the tradeoff shown, not hidden.",
};

export const deploymentSection = {
  kicker: "04 — Deployment",
  title: "SaaS or self-hosted. Bring your own models if you want them.",
  body: "One codebase serves both delivery models — self-hosted is the degenerate single-tenant case, not a fork. The data plane always runs inside the customer's own VPC, in both models.",
};

export const deploymentTable: DeploymentRow[] = [
  { dimension: "Control plane", saas: "ARM-operated, multi-tenant", selfHosted: "Customer-operated, single-tenant" },
  { dimension: "Data plane", saas: "Per-tenant, in customer VPC", selfHosted: "Customer VPC (same packaging)" },
  { dimension: "Model provider keys", saas: "ARM brokers on your behalf", selfHosted: "Your own keys — pass-through, never leave your environment" },
  { dimension: "Open / self-hosted models", saas: "Optional — bring your own if you want them", selfHosted: "Optional — bring your own if you want them" },
];

export const honestyNote =
  "Every number on this page traces to a committed source — a real simulation run in this repo, or a labelled fixture. Nothing here is a projection dressed up as a result.";
