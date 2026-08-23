import type { PhaseRow } from "./types";

/**
 * Sourced from docs/implementation-audit.md (living scorecard) and
 * docs/arm-spec.md §9 (Phase Plan), read in full before writing this file
 * per guide 04 §2. Status reflects the audit at the time this page was
 * written — link to the audit itself for the current state rather than
 * letting this list drift.
 *
 * The D10 adoption-first restructure (component registry, artifactory,
 * questionnaire onboarding, adoption dashboards — docs/guides/) was in
 * progress, built by parallel modules, as this page was written. Anything
 * from that restructure is marked "in_progress": this page cannot see
 * whether a concurrently-built module has landed, so it does not claim it has.
 */
export const phasePlan: PhaseRow[] = [
  {
    phase: "1.0",
    title: "Foundation",
    status: "shipped",
    detail:
      "Monorepo, Postgres schema (22 tables), ClickHouse event ledger, 7 mutation-proofed guardrails, CI, and a Next.js dashboard shell on fixture data. 100% of audited items complete.",
  },
  {
    phase: "1.1",
    title: "LLM metering & dashboards",
    status: "in_progress",
    detail:
      "Provider billing connectors, org-tree cost rollups, savings estimator, model-mix and security-flagging dashboards shipped. Still open: SSE realtime, hosting-cost model, live Postgres/ClickHouse wiring, real worker scheduling (~75% complete per the audit).",
  },
  {
    phase: "1.2",
    title: "Closed-proxy + open-gateway data plane",
    status: "planned",
    detail:
      "Hono closed-proxy, vLLM open-gateway, meter-agent, Helm/Terraform packaging. This is where prompt traffic starts actually flowing through ARM instead of being read from provider billing APIs after the fact.",
  },
  {
    phase: "1.3 – 1.4",
    title: "Resource access: cloud, DB & collaboration connectors",
    status: "planned",
    detail:
      "S3/GCS mint-strategy connectors, DB proxy connector, SharePoint/OneDrive sync connector, JIT approval workflow, policy simulator.",
  },
  {
    phase: "1.5",
    title: "Work packages — foundation",
    status: "shipped",
    detail:
      "Component registry precursor (tool registry), work package / version / assignment schema, budget reservations, canonical-manifest hashing, pilot packages seeded across four industry profiles.",
  },
  {
    phase: "1.6 – 1.7",
    title: "One-click provisioning, governance loop, moat metrics",
    status: "in_progress",
    detail:
      "The D10 adoption-first restructure: component registry generalization, the artifactory (immutable content-addressed storage), the web questionnaire and signed downloader, and adoption/activation dashboards. Contracts are frozen and landed; the four module implementations were being built in parallel as this page was written.",
  },
];

export const scorecardNote =
  "Full evidence table: docs/implementation-audit.md. Updated on every PR that changes what's built.";
