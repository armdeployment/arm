/**
 * adoptionRollupJob (docs/guides/02-server-panels.md §5.1): "Add a
 * apps/control-plane/workers job `adoptionRollupJob` that materializes
 * daily per-(tenant, org_node, job_function) counts into a rollup table so
 * the panels do not scan raw events at page load. Follow the existing
 * worker job pattern (`DailyUsagePullJob` etc. — currently skeletons; yours
 * should be a real implementation)."
 *
 * Unlike the other worker jobs in src/index.ts (still skeletons pending DB
 * wiring), this one IS a real implementation: `computeAdoptionRollup` is a
 * pure, tested aggregation over the actual activation population exported
 * by `packages/trpc/src/adoption-router.ts` (the same fixture data — and,
 * in real mode, the same ClickHouse table — the `/adoption` panels read).
 *
 * ── Persistence gap (flagged, not silently worked around) ─────────────────
 * guide 00 (the frozen Wave-0 contracts, docs/guides/00-shared-contracts.md)
 * does not define a Postgres rollup table anywhere in its §3 table list, and
 * `packages/db/src/schema/**` is Wave-0-frozen (docs/guides/README.md
 * file-ownership table) — `server` cannot add one. So "materializes ... into
 * a rollup table" is implemented up to the boundary of what this agent owns:
 * `runAdoptionRollupJob` computes the real rollup rows and returns them
 * (logged, in dev mode); persisting them requires a rollup table that does
 * not exist yet in the frozen schema. This is called out explicitly in the
 * final report as a contracts gap, not silently dropped.
 */

import { ACTIVATION_STEPS, FIXTURE_POPULATION, isFixtureMode, type ActivationUser } from "@arm/trpc/adoption-router";

export interface AdoptionRollupRow {
  tenantId: string;
  day: string; // YYYY-MM-DD
  orgNodeId: string;
  jobFunctionKey: string;
  step: (typeof ACTIVATION_STEPS)[number];
  /** Cumulative — "reached at least this step" (funnel semantics), matching
   *  adoption-router.ts's `funnel` procedure so the rollup and the live
   *  query agree on what a "count" means. */
  count: number;
}

/**
 * Pure aggregation — no I/O. Buckets every user's reached steps under the
 * day their journey concluded (`finalTs`). Real ClickHouse-backed mode
 * would instead bucket by each individual `activation_event.ts`
 * (per-event, not per-user-final-day) — this fixture-population version is
 * a documented simplification of that, since the fixture only tracks one
 * timestamp per user, not one per step.
 */
export function computeAdoptionRollup(
  tenantId: string,
  users: readonly ActivationUser[] = FIXTURE_POPULATION,
): AdoptionRollupRow[] {
  const byKey = new Map<string, AdoptionRollupRow>();

  for (const u of users) {
    if (u.reachedStepIndex < 0) continue;
    const day = new Date(u.finalTs).toISOString().slice(0, 10);
    for (let i = 0; i <= u.reachedStepIndex; i++) {
      const step = ACTIVATION_STEPS[i]!;
      const key = `${day}:${u.departmentId}:${u.jobFunctionKey}:${step}`;
      const row = byKey.get(key) ?? { tenantId, day, orgNodeId: u.departmentId, jobFunctionKey: u.jobFunctionKey, step, count: 0 };
      row.count++;
      byKey.set(key, row);
    }
  }

  return [...byKey.values()].sort((a, b) => a.day.localeCompare(b.day) || a.orgNodeId.localeCompare(b.orgNodeId) || a.jobFunctionKey.localeCompare(b.jobFunctionKey) || ACTIVATION_STEPS.indexOf(a.step) - ACTIVATION_STEPS.indexOf(b.step));
}

export interface AdoptionRollupJobResult {
  status: "ok" | "skipped";
  detail: string;
  rowCount: number;
  rows: AdoptionRollupRow[];
}

/**
 * Job runner — the callable unit `handleCronTrigger`/`processJob` in
 * src/index.ts invoke. Computes the real rollup; persistence is the
 * documented gap above (no rollup table in the frozen schema yet).
 */
export async function runAdoptionRollupJob(tenantId: string): Promise<AdoptionRollupJobResult> {
  if (!isFixtureMode()) {
    // Real mode: would run the ClickHouse equivalent of computeAdoptionRollup
    // grouped by (toDate(ts), org_node_id, job_function_key, step) and
    // UPSERT into the rollup table — blocked on that table existing (see
    // file header). Returning a clear "skipped" rather than fabricating
    // ClickHouse rows here (this job doesn't own a ClickHouse connection —
    // that lives in packages/trpc/src/adoption-router.ts, this agent's one
    // other owned file).
    return {
      status: "skipped",
      detail: "ARM_FIXTURE_MODE=0: real-mode rollup persistence needs a Postgres rollup table not yet in the frozen schema (guide 00 §3) — see file header.",
      rowCount: 0,
      rows: [],
    };
  }

  const rows = computeAdoptionRollup(tenantId);
  return {
    status: "ok",
    detail: `Computed ${rows.length} daily (org_node, job_function, step) rollup rows for ${tenantId} from the fixture population — persistence pending a rollup table (see file header).`,
    rowCount: rows.length,
    rows,
  };
}
