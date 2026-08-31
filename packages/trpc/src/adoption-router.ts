/**
 * Adoption router (docs/guides/02-server-panels.md §5) — implements the six
 * procedures frozen by guide 00 §8: `funnel`, `stalls`, `timeToValue`,
 * `coverage`, `activeUsers`, `recentActivations`.
 *
 * A1 (docs/guides/README.md — locked assumptions): agent adoption at scale
 * is the PRIMARY value prop, cost is secondary, on-prem is nice-to-have.
 * This router is the data spine for that thesis — every shape here answers
 * "how much of the company is actually using agents, where does adoption
 * stall, and what's blocking it," not "what did AI cost us."
 *
 * ── Fixture mode vs ClickHouse mode (guide 02 §5.1) ─────────────────────────
 * `ARM_FIXTURE_MODE` (default "1" — ON) selects the data path:
 *   - fixture mode: a deterministic, seeded synthetic population of
 *     per-user activation journeys (NOT flattering — see FIXTURE_POPULATION
 *     below: real stalls, real abandonment, a real coverage gap). Every
 *     response carries `meta.sampleData: true` so the UI can render the
 *     "sample data" badge guide 02 §5.1 requires (the `site` agent's /demo
 *     depends on that badge existing).
 *   - ClickHouse mode (ARM_FIXTURE_MODE=0): queries `activation_event` over
 *     HTTP against `config.CLICKHOUSE_URL` (packages/config, already had this
 *     env var reserved). Table names/columns are the literal contract from
 *     packages/clickhouse/migrations/0003_adoption.sql (guide 00 §6) — kept
 *     as string literals here rather than an added `@arm/clickhouse` runtime
 *     dependency, because `packages/clickhouse/**` is Wave-0-frozen
 *     (docs/guides/README.md file-ownership table) and this file is the ONE
 *     place `server` may add logic; a query-module addition to
 *     `packages/clickhouse` itself (as guide 02 §5.1 prose suggests) would
 *     mean writing into a directory `server` does not own. This file imports
 *     nothing from `@arm/clickhouse` and instead ships the SQL directly,
 *     documented against the frozen table shape. See the PR description /
 *     final report for this flagged as a deliberate scope decision.
 *
 * NOTE ON JOB FUNCTIONS: guide 00 places `job_function` in
 * `packages/db/src/schema/artifactory.ts`, populated by the `library`
 * Wave-1 agent (docs/guides/01-library-artifactory.md) — not landed yet.
 * The job-function taxonomy used here (keys, names, headcount weights) is
 * therefore a local, self-contained fixture matching the `work_package`
 * `role_key`s already shipped in packages/trpc/src/catalog-router.ts's
 * fixtures, so the two panels tell a consistent story. Real mode reads
 * headcount/job-function names from Postgres once `library` lands that
 * table — the query stub below documents the join.
 */

import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import { config } from "@arm/config";
import type { ARMContext } from "./index.js";
import { isDemoMode, snapshotAllDemoStores, restoreAllDemoStores } from "./demo-mode.js";

// ── tRPC setup (mirrors src/index.ts; routers must not import runtime values back) ──

const t = initTRPC.context<ARMContext>().create();

const tenantProcedure = t.procedure
  .use(async (opts) => {
    const { ctx } = opts;
    if (!ctx.claims || !ctx.tenantId) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message:
          "No authenticated tenant context. All queries require a tenant_id (Invariant §11.6).",
      });
    }
    return opts.next({ ctx: { ...ctx, tenantId: ctx.tenantId } });
  })
  .use(async (opts) => {
    if (!isDemoMode() || opts.type !== "mutation") return opts.next();
    const snapshot = snapshotAllDemoStores();
    try {
      return await opts.next();
    } finally {
      restoreAllDemoStores(snapshot);
    }
  });

// ── Fixture-mode flag ────────────────────────────────────────────────────
//
// Deliberately read straight from process.env rather than routed through
// `@arm/config`'s zod schema: `packages/config` is not in `server`'s
// file-ownership list (docs/guides/README.md), so adding `ARM_FIXTURE_MODE`
// to its parsed shape would mean editing a file this agent doesn't own.
// `config.CLICKHOUSE_URL` already exists there and IS used below for the
// real-mode path.

export function isFixtureMode(): boolean {
  return (process.env.ARM_FIXTURE_MODE ?? "1") !== "0";
}

// ── Scope input (mirrors src/index.ts's scopeInput — guide 02 §5: "every
//    query takes the existing optional scope input so the org-tree
//    drill-down works exactly like the other routers") ─────────────────────

const SCOPE_TYPES = [
  "org",
  "organization",
  "hq",
  "plant",
  "department",
  "group",
  "line",
  "cell",
  "team",
] as const;

const scopeInput = z
  .object({ type: z.enum(SCOPE_TYPES), id: z.string() })
  .nullable()
  .default(null);

