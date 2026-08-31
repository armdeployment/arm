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

// ── Worker runner (stub — lands 1.1 when DB wired) ────────────────────────

/**
 * Processes a worker job. In production, jobs are enqueued via BullMQ/Redis
 * and picked up by a worker process. For 1.1, this is a callable function
 * that can be triggered manually or via a cron endpoint.
 */
export async function processJob(job: WorkerJob): Promise<{ status: string; detail: string }> {
  // TODO(1.1): Connect to Postgres/ClickHouse for real data.
  //   - Daily usage pull: call anthropicConnector.fetchUsage / openaiConnector.fetchUsage
  //     and INSERT into token_usage_event.
  //   - Reconciliation: SELECT cost totals from ClickHouse, compare to provider totals.
  //   - Drift alert: INSERT alert, send webhook/email to tenant admin.

  switch (job.job) {
    case "daily_usage_pull":
      return {
        status: "ok",
        detail: `Pulled usage for ${job.tenantId} (${job.startDate}–${job.endDate}) — fixture data, pending DB wire`,
      };
    case "reconciliation":
      return {
        status: "ok",
        detail: `Reconciled ${job.tenantId} period ${job.periodStart}–${job.periodEnd} — fixture data, pending DB wire`,
      };
    case "drift_alert":
      return { status: job.status, detail: `Alert sent for ${job.tenantId}: ${job.message}` };
    case "adoption_rollup": {
      const result = await runAdoptionRollupJob(job.tenantId);
      return { status: result.status, detail: result.detail };
    }
  }
}

/**
 * Cron endpoint handler (Next.js API route → scheduled function).
 * TODO(1.1): wire to Vercel Cron Jobs / Cloud Scheduler / K8s CronJob.
 */
export async function handleCronTrigger(cronType: "daily" | "hourly"): Promise<WorkerJob[]> {
  const baseJobs: WorkerJob[] = [];

  if (cronType === "daily") {
    const today = new Date().toISOString().slice(0, 10);
    // All tenants (in production: SELECT tenant_id FROM tenant WHERE deployment = 'saas')
    baseJobs.push({
      job: "daily_usage_pull",
      tenantId: "tn_demo",
      startDate: today,
      endDate: today,
    });
    baseJobs.push({
      job: "reconciliation",
      tenantId: "tn_demo",
      periodStart: today,
      periodEnd: today,
    });
    baseJobs.push({ job: "adoption_rollup", tenantId: "tn_demo", day: today });
  }

  if (cronType === "hourly") {
    baseJobs.push({
      job: "drift_alert",
      tenantId: "tn_demo",
      driftPct: 2.0,
      status: "drift_warning",
      message: "Sample drift alert",
    });
  }

  return baseJobs;
}
