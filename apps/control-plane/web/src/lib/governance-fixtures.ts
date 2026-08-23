/**
 * Governance page fixture data (docs/guides/02-server-panels.md §1:
 * "Delete src/lib/catalog-mock.ts once /library reads the real router" —
 * done; /governance's package/approval data now comes from the real
 * `catalog.listPackages` / `catalog.listAssignments` procedures, see
 * app/governance/page.tsx).
 *
 * The ONE thing that stays a labeled fixture here: per-package METERED
 * SPEND (`usedUsd`). No router in this Wave-1 slice exposes cost-per-
 * package (that requires joining ClickHouse token_usage_event by
 * package_version_id, which isn't wired anywhere yet — tracked as a gap,
 * not silently invented). `monthlyUsdCap` itself IS real, read from
 * `catalog.listPackages`. Per docs/guides/README.md rule 7 ("no fabricated
 * data... fixtures are labelled as fixtures"), the governance page renders
 * a "Sample data" badge (components/deferred-shell.tsx) next to any panel
 * using this file.
 */

/** roleKey -> sample metered spend this month, for the budget-vs-cap bars. */
export const SAMPLE_USED_USD_BY_ROLE_KEY: Record<string, number> = {
  quality_engineer: 812,
  plc_programmer: 523,
  maintenance_technician: 306,
  office_worker_general: 244,
  exec_assistant: 181,
  material_planner: 612,
};

export interface CostPerWorkProductRow {
  id: string;
  workProduct: string;
  unit: string;
  rawUsd: number;
  reworkRatePct: number;
  effectiveUsd: number;
}

/**
 * Cost per work product with rework-rate counterweight (D9 §moat metric).
 * effective = raw × (1 + reworkRate) — re-opened work products re-burn
 * tokens. Sample data — no router exposes real work-product-level cost
 * attribution yet (tracked gap, see file header).
 */
export const SAMPLE_COST_PER_WORK_PRODUCT: CostPerWorkProductRow[] = [
  { id: "cpwp_8d", workProduct: "8D Report", unit: "$ / 8D", rawUsd: 182, reworkRatePct: 6.2, effectiveUsd: 214 },
  { id: "cpwp_ppap", workProduct: "PPAP Submission", unit: "$ / PPAP", rawUsd: 298, reworkRatePct: 4.1, effectiveUsd: 312 },
  { id: "cpwp_plc", workProduct: "PLC Routine", unit: "$ / routine", rawUsd: 16, reworkRatePct: 9.8, effectiveUsd: 18 },
];