type ScopeRef = { type: (typeof SCOPE_TYPES)[number]; id: string } | null;

/** Shared filter shape for all six procedures: scope + job-function +
 *  date-range, per guide 02 §2 ("filterable by department / job function /
 *  package / date range"). */
const adoptionFilterInput = z
  .object({
    scope: scopeInput,
    jobFunctionKey: z.string().nullable().default(null),
    dateFrom: z.string().nullable().default(null),
    dateTo: z.string().nullable().default(null),
  })
  .default(() => ({ scope: null, jobFunctionKey: null, dateFrom: null, dateTo: null }));

type AdoptionFilter = z.infer<typeof adoptionFilterInput>;

// ── Activation step order (packages/proto activationStepSchema, guide 00 §6) ──

export const ACTIVATION_STEPS = [
  "invited",
  "questionnaire_started",
  "questionnaire_completed",
  "token_issued",
  "downloaded",
  "installed",
  "runtime_ready",
  "connections_started",
  "connections_completed",
  "first_metered_call",
  "weekly_active",
] as const;
export type ActivationStepName = (typeof ACTIVATION_STEPS)[number];

const STEP_LABELS: Record<ActivationStepName, string> = {
  invited: "Invited",
  questionnaire_started: "Questionnaire started",
  questionnaire_completed: "Questionnaire completed",
  token_issued: "Setup token issued",
  downloaded: "Client downloaded",
  installed: "Client installed",
  runtime_ready: "Runtime ready",
  connections_started: "Connections started",
  connections_completed: "Connections completed",
  first_metered_call: "First metered call",
  weekly_active: "Weekly active",
};

// ── Deterministic PRNG (mulberry32) — fixtures must be stable across runs
//    so router tests can assert on them without flakiness. ─────────────────

