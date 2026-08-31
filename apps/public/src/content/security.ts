import type { InvariantRow } from "./types";

export const securityHero = {
  title: "Security and data boundaries",
  body: "Eight invariants govern everything ARM builds. They are enforced as executable guardrails in CI, not prose — every one has a mutation proof: break the protected behavior, watch the check fail, restore it byte-identically. Source: docs/arm-spec.md §11 and §14.1.",
};

export const invariants: InvariantRow[] = [
  {
    n: 1,
    statement:
      "Prompt bodies and resource content never leave the tenant VPC. The control plane is metadata and audit only.",
    guardrail:
      "no-content-egress — event schemas carry no content fields; data-plane egress allowlist lint",
  },
  {
    n: 2,
    statement: "One agent identity, two stable IDs (sub_account_id and agent_id), linked 1:1.",
    guardrail: "Event-shape contract tests on packages/proto",
  },
  {
    n: 3,
    statement: "Higher-level deny always wins in access resolution.",
    guardrail:
      "Property-based tests on the policy resolver — randomized scope trees with deny injection",
  },
  {
    n: 4,
    statement: "Short-lived credentials everywhere a credential is minted.",
    guardrail:
      "Delegate-key TTL enforcement; setup tokens stored as a hash, 15-minute TTL, single use",
  },
  {
    n: 5,
    statement:
      "Hybrid identity story: ARM-issued OIDC where federated, a sealed tenant vault where not.",
    guardrail: "OIDC issuer + RBAC test suite (packages/auth)",
  },
  {
    n: 6,
    statement:
      "ClickHouse partitioned by (tenant_id, toYYYYMM(ts)) from day one — non-negotiable at multi-tenant scale.",
    guardrail: "Runtime partition assertion on every event table",
  },
  {
    n: 7,
    statement:
      "Every agent has exactly one accountable human stakeholder — no anonymous automation.",
    guardrail: "stakeholder_user_id NOT NULL at the schema level + API validation test",
  },
  {
    n: 8,
    statement:
      "Priority is policy, not self-declared — elevated tiers require scope-admin approval.",
    guardrail:
      "Tier-assignment audit trail; enforcement ladder (downgrade → throttle → queue) tested uniformly",
  },
];

export const guardrailPhilosophy = {
  title: "A guard that can't fail is worse than no guard",
  body: "Every security guardrail in this repo has a mutation proof — the person who wrote it deliberately broke the thing it protects, watched the check turn red, and restored the code byte-identically. Checks asserting a negative fail loudly on empty input; a lint that scans zero files is treated as red, not green.",
};

export const deploymentModels = {
  title: "SaaS or self-hosted — one codebase",
  body: "The multi-tenant schema serves both. Self-hosted is the degenerate single-tenant case, not a fork, so there's no separate code path to fall behind.",
  rows: [
    {
      label: "SaaS (default)",
      detail:
        "ARM-operated control plane, multi-tenant. Data plane still runs in your VPC. Target: small/mid companies.",
    },
    {
      label: "Self-hosted enterprise",
      detail:
        "Customer-operated control plane, single tenant. Your own provider keys, pass-through, never touch ARM's infrastructure. Target: large or regulated enterprises.",
    },
  ],
};

export const onPremNote =
  "Self-hosted open models are supported as a bring-your-own option in both delivery models — a row in the deployment table, not a product built around them (A1).";
