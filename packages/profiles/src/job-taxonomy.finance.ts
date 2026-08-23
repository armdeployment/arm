/**
 * Finance-holding-company job-function taxonomy (D10 — docs/guides/01-library-artifactory.md §3).
 *
 * A minimal set, per the guide ("`finance` and `holding` get a minimal set")
 * — the finance profile is a lean office-only tenant (no shop floor), so a
 * handful of finance/back-office roles plus the shared executive-assistant
 * role covers its two seeded work packages.
 */

import type { JobFunctionSeed } from "./types.js";

export const FINANCE_JOB_FUNCTIONS: JobFunctionSeed[] = [
  { key: "financial_analyst", name: "Financial Analyst", functionFamily: "Finance", aliases: ["financial analyst", "fp&a analyst"], headcountWeight: 14 },
  { key: "controller", name: "Controller", functionFamily: "Finance", aliases: ["controller"], headcountWeight: 4 },
  { key: "treasury_analyst", name: "Treasury Analyst", functionFamily: "Finance", aliases: ["treasury analyst"], headcountWeight: 8 },
  { key: "internal_auditor", name: "Internal Auditor", functionFamily: "Finance", aliases: ["internal auditor"], headcountWeight: 8 },
  { key: "compliance_officer", name: "Compliance Officer", functionFamily: "Finance", aliases: ["compliance officer"], headcountWeight: 4 },
  { key: "executive_assistant", name: "Executive Assistant", functionFamily: "Business Services", aliases: ["ea", "exec assistant"], headcountWeight: 6 },
];