function mulberry32(seed: number): () => number {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Fixture population (guide 02 §5.1: "realistic, not flattering — include
//    stalls, abandonment, and a long tail") ────────────────────────────────

interface JobFunctionFixture {
  key: string;
  name: string;
  departmentId: string;
  departmentName: string;
  /** Matches a catalog-router `work_package.role_key` — null = a genuine
   *  coverage gap: headcount with NO published package (guide 02's
   *  `/library` "gaps" concept, and `coverage` panel's "uncovered weight"). */
  packageRoleKey: string | null;
  packageName: string | null;
  headcount: number;
  /** P(advance | reached) for each of the 11 transitions, index-aligned
   *  with ACTIVATION_STEPS (transition 0 = eligible → invited). */
  conversionRates: readonly number[];
  /** Index into ACTIVATION_STEPS where drop-off gets a specific error code
   *  instead of a generic "abandoned" outcome — this IS the stall. */
  stallStepIndex: number;
  stallErrorCode: string;
  stallLabel: string;
}

const JOB_FUNCTIONS: readonly JobFunctionFixture[] = [
  {
    key: "quality_engineer",
    name: "Quality Engineer",
    departmentId: "dept_qa",
    departmentName: "Quality Assurance",
    packageRoleKey: "quality_engineer",
    packageName: "Quality Engineer",
    headcount: 42,
    conversionRates: [0.95, 0.9, 0.92, 0.97, 0.94, 0.93, 0.96, 0.93, 0.64, 0.94, 0.73],
    stallStepIndex: 8,
    stallErrorCode: "jira_auth_failed",
    stallLabel: "Failed connecting Jira",
  },
  {
    key: "plc_programmer",
    name: "PLC Programmer",
    departmentId: "dept_eng",
    departmentName: "Engineering",
    packageRoleKey: "plc_programmer",
    packageName: "PLC Programmer",
    headcount: 18,
    conversionRates: [0.94, 0.88, 0.93, 0.98, 0.93, 0.91, 0.93, 0.92, 0.88, 0.9, 0.75],
    stallStepIndex: 5,
    stallErrorCode: "tia_portal_license_missing",
    stallLabel: "Missing TIA Portal license",
  },
  {
    key: "maintenance_technician",
    name: "Maintenance Technician",
    departmentId: "dept_mfg",
    departmentName: "Manufacturing",
    packageRoleKey: "maintenance_technician",
    packageName: "Maintenance Technician",
    headcount: 65,
    conversionRates: [0.89, 0.76, 0.91, 0.96, 0.89, 0.87, 0.94, 0.92, 0.91, 0.85, 0.7],
    stallStepIndex: 1,
    stallErrorCode: "questionnaire_abandoned_mobile",
    stallLabel: "Abandoned questionnaire on mobile",
  },
  {
    key: "office_worker_general",
    name: "Office Worker (General)",
    departmentId: "dept_fin",
    departmentName: "Finance",
    packageRoleKey: "office_worker_general",
    packageName: "Office Worker (General)",
    headcount: 210,
    conversionRates: [0.93, 0.92, 0.94, 0.97, 0.91, 0.8, 0.93, 0.96, 0.93, 0.92, 0.76],
    stallStepIndex: 5,
    stallErrorCode: "mdm_push_failed",
    stallLabel: "MDM push failed on corporate device",
  },
  {
    key: "exec_assistant",
    name: "Executive Assistant",
    departmentId: "dept_sales",
    departmentName: "Sales & Marketing",
    packageRoleKey: "exec_assistant",
    packageName: "Executive Assistant",
    headcount: 9,
    conversionRates: [0.99, 0.96, 0.97, 0.98, 0.97, 0.95, 0.98, 0.96, 0.93, 0.96, 0.85],
    stallStepIndex: 8,
    stallErrorCode: "outlook_scope_denied",
    stallLabel: "Denied Outlook mailbox scope",
  },
  {
    key: "material_planner",
    name: "Material Planner",
    departmentId: "dept_sc",
    departmentName: "Supply Chain",
    packageRoleKey: "material_planner",
    packageName: "Material Planner",
    headcount: 24,
    conversionRates: [0.92, 0.87, 0.91, 0.96, 0.87, 0.85, 0.9, 0.79, 0.55, 0.87, 0.72],
    stallStepIndex: 8,
    stallErrorCode: "erp_connector_timeout",
    stallLabel: "Timed out connecting MRP/ERP",
  },
  {
    // Deliberate coverage gap (guide 02 §2 "Gaps" panel, §4 "/library gaps"):
    // real headcount, NO published Work Package targets it yet.
    key: "process_engineer",
    name: "Process Engineer",
    departmentId: "dept_rd",
    departmentName: "Research & Development",
    packageRoleKey: null,
    packageName: null,
    headcount: 15,
    conversionRates: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    stallStepIndex: 0,
    stallErrorCode: "no_package_available",
    stallLabel: "No Work Package published for this role",
  },
];

/** Human-readable label per stall error code — shared by fixture mode
 *  (looked up via the user's job function) and ClickHouse real mode
 *  (looked up directly, since real rows carry error_code but not which
 *  JobFunctionFixture produced it). */
const STALL_LABEL_BY_ERROR_CODE: ReadonlyMap<string, string> = new Map(
  JOB_FUNCTIONS.map((jf) => [jf.stallErrorCode, jf.stallLabel]),
);

export interface ActivationUser {
  userRef: string;
  jobFunctionKey: string;
  departmentId: string;
  /** Index of the LAST step this user reached (inclusive). -1 = never invited. */
  reachedStepIndex: number;
  outcome: "ok" | "error" | "abandoned";
  errorCode: string;
  /** ms since epoch the user reached their final step. */
  finalTs: number;
  /** Only set when reachedStepIndex >= index("first_metered_call"). */
  timeToValueMs: number | null;
}

const FIXTURE_SEED = 0x41524d31; // "ARM1"
const NOW_MS = Date.UTC(2026, 7, 21, 12, 0, 0); // fixed "now" — deterministic fixtures
const WINDOW_DAYS = 30;

function buildFixturePopulation(): ActivationUser[] {
  const rand = mulberry32(FIXTURE_SEED);
  const users: ActivationUser[] = [];
  const ftvIdx = ACTIVATION_STEPS.indexOf("first_metered_call");
  const qStartIdx = ACTIVATION_STEPS.indexOf("questionnaire_started");

  for (const jf of JOB_FUNCTIONS) {
    for (let i = 0; i < jf.headcount; i++) {
      const userRef = `u_${jf.key}_${i.toString(36)}`;
      if (jf.packageRoleKey === null) {
        // Coverage gap: nobody in an unpackaged job function gets invited at all.
        users.push({
          userRef,
          jobFunctionKey: jf.key,
          departmentId: jf.departmentId,
          reachedStepIndex: -1,
          outcome: "abandoned",
          errorCode: "no_package_available",
          finalTs: NOW_MS,
          timeToValueMs: null,
        });
        continue;
      }

      let reached = -1;
      let outcome: ActivationUser["outcome"] = "ok";
      let errorCode = "";
      let elapsedMs = 0;
      const stepDurations: number[] = [];

      for (let s = 0; s < ACTIVATION_STEPS.length; s++) {
        const rate = jf.conversionRates[s]!;
        if (rand() >= rate) {
          // Drop here — attribute to the designated stall if this is that step.
          outcome = s === jf.stallStepIndex ? "error" : "abandoned";
          errorCode = s === jf.stallStepIndex ? jf.stallErrorCode : "";
          break;
        }
        reached = s;
        // Step duration: 30s–20min, long-tail via squared random.
        const stepMs = 30_000 + rand() * rand() * 18 * 60_000;
        elapsedMs += stepMs;
        stepDurations.push(elapsedMs);
      }

      let timeToValueMs: number | null = null;
      if (reached >= ftvIdx) {
        timeToValueMs = stepDurations[ftvIdx]! - stepDurations[qStartIdx]!;
      }

      // Spread final timestamps across the trailing WINDOW_DAYS, weighted so
      // later funnel steps skew more recent (campaign momentum).
      const dayOffset = Math.floor(rand() * WINDOW_DAYS * (reached < 3 ? 1 : 0.6));
      const finalTs = NOW_MS - dayOffset * 86_400_000 - Math.floor(rand() * 86_400_000);

      users.push({
        userRef,
        jobFunctionKey: jf.key,
        departmentId: jf.departmentId,
        reachedStepIndex: reached,
        outcome,
        errorCode,
        finalTs,
        timeToValueMs,
      });
    }
  }
  return users;
}

/** Computed once at module load — pure + deterministic (same seed every
 *  process start), so router tests can assert on exact fixture shape. */
export const FIXTURE_POPULATION: readonly ActivationUser[] = buildFixturePopulation();

// ── Filtering helpers ────────────────────────────────────────────────────

function jobFunctionsInScope(scope: ScopeRef): readonly JobFunctionFixture[] {
  if (!scope || scope.type === "org" || scope.type === "organization") return JOB_FUNCTIONS;
  if (scope.type === "department")
    return JOB_FUNCTIONS.filter((jf) => jf.departmentId === scope.id);
  // Finer scope types (group/team/plant/line/cell/hq) aren't modeled at
  // department-level fixture granularity — fall through to org-wide so the
  // UI never renders a hard error for a valid-but-unmodeled scope. Real
  // ClickHouse mode filters by the actual org_node_id at any granularity
  // (org_node_id is a plain String column, not enum-limited).
  return JOB_FUNCTIONS;
}

function filterUsers(filter: AdoptionFilter): ActivationUser[] {
  const jfs = new Set(jobFunctionsInScope(filter.scope).map((jf) => jf.key));
  const from = filter.dateFrom ? Date.parse(filter.dateFrom) : -Infinity;
  const to = filter.dateTo ? Date.parse(filter.dateTo) : Infinity;
  return FIXTURE_POPULATION.filter((u) => {
    if (!jfs.has(u.jobFunctionKey)) return false;
    if (filter.jobFunctionKey && u.jobFunctionKey !== filter.jobFunctionKey) return false;
    if (u.finalTs < from || u.finalTs > to) return false;
    return true;
  });
}

function meta() {
  const maxTs = FIXTURE_POPULATION.reduce((m, u) => Math.max(m, u.finalTs), 0);
  return {
    source: "fixture" as const,
    sampleData: true,
    /** guide 02 §5.1/§6.2: "stale-data badges driven by actual ledger
     *  freshness, not a constant" — computed from the newest fixture event,
     *  not hardcoded. Real mode computes this from `max(ts)` in ClickHouse. */
    ledgerFreshnessMs: NOW_MS - maxTs,
  };
}

// ── ClickHouse real-mode (ARM_FIXTURE_MODE=0) ───────────────────────────────
//
// HTTP interface query helper. `activation_event` / `component_pull_event`
// are the frozen table names from packages/clickhouse/migrations/
// 0003_adoption.sql (guide 00 §6) — reproduced here as literals rather than
// imported, see the file-header note on why this file doesn't take an
// `@arm/clickhouse` runtime dependency.

/** Node's fetch (undici) throws synchronously on a URL with embedded
 *  userinfo ("Request cannot be constructed from a URL that includes
 *  credentials") — but `postgresql://user:pass@host` / `http://user:pass@
 *  host` is the standard way to express a ClickHouse connection string, and
 *  is exactly what a deployment's CLICKHOUSE_URL will contain. Strip the
 *  credentials out of the URL and carry them as a Basic auth header instead. */
function clickHouseRequestTarget(rawUrl: string): { url: string; headers: Record<string, string> } {
  const parsed = new URL(rawUrl);
  const headers: Record<string, string> = {};
  if (parsed.username || parsed.password) {
    headers["Authorization"] =
      `Basic ${Buffer.from(`${parsed.username}:${parsed.password}`).toString("base64")}`;
    parsed.username = "";
    parsed.password = "";
  }
  return { url: parsed.toString().replace(/\/+$/, ""), headers };
}

async function queryClickHouseJSON<T>(sql: string): Promise<T[]> {
  if (!config.CLICKHOUSE_URL) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "ARM_FIXTURE_MODE=0 but CLICKHOUSE_URL is not configured (packages/config).",
    });
  }
  const { url: base, headers } = clickHouseRequestTarget(config.CLICKHOUSE_URL);
  const url = `${base}/?default_format=JSONEachRow`;
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", body: sql, headers });
  } catch (err) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `ClickHouse connection failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
  if (!res.ok) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `ClickHouse query failed (${res.status}): ${await res.text()}`,
    });
  }
  const text = await res.text();
  if (!text.trim()) return [];
  return text
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as T);
}

/** `tenant_id` is trusted from ctx (already resolved through tenantProcedure
 *  auth) — never taken from client input, mirroring every other router. */
function sqlLiteral(v: string): string {
  return `'${v.replace(/'/g, "\\'")}'`;
}

