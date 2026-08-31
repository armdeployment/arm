import type { Stat } from "./types";

/**
 * Every number on this site traces to one of two committed, inspectable sources
 * (guide 04 rule 7 — no fabricated metrics):
 *
 * 1. `apps/simulation/enterprise/RESULTS.md` — a real 9-container multi-agent run
 *    (Postgres + ClickHouse + Ollama, no cloud LLM calls) captured 2026-07-26.
 *    These are measured outputs of that run, not projections.
 * 2. `apps/control-plane/web/src/lib/mock-data.ts` — the dashboard's fixture
 *    dataset used in `ARM_FIXTURE_MODE=1`. These are clearly labelled as
 *    fixtures, per rule 7, wherever they appear.
 *
 * Anything that is a target rather than a measurement (e.g. the <5 minute
 * onboarding exit gate from arm-spec.md §9) is labelled "target", not "result".
 */

export const simulationRunStats: Stat[] = [
  {
    label: "LLM calls metered",
    value: "25",
    source: "apps/simulation/enterprise/RESULTS.md — 2026-07-26 run, 9-container topology",
  },
  {
    label: "Tokens metered",
    value: "2,027",
    source: "apps/simulation/enterprise/RESULTS.md — successful calls only",
  },
  {
    label: "Cloud-equivalent cost tracked",
    value: "$0.22",
    source: "apps/simulation/enterprise/RESULTS.md — across 5 departments, local Ollama inference",
  },
  {
    label: "Savings estimated vs. closed-model pricing",
    value: "$0.33",
    source: "apps/simulation/enterprise/RESULTS.md — same run, savings estimator model",
  },
  {
    label: "DLP blocks (API key in prompt)",
    value: "2",
    source: "apps/simulation/enterprise/RESULTS.md — policy-enforcement table",
  },
];

export const simulationRunMeta = {
  employees: 6,
  departments: 5,
  agentTypes: ["Claude Code", "OpenCode", "Copilot", "Pi"],
  source: "apps/simulation/enterprise/RESULTS.md",
  caveat:
    "A local, committed simulation run — not a live customer deployment. Included because it is the only dataset in this repo that is both real and small enough to be honest about.",
};

export const fixtureDashboardStats: Stat[] = [
  {
    label: "Monthly spend under management",
    value: "$5,975",
    source: "apps/control-plane/web/src/lib/mock-data.ts — fixture tenant, ARM_FIXTURE_MODE=1",
  },
  {
    label: "Agents registered",
    value: "47",
    source: "apps/control-plane/web/src/lib/mock-data.ts — fixture tenant",
  },
  {
    label: "Traffic routed through ARM's proxy/gateway",
    value: "84%",
    source:
      "apps/control-plane/web/src/lib/mock-data.ts — fixture tenant; mirrors the ≥80% exit-gate target in arm-spec.md §9",
  },
];

export const onboardingTarget = {
  label: "First metered call after questionnaire submit",
  value: "< 5 minutes",
  source:
    "docs/arm-spec.md §9 — Phase 1 exit gate target, unassisted, not yet measured in production",
};
