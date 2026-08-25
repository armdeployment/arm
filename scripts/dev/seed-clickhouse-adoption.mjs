#!/usr/bin/env node
/**
 * Seed a live ClickHouse `activation_event` table with data derived from
 * the SAME deterministic FIXTURE_POPULATION packages/trpc/src/
 * adoption-router.ts uses for ARM_FIXTURE_MODE=1 — so fixture mode and
 * ClickHouse real mode tell the same story for a given tenant (the file's
 * own stated design goal), rather than seeding a second, independently
 * invented dataset.
 *
 * Each ActivationUser (a per-user SUMMARY: which step they reached, how it
 * ended) is expanded into individual per-step events, since that's what
 * the real activation_event schema is (an event log, not a summary table):
 *   - one 'ok' event per step from 0..reachedStepIndex
 *   - one final event at the drop step, outcome = the user's outcome
 *     (skipped for users who reached the last step — nothing to drop from)
 * Timestamps are synthesized backward from `finalTs`, evenly spaced, with
 * the questionnaire_started -> first_metered_call gap anchored to the
 * user's real `timeToValueMs` where available, so the timeToValue panel
 * sees a realistic distribution rather than a degenerate one.
 *
 * Usage: CLICKHOUSE_URL=http://arm:arm_dev_password@localhost:8123 \
 *          ARM_SEED_TENANT_ID=d9d9d9d9-0000-4000-8000-000000000001 \
 *          node scripts/dev/seed-clickhouse-adoption.mjs
 */
import { ACTIVATION_STEPS, FIXTURE_POPULATION } from "../../packages/trpc/dist/adoption-router.js";

const rawUrl = process.env.CLICKHOUSE_URL ?? "http://arm:arm_dev_password@localhost:8123";
const parsedUrl = new URL(rawUrl);
const authHeader =
  parsedUrl.username || parsedUrl.password
    ? { Authorization: `Basic ${Buffer.from(`${parsedUrl.username}:${parsedUrl.password}`).toString("base64")}` }
    : {};
parsedUrl.username = "";
parsedUrl.password = "";
const clickhouseUrl = parsedUrl.toString();

const TENANT_ID = process.env.ARM_SEED_TENANT_ID ?? "d9d9d9d9-0000-4000-8000-000000000001";
const QUESTIONNAIRE_STARTED_IDX = ACTIVATION_STEPS.indexOf("questionnaire_started");
const FIRST_METERED_CALL_IDX = ACTIVATION_STEPS.indexOf("first_metered_call");
const LAST_STEP_IDX = ACTIVATION_STEPS.length - 1;

function toClickHouseDateTime(ms) {
  // DateTime64(3) via JSONEachRow accepts "YYYY-MM-DD HH:MM:SS.mmm".
  return new Date(ms).toISOString().replace("T", " ").replace("Z", "");
}

/** Expand one per-user summary into per-step event rows. */
function eventsForUser(user) {
  if (user.reachedStepIndex < 0) return []; // never invited — coverage gap, zero events
  const events = [];
  const stepCount = user.reachedStepIndex + 1; // steps 0..reachedStepIndex, inclusive
  const droppedAtNextStep = user.reachedStepIndex < LAST_STEP_IDX;
  const totalSteps = stepCount + (droppedAtNextStep ? 1 : 0);

  // Anchor timestamps: even spacing ending at finalTs, but pull the
  // questionnaire_started->first_metered_call gap from timeToValueMs when
  // both indices are within the reached range.
  const genericGapMs = 45 * 60_000; // 45min/step, generic spread
  const timestamps = new Array(totalSteps);
  timestamps[totalSteps - 1] = user.finalTs;
  for (let i = totalSteps - 2; i >= 0; i--) {
    timestamps[i] = timestamps[i + 1] - genericGapMs;
  }
  if (
    user.timeToValueMs !== null &&
    QUESTIONNAIRE_STARTED_IDX < stepCount &&
    FIRST_METERED_CALL_IDX < stepCount
  ) {
    timestamps[FIRST_METERED_CALL_IDX] = timestamps[QUESTIONNAIRE_STARTED_IDX] + user.timeToValueMs;
  }

  for (let s = 0; s < stepCount; s++) {
    events.push({
      ts: toClickHouseDateTime(timestamps[s]),
      tenant_id: TENANT_ID,
      org_node_id: user.departmentId,
      user_ref: user.userRef,
      job_function_key: user.jobFunctionKey,
      step: ACTIVATION_STEPS[s],
      outcome: "ok",
      package_version_id: "",
      client_version: "1.0.0",
      error_code: "",
      duration_ms: 0,
    });
  }
  if (droppedAtNextStep) {
    events.push({
      ts: toClickHouseDateTime(timestamps[stepCount]),
      tenant_id: TENANT_ID,
      org_node_id: user.departmentId,
      user_ref: user.userRef,
      job_function_key: user.jobFunctionKey,
      step: ACTIVATION_STEPS[user.reachedStepIndex + 1],
      outcome: user.outcome,
      package_version_id: "",
      client_version: "1.0.0",
      error_code: user.errorCode,
      duration_ms: 0,
    });
  }
  return events;
}

const allEvents = FIXTURE_POPULATION.flatMap(eventsForUser);
console.log(`Generated ${allEvents.length} events for ${FIXTURE_POPULATION.length} users (tenant ${TENANT_ID}).`);

const body = allEvents.map((e) => JSON.stringify(e)).join("\n");
const res = await fetch(`${clickhouseUrl}?query=${encodeURIComponent("INSERT INTO activation_event FORMAT JSONEachRow")}`, {
  method: "POST",
  body,
  headers: authHeader,
});
if (!res.ok) {
  throw new Error(`ClickHouse insert failed (${res.status}): ${await res.text()}`);
}
console.log("Seed complete.");