function scopeToOrgNodeFilter(scope: ScopeRef): string {
  if (!scope) return "";
  return ` AND org_node_id = ${sqlLiteral(scope.id)}`;
}

function dateRangeFilter(filter: AdoptionFilter): string {
  const from = filter.dateFrom ? ` AND ts >= ${sqlLiteral(filter.dateFrom)}` : "";
  const to = filter.dateTo ? ` AND ts <= ${sqlLiteral(filter.dateTo)}` : "";
  const jf = filter.jobFunctionKey
    ? ` AND job_function_key = ${sqlLiteral(filter.jobFunctionKey)}`
    : "";
  return from + to + jf;
}

/** Builds the funnel SQL (guide 02 §5.1's example, generalized with scope +
 *  filters). Exported for unit testing without a live ClickHouse. */
export function buildFunnelSQL(tenantId: string, filter: AdoptionFilter): string {
  return (
    `SELECT step, uniqExact(user_ref) AS c FROM activation_event ` +
    `WHERE tenant_id = ${sqlLiteral(tenantId)} AND outcome = 'ok'` +
    scopeToOrgNodeFilter(filter.scope) +
    dateRangeFilter(filter) +
    ` GROUP BY step`
  );
}

export function buildStallsSQL(tenantId: string, filter: AdoptionFilter): string {
  return (
    `SELECT step, error_code, count() AS c FROM activation_event ` +
    `WHERE tenant_id = ${sqlLiteral(tenantId)} AND outcome != 'ok' AND error_code != ''` +
    scopeToOrgNodeFilter(filter.scope) +
    dateRangeFilter(filter) +
    ` GROUP BY step, error_code ORDER BY c DESC`
  );
}

