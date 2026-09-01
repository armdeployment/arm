/**
 * ARM Control Plane Workers (spec §7, §9 1.1).
 *
 * Scheduled jobs for billing pipeline:
 *   - Daily usage pull: fetches provider billing-API data for all tenants.
 *   - Reconciliation: compares provider totals vs proxy/gateway metering.
 *   - Drift alerts: pages tenant admin when drift >5%.
 *   - Adoption rollup (docs/guides/02-server-panels.md §5.1): materializes
 *     daily per-(tenant, org_node, job_function) activation counts — see
 *     ./adoption-rollup-job.ts for the real implementation (the other
 *     three jobs below are still skeletons pending DB wiring; this one
 *     isn't).
 *
 * Skeleton for 1.1 — real scheduling lands when DB/ClickHouse wired.
 * For now: exports the job types and a manual trigger for testing.
 */

import { runAdoptionRollupJob } from "./adoption-rollup-job.js";

// ── Job types ──────────────────────────────────────────────────────────────

export interface DailyUsagePullJob {
  job: "daily_usage_pull";
  tenantId: string;
  startDate: string;
  endDate: string;
}

export interface ReconciliationJob {
  job: "reconciliation";
  tenantId: string;
  periodStart: string;
  periodEnd: string;
}

export interface DriftAlertJob {
  job: "drift_alert";
  tenantId: string;
  driftPct: number;
  status: "drift_warning" | "drift_critical";
  message: string;
}

export interface AdoptionRollupJob {
  job: "adoption_rollup";
  tenantId: string;
  day: string;
}

export type WorkerJob = DailyUsagePullJob | ReconciliationJob | DriftAlertJob | AdoptionRollupJob;

export {
  computeAdoptionRollup,
  runAdoptionRollupJob,
  type AdoptionRollupRow,
  type AdoptionRollupJobResult,
} from "./adoption-rollup-job.js";

/** Matches every other router's flag: fixtures unless explicitly disabled. */
export function isFixtureMode(): boolean {
  return (process.env.ARM_FIXTURE_MODE ?? "1") !== "0";
}

/** The tenant the seeded fixtures belong to, shared with @arm/trpc. */
const FIXTURE_TENANT_ID = "d9d9d9d9-0000-4000-8000-000000000001";

// ── Worker runner ─────────────────────────────────────────────────────────

/**
 * Processes a worker job. In production, jobs are enqueued via BullMQ/Redis
 * and picked up by a worker process. For 1.1, this is a callable function
 * that can be triggered manually or via a cron endpoint.
 */
export async function processJob(job: WorkerJob): Promise<{ status: string; detail: string }> {
  // `adoption_rollup` does real work. The other three are still shaped
  // rather than wired, and they are blocked on something this repo cannot
  // supply rather than on effort:
  //
  //   daily_usage_pull  needs @arm/billing's Anthropic/OpenAI Admin API
  //                     connectors, which need real provider credentials.
  //                     Their simulated output must never be written to
  //                     token_usage_event — invented spend is worse than
  //                     missing spend, because it looks like measurement.
  //   reconciliation    compares ClickHouse totals against provider totals;
  //                     it needs the above to have something to compare to.
  //   drift_alert       needs somewhere to deliver an alert.
  //
  // Each returns `status: "skipped"` with the reason, rather than "ok" with
  // fixture text — a scheduled job that reports success for doing nothing is
  // exactly the failure this codebase has been full of.

  switch (job.job) {
    case "daily_usage_pull":
      return {
        status: "skipped",
        detail: `${job.tenantId}: provider usage connectors need real Anthropic/OpenAI Admin API credentials`,
      };
    case "reconciliation":
      return {
        status: "skipped",
        detail: `${job.tenantId}: nothing to reconcile against until daily_usage_pull has real provider totals`,
      };
    case "drift_alert":
      // No delivery channel is configured anywhere, so nothing is sent.
      return {
        status: "skipped",
        detail: `${job.tenantId}: no alert delivery channel configured (${job.message})`,
      };
    case "adoption_rollup": {
      const result = await runAdoptionRollupJob(job.tenantId);
      return { status: result.status, detail: result.detail };
    }
  }
}

/**
 * Every tenant a scheduled run should cover.
 *
 * Was hardcoded to `"tn_demo"` with the comment "in production: SELECT
 * tenant_id FROM tenant" — so a scheduled run would have processed one
 * non-existent tenant and skipped every real one. In fixture mode the demo
 * tenant IS the answer; with a database it comes from the database.
 */
export async function tenantsToProcess(): Promise<string[]> {
  if (isFixtureMode()) return [FIXTURE_TENANT_ID];
  const { getDb, tenantTable } = await import("@arm/db");
  const rows = await getDb().select({ id: tenantTable.id }).from(tenantTable);
  return rows.map((r) => r.id);
}

/**
 * Builds the jobs a scheduled run should process.
 *
 * Invoked by `src/cli.ts`, which the control-plane chart runs as two
 * CronJobs. It previously had no caller at all: this module exported
 * functions, had no entrypoint, and nothing imported it, so none of these
 * jobs had ever run on a schedule anywhere.
 */
export async function handleCronTrigger(cronType: "daily" | "hourly"): Promise<WorkerJob[]> {
  const jobs: WorkerJob[] = [];
  const tenants = await tenantsToProcess();
  const today = new Date().toISOString().slice(0, 10);

  for (const tenantId of tenants) {
    if (cronType === "daily") {
      jobs.push({ job: "daily_usage_pull", tenantId, startDate: today, endDate: today });
      jobs.push({ job: "reconciliation", tenantId, periodStart: today, periodEnd: today });
      jobs.push({ job: "adoption_rollup", tenantId, day: today });
    }
    if (cronType === "hourly") {
      // Drift is computed by the reconciliation job; until that reads real
      // provider totals there is nothing to alert on, so the hourly run
      // enqueues nothing rather than a "Sample drift alert" per tenant.
      // See processJob's note on what daily_usage_pull still needs.
    }
  }

  return jobs;
}
