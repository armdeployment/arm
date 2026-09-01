#!/usr/bin/env node
/**
 * Scheduled-job entrypoint.
 *
 * `apps/control-plane/workers` exported `handleCronTrigger` and `processJob`
 * and had no entrypoint, no caller and no scheduler — the module's own
 * comment carried `TODO(1.1): wire to Vercel Cron Jobs / Cloud Scheduler /
 * K8s CronJob`. None of its jobs had ever run on a schedule anywhere.
 *
 *   node src/cli.ts daily
 *   node src/cli.ts hourly
 *
 * The control-plane chart runs it as two CronJobs. Exit code is the contract
 * a scheduler reads: non-zero if any job FAILED, zero if every job either
 * succeeded or was deliberately skipped. A skipped job is not a failure —
 * three of the four are waiting on provider credentials this repo cannot
 * supply — but a skip is reported distinctly so a run of nothing but skips
 * does not read as a run of work.
 */

import { handleCronTrigger, processJob, tenantsToProcess, isFixtureMode } from "./index.js";

const CRON_TYPES = ["daily", "hourly"] as const;
type CronType = (typeof CRON_TYPES)[number];

function parseCronType(argv: string[]): CronType {
  const arg = argv[2];
  if (!arg || !CRON_TYPES.includes(arg as CronType)) {
    console.error(`usage: node src/cli.ts <${CRON_TYPES.join("|")}>`);
    process.exit(2);
  }
  return arg as CronType;
}

async function main(): Promise<void> {
  const cronType = parseCronType(process.argv);
  const started = Date.now();

  const tenants = await tenantsToProcess();
  console.log(
    `[workers] ${cronType} run — ${tenants.length} tenant(s), ` +
      `${isFixtureMode() ? "fixture mode" : "real mode"}`,
  );

  const jobs = await handleCronTrigger(cronType);
  if (jobs.length === 0) {
    console.log(`[workers] nothing scheduled for ${cronType}`);
    return;
  }

  let failed = 0;
  let skipped = 0;
  for (const job of jobs) {
    try {
      const result = await processJob(job);
      if (result.status === "skipped") skipped++;
      console.log(`[workers] ${job.job} ${job.tenantId}: ${result.status} — ${result.detail}`);
    } catch (err) {
      // One tenant's failure must not abandon the rest — a scheduled run that
      // stops at the first bad tenant silently starves every tenant after it.
      failed++;
      console.error(
        `[workers] ${job.job} ${job.tenantId}: FAILED — ` +
          `${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  const ok = jobs.length - failed - skipped;
  console.log(
    `[workers] ${cronType} done in ${Date.now() - started}ms — ` +
      `${ok} ok, ${skipped} skipped, ${failed} failed`,
  );
  if (failed > 0) process.exit(1);
}

/**
 * Releases the Postgres pool.
 *
 * Without this the process never exits in real mode: the pool keeps an open
 * socket, Node sees a live handle, and the run hangs after printing its
 * summary. For a CronJob that is not a cosmetic problem — the Job never
 * completes, the next schedule starts anyway, and pods accumulate until the
 * namespace is full. Found by running it rather than by reading it.
 */
async function shutdown(): Promise<void> {
  if (isFixtureMode()) return;
  try {
    const { closeDb } = await import("@arm/db");
    await closeDb();
  } catch {
    // Nothing to close, or already closed. Never let cleanup mask the result.
  }
}

main()
  .then(shutdown)
  .catch(async (err) => {
    console.error("[workers] run aborted:", err);
    await shutdown();
    process.exit(1);
  });