export function buildTimeToValueSQL(tenantId: string, filter: AdoptionFilter): string {
  // Per user_ref: min(ts) at questionnaire_started -> min(ts) at first_metered_call.
  return (
    `SELECT user_ref, ` +
    `minIf(ts, step = 'questionnaire_started') AS q_start, ` +
    `minIf(ts, step = 'first_metered_call') AS first_call ` +
    `FROM activation_event WHERE tenant_id = ${sqlLiteral(tenantId)}` +
    scopeToOrgNodeFilter(filter.scope) +
    dateRangeFilter(filter) +
    ` GROUP BY user_ref HAVING q_start != toDateTime64(0, 3) AND first_call != toDateTime64(0, 3)`
  );
}

export function buildActiveUsersSQL(tenantId: string, filter: AdoptionFilter): string {
  return (
    `SELECT uniqExact(user_ref) AS c FROM activation_event ` +
    `WHERE tenant_id = ${sqlLiteral(tenantId)} AND step = 'weekly_active' AND outcome = 'ok'` +
    scopeToOrgNodeFilter(filter.scope) +
    dateRangeFilter(filter)
  );
}

/** Distinct users who've reached first_metered_call — a looser bar than
 *  weekly_active (activated vs. currently weekly-active). */
export function buildActivatedSeatsSQL(tenantId: string, filter: AdoptionFilter): string {
  return (
    `SELECT uniqExact(user_ref) AS c FROM activation_event ` +
    `WHERE tenant_id = ${sqlLiteral(tenantId)} AND step = 'first_metered_call' AND outcome = 'ok'` +
    scopeToOrgNodeFilter(filter.scope) +
    dateRangeFilter(filter)
  );
}

/** 8-week weekly-active trend, one row per ISO week. */
export function buildWeeklyActiveTrendSQL(tenantId: string, filter: AdoptionFilter): string {
  return (
    `SELECT toStartOfWeek(ts, 1) AS week_ending, uniqExact(user_ref) AS c FROM activation_event ` +
    `WHERE tenant_id = ${sqlLiteral(tenantId)} AND step = 'weekly_active' AND outcome = 'ok'` +
    scopeToOrgNodeFilter(filter.scope) +
    dateRangeFilter(filter) +
    ` GROUP BY week_ending ORDER BY week_ending ASC LIMIT 8`
  );
}

/** Activated seats PER job function — coverage's real-mode counterpart to
 *  fixture mode's `users.filter(u => u.jobFunctionKey === jf.key && ...)`. */
