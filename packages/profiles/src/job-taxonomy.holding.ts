/**
 * Holding-company job-function taxonomy (D10 — docs/guides/01-library-artifactory.md §3).
 *
 * A minimal set, per the guide — the holding profile models a subsidiary-of-
 * subsidiaries structure with a small corporate-center headcount, so this
 * covers its two seeded work packages plus a couple of adjacent corporate
 * roles.
 */

import type { JobFunctionSeed } from "./types.js";

export const HOLDING_JOB_FUNCTIONS: JobFunctionSeed[] = [
  {
    key: "consolidation_analyst",
    name: "Consolidation Analyst",
    functionFamily: "Corporate Finance",
    aliases: ["consolidation analyst"],
    headcountWeight: 10,
  },
  {
    key: "portfolio_manager",
    name: "Portfolio Manager",
    functionFamily: "Corporate Finance",
    aliases: ["portfolio manager"],
    headcountWeight: 4,
  },
  {
    key: "corporate_secretary",
    name: "Corporate Secretary",
    functionFamily: "Corporate Governance",
    aliases: ["corporate secretary"],
    headcountWeight: 2,
  },
  {
    key: "investor_relations_manager",
    name: "Investor Relations Manager",
    functionFamily: "Corporate Finance",
    aliases: ["investor relations manager"],
    headcountWeight: 4,
  },
  {
    key: "executive_assistant",
    name: "Executive Assistant",
    functionFamily: "Business Services",
    aliases: ["ea", "exec assistant"],
    headcountWeight: 6,
  },
  {
    key: "senior_manager",
    name: "Senior Manager",
    functionFamily: "Business Services",
    aliases: ["department head", "senior manager", "team lead"],
    headcountWeight: 6,
    marketTier: "beachhead",
  },
];