export function buildCoverageSQL(tenantId: string, filter: AdoptionFilter): string {
  return (
    `SELECT job_function_key, uniqExact(user_ref) AS c FROM activation_event ` +
    `WHERE tenant_id = ${sqlLiteral(tenantId)} AND step = 'weekly_active' AND outcome = 'ok'` +
    scopeToOrgNodeFilter(filter.scope) +
    dateRangeFilter(filter) +
    ` GROUP BY job_function_key`
  );
}

export function buildRecentActivationsSQL(
  tenantId: string,
  filter: AdoptionFilter,
  limit: number,
): string {
  return (
    `SELECT ts, org_node_id, user_ref, job_function_key, step, outcome, error_code ` +
    `FROM activation_event WHERE tenant_id = ${sqlLiteral(tenantId)}` +
    scopeToOrgNodeFilter(filter.scope) +
    dateRangeFilter(filter) +
    ` ORDER BY ts DESC LIMIT ${limit}`
  );
}

// ── Percentile helper ────────────────────────────────────────────────────

function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx]!;
}

// ── Procedures ───────────────────────────────────────────────────────────

export const adoptionRouter = t.router({
  /** Activation funnel — cumulative "reached at least this step" counts +
   *  conversion from the previous step (guide 02 §2/§5). */
  funnel: tenantProcedure.input(adoptionFilterInput).query(async (opts) => {
    if (!isFixtureMode()) {
      const rows = await queryClickHouseJSON<{ step: string; c: string }>(
        buildFunnelSQL(opts.ctx.tenantId!, opts.input),
      );
      const byStep = new Map(rows.map((r) => [r.step, Number(r.c)]));
      const steps = ACTIVATION_STEPS.map((step) => ({
        step,
        count: byStep.get(step) ?? 0,
        label: STEP_LABELS[step],
      }));
      return {
        tenantId: opts.ctx.tenantId!,
        steps: withConversion(steps),
        filters: opts.input,
        meta: { source: "clickhouse" as const, sampleData: false, ledgerFreshnessMs: 0 },
      };
    }
    const users = filterUsers(opts.input);
    const counts = ACTIVATION_STEPS.map((step, i) => ({
      step,
      label: STEP_LABELS[step],
      count: users.filter((u) => u.reachedStepIndex >= i).length,
    }));
    return {
      tenantId: opts.ctx.tenantId!,
      steps: withConversion(counts),
      filters: opts.input,
      meta: meta(),
    };
  }),

  /** Where users stall — step × error_code, plain-language labels (guide 02
   *  §2: "38 stalled connecting Jira", not raw codes). */
  stalls: tenantProcedure.input(adoptionFilterInput).query(async (opts) => {
    if (!isFixtureMode()) {
      const rows = await queryClickHouseJSON<{ step: string; error_code: string; c: string }>(
        buildStallsSQL(opts.ctx.tenantId!, opts.input),
      );
      const total = rows.reduce((n, r) => n + Number(r.c), 0) || 1;
      const stallRows = rows.map((r) => ({
        step: r.step,
        errorCode: r.error_code,
        label: STALL_LABEL_BY_ERROR_CODE.get(r.error_code) ?? r.error_code,
        count: Number(r.c),
        share: Math.round((Number(r.c) / total) * 1000) / 10,
      }));
      return {
        tenantId: opts.ctx.tenantId!,
        rows: stallRows,
        meta: { source: "clickhouse" as const, sampleData: false, ledgerFreshnessMs: 0 },
      };
    }
    const users = filterUsers(opts.input);
    const byKey = new Map<
      string,
      { step: ActivationStepName; errorCode: string; label: string; count: number }
    >();
    for (const u of users) {
      if (u.outcome !== "error" || !u.errorCode) continue;
      const step =
        u.reachedStepIndex >= 0
          ? (ACTIVATION_STEPS[u.reachedStepIndex + 1] ?? ACTIVATION_STEPS[u.reachedStepIndex]!)
          : ACTIVATION_STEPS[0];
      const jf = JOB_FUNCTIONS.find((j) => j.key === u.jobFunctionKey);
      const label = jf?.stallLabel ?? u.errorCode;
      const key = `${step}:${u.errorCode}`;
      const row = byKey.get(key) ?? { step, errorCode: u.errorCode, label, count: 0 };
      row.count++;
      byKey.set(key, row);
    }
    const rows = [...byKey.values()].sort((a, b) => b.count - a.count);
    const total = rows.reduce((n, r) => n + r.count, 0) || 1;
    return {
      tenantId: opts.ctx.tenantId!,
      rows: rows.map((r) => ({ ...r, share: Math.round((r.count / total) * 1000) / 10 })),
      meta: meta(),
    };
  }),

  /** Median/p90 time from questionnaire_started -> first_metered_call
   *  (guide 02 §2: "target line at 10 min"). */
  timeToValue: tenantProcedure.input(adoptionFilterInput).query(async (opts) => {
    const bucketEdgesMin = [5, 10, 15, 30, 60] as const;
    if (!isFixtureMode()) {
      const rows = await queryClickHouseJSON<{
        user_ref: string;
        q_start: string;
        first_call: string;
      }>(buildTimeToValueSQL(opts.ctx.tenantId!, opts.input));
      const samplesMs = rows
        .map((r) => Date.parse(r.first_call) - Date.parse(r.q_start))
        .filter((ms) => Number.isFinite(ms) && ms >= 0);
      return buildTimeToValueResponse(opts.ctx.tenantId!, samplesMs, bucketEdgesMin, {
        source: "clickhouse",
        sampleData: false,
        ledgerFreshnessMs: 0,
      });
    }
    const users = filterUsers(opts.input);
    const samplesMs = users.map((u) => u.timeToValueMs).filter((v): v is number => v != null);
    return buildTimeToValueResponse(opts.ctx.tenantId!, samplesMs, bucketEdgesMin, meta());
  }),

  /** Job-function coverage matrix — headcount-weighted, sorted by uncovered
   *  weight (guide 02 §2). */
  coverage: tenantProcedure.input(adoptionFilterInput).query(async (opts) => {
    const jfs = jobFunctionsInScope(opts.input.scope).filter(
      (jf) => !opts.input.jobFunctionKey || jf.key === opts.input.jobFunctionKey,
    );
    const activeIdx = ACTIVATION_STEPS.indexOf("weekly_active");

    let activatedSeatsByJobFunction: Map<string, number>;
    if (!isFixtureMode()) {
      const rows = await queryClickHouseJSON<{ job_function_key: string; c: string }>(
        buildCoverageSQL(opts.ctx.tenantId!, opts.input),
      );
      activatedSeatsByJobFunction = new Map(rows.map((r) => [r.job_function_key, Number(r.c)]));
    } else {
      activatedSeatsByJobFunction = new Map(
        jfs.map((jf) => [
          jf.key,
          FIXTURE_POPULATION.filter(
            (u) => u.jobFunctionKey === jf.key && u.reachedStepIndex >= activeIdx,
          ).length,
        ]),
      );
    }

    const rows = jfs
      .map((jf) => {
        const activatedSeats = activatedSeatsByJobFunction.get(jf.key) ?? 0;
        return {
          jobFunctionKey: jf.key,
          name: jf.name,
          departmentName: jf.departmentName,
          headcountWeight: jf.headcount,
          packages: jf.packageRoleKey ? [jf.packageName!] : [],
          activatedSeats,
          eligibleSeats: jf.headcount,
          uncoveredWeight: jf.headcount - activatedSeats,
        };
      })
      .sort((a, b) => b.uncoveredWeight - a.uncoveredWeight);
    return {
      tenantId: opts.ctx.tenantId!,
      rows,
      meta: isFixtureMode()
        ? meta()
        : { source: "clickhouse" as const, sampleData: false, ledgerFreshnessMs: 0 },
    };
  }),

  /** Weekly-active count — A1's primary metric (adoption at scale). */
  activeUsers: tenantProcedure.input(adoptionFilterInput).query(async (opts) => {
    const activeIdx = ACTIVATION_STEPS.indexOf("weekly_active");
    if (!isFixtureMode()) {
      const [weeklyActiveRows, activatedRows, trendRows] = await Promise.all([
        queryClickHouseJSON<{ c: string }>(buildActiveUsersSQL(opts.ctx.tenantId!, opts.input)),
        queryClickHouseJSON<{ c: string }>(buildActivatedSeatsSQL(opts.ctx.tenantId!, opts.input)),
        queryClickHouseJSON<{ week_ending: string; c: string }>(
          buildWeeklyActiveTrendSQL(opts.ctx.tenantId!, opts.input),
        ),
      ]);
      const weeklyActive = Number(weeklyActiveRows[0]?.c ?? 0);
      const activatedSeats = Number(activatedRows[0]?.c ?? 0);
      const eligibleSeats = jobFunctionsInScope(opts.input.scope)
        .filter((jf) => !opts.input.jobFunctionKey || jf.key === opts.input.jobFunctionKey)
        .reduce((sum, jf) => sum + jf.headcount, 0);
      const trend = trendRows.map((r) => ({
        weekEnding: r.week_ending.slice(0, 10),
        weeklyActive: Number(r.c),
      }));
      return {
        tenantId: opts.ctx.tenantId!,
        weeklyActive,
        activatedSeats,
        eligibleSeats,
        trend,
        meta: { source: "clickhouse" as const, sampleData: false, ledgerFreshnessMs: 0 },
      };
    }
    const users = filterUsers(opts.input);
    const weeklyActive = users.filter((u) => u.reachedStepIndex >= activeIdx).length;
    const eligibleSeats = users.filter(
      (u) => u.reachedStepIndex >= 0 || u.errorCode !== "no_package_available",
    ).length;
    const activatedSeats = users.filter(
      (u) => u.reachedStepIndex >= ACTIVATION_STEPS.indexOf("first_metered_call"),
    ).length;
    // 8-week ramp trend ending at the current weeklyActive count — models
    // campaign momentum, not a fabricated metric: it's derived proportionally
    // from the same fixture population, monotonic per guide 02's "adoption at
    // scale" thesis (A1).
    const ramp = [0.2, 0.35, 0.5, 0.64, 0.77, 0.87, 0.94, 1.0];
    const trend = ramp.map((frac, i) => {
      const weeksAgo = ramp.length - 1 - i;
      const d = new Date(NOW_MS - weeksAgo * 7 * 86_400_000);
      return {
        weekEnding: d.toISOString().slice(0, 10),
        weeklyActive: Math.round(weeklyActive * frac),
      };
    });
    return {
      tenantId: opts.ctx.tenantId!,
      weeklyActive,
      activatedSeats,
      eligibleSeats,
      trend,
      meta: meta(),
    };
  }),

  /** Recent activation events for the live activity feed — pseudonymous
   *  `user_ref`, NEVER an email (Invariant 1 / A5 neighbor rule). */
  recentActivations: tenantProcedure
    .input(
      adoptionFilterInput.and(
        z.object({
          limit: z.number().int().min(1).max(200).default(20),
          cursor: z.number().int().min(0).default(0),
        }),
      ),
    )
    .query(async (opts) => {
      const { limit, cursor } = opts.input;
      if (!isFixtureMode()) {
        const rows = await queryClickHouseJSON<{
          ts: string;
          org_node_id: string;
          user_ref: string;
          job_function_key: string;
          step: string;
          outcome: string;
          error_code: string;
        }>(buildRecentActivationsSQL(opts.ctx.tenantId!, opts.input, limit));
        return {
          tenantId: opts.ctx.tenantId!,
          activations: rows.map((r) => ({
            ts: r.ts,
            orgNodeId: r.org_node_id,
            userRef: r.user_ref,
            jobFunctionKey: r.job_function_key,
            step: r.step,
            outcome: r.outcome,
            errorCode: r.error_code,
          })),
          nextCursor: null as number | null,
          meta: { source: "clickhouse" as const, sampleData: false, ledgerFreshnessMs: 0 },
        };
      }
      const users = [...filterUsers(opts.input)].sort((a, b) => b.finalTs - a.finalTs);
      const page = users.slice(cursor, cursor + limit);
      return {
        tenantId: opts.ctx.tenantId!,
        activations: page.map((u) => ({
          ts: new Date(u.finalTs).toISOString(),
          orgNodeId: u.departmentId,
          userRef: u.userRef,
          jobFunctionKey: u.jobFunctionKey,
          step: u.reachedStepIndex >= 0 ? ACTIVATION_STEPS[u.reachedStepIndex]! : "invited",
          outcome: u.outcome,
          errorCode: u.errorCode,
        })),
        nextCursor: cursor + limit < users.length ? cursor + limit : null,
        meta: meta(),
      };
    }),
});

// ── Response-shaping helpers ─────────────────────────────────────────────

function withConversion(
  steps: { step: ActivationStepName; label: string; count: number }[],
): { step: ActivationStepName; label: string; count: number; conversionFromPrev: number | null }[] {
  return steps.map((s, i) => ({
    ...s,
    conversionFromPrev:
      i === 0
        ? null
        : steps[i - 1]!.count > 0
          ? Math.round((s.count / steps[i - 1]!.count) * 1000) / 10
          : 0,
  }));
}

function buildTimeToValueResponse(
  tenantId: string,
  samplesMs: readonly number[],
  bucketEdgesMin: readonly number[],
  meta_: { source: "fixture" | "clickhouse"; sampleData: boolean; ledgerFreshnessMs: number },
) {
  const samplesMin = [...samplesMs].map((ms) => ms / 60_000).sort((a, b) => a - b);
  const buckets = bucketEdgesMin.map((edge, i) => {
    const prevEdge = i === 0 ? 0 : bucketEdgesMin[i - 1]!;
    return { ltMinutes: edge, count: samplesMin.filter((m) => m > prevEdge && m <= edge).length };
  });
  buckets.push({
    ltMinutes: Infinity,
    count: samplesMin.filter((m) => m > bucketEdgesMin[bucketEdgesMin.length - 1]!).length,
  });
  return {
    tenantId,
    buckets,
    p50: Math.round(percentile(samplesMin, 50) * 10) / 10,
    p90: Math.round(percentile(samplesMin, 90) * 10) / 10,
    targetMinutes: 10,
    sampleCount: samplesMin.length,
    meta: meta_,
  };
}

export type AdoptionRouter = typeof adoptionRouter;
