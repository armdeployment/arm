/**
 * ARM tRPC package (spec §9 1.0, §6.1 inheritance chain).
 *
 * The dashboard is a HIERARCHICAL DRILL-DOWN explorer, not a flat view.
 * Data is organized by the org tree (§6.1):
 *   Org → Department → Group → Team → (Workstream →) Agent
 *
 * Every query accepts an optional `scope` param ({ type, id }). When omitted,
 * it defaults to the org root (CEO view). When set to a department, it returns
 * that department's rolled-up data (department-head view). And so on down.
 *
 * FIXTURE DATA: routers return inline fixture data for the 1.0 scaffold.
 * TODO(1.1): replace with real Postgres/ClickHouse queries.
 */

import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import type { ARMClaims } from "@arm/auth";
import { initTelemetry, getHealth, type ServiceHealth } from "@arm/config";

// ── Context ────────────────────────────────────────────────────────────────

export interface ARMContext {
  claims: ARMClaims | null;
  tenantId: string | null;
}

export function createContext(opts: { claims?: ARMClaims | null }): ARMContext {
  const claims = opts.claims ?? null;
  return { claims, tenantId: claims?.tenant_id ?? null };
}

// ── tRPC setup ─────────────────────────────────────────────────────────────

const t = initTRPC.context<ARMContext>().create();

const tenantProcedure = t.procedure.use(async (opts) => {
  const { ctx } = opts;
  if (!ctx.claims || !ctx.tenantId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message:
        "No authenticated tenant context. All queries require a tenant_id (Invariant §11.6).",
    });
  }
  return opts.next({ ctx: { ...ctx, tenantId: ctx.tenantId } });
});

const publicProcedure = t.procedure;

// ── Scope input type ───────────────────────────────────────────────────────

const scopeInput = z
  .object({
    type: z.enum(["org", "department", "group", "team"]),
    id: z.string(),
  })
  .nullable()
  .default(null);

type ScopeRef = { type: "org" | "department" | "group" | "team"; id: string } | null;

// ── Fixture: Org Tree (spec §4.1, §6.1) ────────────────────────────────────

interface ScopeNode {
  id: string;
  name: string;
  type: "org" | "department" | "group" | "team";
  parentId: string | null;
  budgetCap: number;
}

interface AgentFixture {
  id: string;
  name: string;
  tier: "critical" | "standard" | "background";
  stakeholder: string;
  scopeType: "team" | "group" | "department" | "org";
  scopeId: string;
  scopeLabel: string;
  monthlySpend: number;
  status: string;
  taskType: string;
}

const SCOPES: ScopeNode[] = [
  { id: "org_acme", name: "Acme Corp", type: "org", parentId: null, budgetCap: 12000 },
  // Engineering
  { id: "dept_eng", name: "Engineering", type: "department", parentId: "org_acme", budgetCap: 5000 },
  { id: "grp_plat", name: "Platform", type: "group", parentId: "dept_eng", budgetCap: 3000 },
  { id: "team_be", name: "Backend", type: "team", parentId: "grp_plat", budgetCap: 2000 },
  { id: "team_fe", name: "Frontend", type: "team", parentId: "grp_plat", budgetCap: 1200 },
  { id: "grp_prod", name: "Product Eng", type: "group", parentId: "dept_eng", budgetCap: 1500 },
  { id: "team_mobile", name: "Mobile", type: "team", parentId: "grp_prod", budgetCap: 700 },
  { id: "team_ds", name: "Design Systems", type: "team", parentId: "grp_prod", budgetCap: 500 },
  // Operations
  { id: "dept_ops", name: "Operations", type: "department", parentId: "org_acme", budgetCap: 5000 },
  { id: "grp_sre", name: "SRE", type: "group", parentId: "dept_ops", budgetCap: 4500 },
  { id: "team_ir", name: "Incident Response", type: "team", parentId: "grp_sre", budgetCap: 3500 },
  { id: "team_mon", name: "Monitoring", type: "team", parentId: "grp_sre", budgetCap: 500 },
  // Data
  { id: "dept_data", name: "Data", type: "department", parentId: "org_acme", budgetCap: 1500 },
  { id: "grp_analytics", name: "Analytics", type: "group", parentId: "dept_data", budgetCap: 1000 },
  { id: "team_pipe", name: "Pipeline", type: "team", parentId: "grp_analytics", budgetCap: 800 },
];

const AGENTS: AgentFixture[] = [
  // Backend team
  { id: "agt_02", name: "code-review-bot", tier: "standard", stakeholder: "j.park", scopeType: "team", scopeId: "team_be", scopeLabel: "Backend", monthlySpend: 890, status: "active", taskType: "Code review & merge checks" },
  { id: "agt_07", name: "test-gen", tier: "standard", stakeholder: "j.park", scopeType: "team", scopeId: "team_be", scopeLabel: "Backend", monthlySpend: 430, status: "active", taskType: "Unit test generation" },
  { id: "agt_09", name: "refactor-bot", tier: "standard", stakeholder: "j.park", scopeType: "team", scopeId: "team_be", scopeLabel: "Backend", monthlySpend: 380, status: "active", taskType: "Automated refactoring" },
  { id: "agt_06", name: "upgrade-bot", tier: "background", stakeholder: "r.gupta", scopeType: "team", scopeId: "team_be", scopeLabel: "Backend", monthlySpend: 95, status: "active", taskType: "Dependency upgrades" },
  // Frontend team
  { id: "agt_03", name: "ux-optimizer", tier: "background", stakeholder: "m.kim", scopeType: "team", scopeId: "team_fe", scopeLabel: "Frontend", monthlySpend: 320, status: "throttled", taskType: "UX optimization experiments" },
  { id: "agt_04", name: "doc-writer", tier: "standard", stakeholder: "a.lee", scopeType: "team", scopeId: "team_fe", scopeLabel: "Frontend", monthlySpend: 210, status: "active", taskType: "Documentation generation" },
  { id: "agt_10", name: "a11y-checker", tier: "background", stakeholder: "m.kim", scopeType: "team", scopeId: "team_fe", scopeLabel: "Frontend", monthlySpend: 140, status: "active", taskType: "Accessibility auditing" },
  // Mobile team
  { id: "agt_11", name: "mobile-test-gen", tier: "standard", stakeholder: "t.wong", scopeType: "team", scopeId: "team_mobile", scopeLabel: "Mobile", monthlySpend: 350, status: "active", taskType: "Mobile test generation" },
  { id: "agt_12", name: "react-native-lint", tier: "background", stakeholder: "t.wong", scopeType: "team", scopeId: "team_mobile", scopeLabel: "Mobile", monthlySpend: 110, status: "active", taskType: "RN lint & type-check" },
  // Design Systems team
  { id: "agt_13", name: "design-token-bot", tier: "background", stakeholder: "m.kim", scopeType: "team", scopeId: "team_ds", scopeLabel: "Design Systems", monthlySpend: 130, status: "active", taskType: "Design token sync" },
  { id: "agt_14", name: "figma-sync", tier: "standard", stakeholder: "a.lee", scopeType: "team", scopeId: "team_ds", scopeLabel: "Design Systems", monthlySpend: 280, status: "active", taskType: "Figma ↔ code component sync" },
  // Incident Response team
  { id: "agt_05", name: "incident-triage", tier: "critical", stakeholder: "s.chen", scopeType: "team", scopeId: "team_ir", scopeLabel: "Incident Response", monthlySpend: 1580, status: "active", taskType: "SEV-1 incident triage & diagnosis" },
  { id: "agt_01", name: "hot-issue-resolver", tier: "critical", stakeholder: "s.chen", scopeType: "team", scopeId: "team_ir", scopeLabel: "Incident Response", monthlySpend: 1240, status: "active", taskType: "Hot-fix generation for prod incidents" },
  { id: "agt_15", name: "alert-triage", tier: "standard", stakeholder: "d.miller", scopeType: "team", scopeId: "team_ir", scopeLabel: "Incident Response", monthlySpend: 340, status: "active", taskType: "Alert correlation & routing" },
  // Monitoring team
  { id: "agt_16", name: "uptime-checker", tier: "background", stakeholder: "d.miller", scopeType: "team", scopeId: "team_mon", scopeLabel: "Monitoring", monthlySpend: 120, status: "active", taskType: "Uptime monitoring & alerting" },
  { id: "agt_17", name: "log-scanner", tier: "background", stakeholder: "d.miller", scopeType: "team", scopeId: "team_mon", scopeLabel: "Monitoring", monthlySpend: 85, status: "active", taskType: "Log anomaly detection" },
  // Pipeline team
  { id: "agt_08", name: "data-pipeline-monitor", tier: "background", stakeholder: "k.tan", scopeType: "team", scopeId: "team_pipe", scopeLabel: "Pipeline", monthlySpend: 180, status: "disabled", taskType: "Pipeline health monitoring" },
  { id: "agt_18", name: "etl-watcher", tier: "standard", stakeholder: "k.tan", scopeType: "team", scopeId: "team_pipe", scopeLabel: "Pipeline", monthlySpend: 270, status: "active", taskType: "ETL job validation" },
];

// ── Tree helpers ───────────────────────────────────────────────────────────

/** Returns the scope node for a ref, or the org root if null. */
function resolveScope(ref: ScopeRef): ScopeNode {
  if (!ref) return SCOPES.find((s) => s.type === "org")!;
  return SCOPES.find((s) => s.id === ref.id && s.type === ref.type) ??
    (() => { throw new TRPCError({ code: "NOT_FOUND", message: `Scope ${ref.type}:${ref.id} not found` }); })();
}

/** Returns all descendant scope IDs (inclusive of the given scope). */
function descendantScopeIds(scope: ScopeNode): Set<string> {
  const ids = new Set<string>([scope.id]);
  let added = true;
  while (added) {
    added = false;
    for (const s of SCOPES) {
      if (s.parentId && ids.has(s.parentId) && !ids.has(s.id)) {
        ids.add(s.id);
        added = true;
      }
    }
  }
  return ids;
}

/** Returns the breadcrumb path from org root to this scope (inclusive). */
function scopePath(scope: ScopeNode): ScopeNode[] {
  const path: ScopeNode[] = [scope];
  let current = scope;
  while (current.parentId) {
    const parent = SCOPES.find((s) => s.id === current.parentId);
    if (!parent) break;
    path.unshift(parent);
    current = parent;
  }
  return path;
}

/** Returns immediate child scopes of a node. */
function childScopes(scope: ScopeNode): ScopeNode[] {
  return SCOPES.filter((s) => s.parentId === scope.id);
}

/** Returns agents within a scope (including all descendants). */
function agentsInScope(scope: ScopeNode): AgentFixture[] {
  const ids = descendantScopeIds(scope);
  return AGENTS.filter((a) => ids.has(a.scopeId));
}

/** Rolled-up spend for a scope. */
function spendInScope(scope: ScopeNode): number {
  return agentsInScope(scope).reduce((sum, a) => sum + a.monthlySpend, 0);
}

// ── Fixture: charts + access (scope-independent for now) ───────────────────

const FIXTURE_SPEND_TREND = [
  { date: "Jul 01", claude: 420, gpt: 310, glm: 80 },
  { date: "Jul 05", claude: 460, gpt: 340, glm: 95 },
  { date: "Jul 10", claude: 510, gpt: 380, glm: 120 },
  { date: "Jul 15", claude: 480, gpt: 350, glm: 160 },
  { date: "Jul 20", claude: 440, gpt: 320, glm: 210 },
  { date: "Jul 25", claude: 410, gpt: 290, glm: 260 },
];

const FIXTURE_MODEL_SPEND = [
  { model: "Claude Sonnet 4.5", provider: "Anthropic", spend: 2720, kind: "closed" as const },
  { model: "GPT-4o", provider: "OpenAI", spend: 1990, kind: "closed" as const },
  { model: "GLM-5.2", provider: "Self-hosted", spend: 925, kind: "self_hosted" as const },
  { model: "DeepSeek V3", provider: "Self-hosted", spend: 340, kind: "self_hosted" as const },
];

const FIXTURE_ACCESS_REQUESTS = [
  { id: "req_01", agentId: "incident-triage", resourceId: "s3://prod-logs/", status: "pending", action: "read", reason: "Debug SEV-1 incident #2847" },
  { id: "req_02", agentId: "data-pipeline-monitor", resourceId: "db://analytics/transactions", status: "pending", action: "query", reason: "Weekly health check" },
];

const telemetryState = initTelemetry("control-plane");

// ── Routers ────────────────────────────────────────────────────────────────

interface TreeNode {
  id: string;
  name: string;
  type: string;
  monthlySpend: number;
  agentCount: number;
  budgetCap: number;
  budgetUtilPct: number;
  criticalCount: number;
  children: TreeNode[];
}

const orgTreeRouter = t.router({
  /** Returns breadcrumb path from org root to the given scope. */
  path: tenantProcedure
    .input(z.object({ scope: scopeInput }))
    .query(async (opts) => {
      const scope = resolveScope(opts.input.scope);
      return {
        tenantId: opts.ctx.tenantId!,
        path: scopePath(scope).map((s) => ({ id: s.id, name: s.name, type: s.type })),
      };
    }),

  /** Returns immediate child scopes of the given scope (or org root). */
  children: tenantProcedure
    .input(z.object({ scope: scopeInput }))
    .query(async (opts) => {
      const scope = resolveScope(opts.input.scope);
      const children = childScopes(scope).map((child) => {
        const agents = agentsInScope(child);
        const spend = agents.reduce((s, a) => s + a.monthlySpend, 0);
        return {
          id: child.id,
          name: child.name,
          type: child.type,
          monthlySpend: spend,
          agentCount: agents.length,
          budgetCap: child.budgetCap,
          budgetUtilPct: Math.round((spend / child.budgetCap) * 100),
          criticalCount: agents.filter((a) => a.tier === "critical").length,
        };
      });
      return { tenantId: opts.ctx.tenantId!, scope: { id: scope.id, name: scope.name, type: scope.type }, children };
    }),

  /** Returns the FULL org tree with spend/agent rollups at every level.
   *  Used for treemap and tree-view visualizations — no drill-down needed. */
  fullTree: tenantProcedure.query(async (opts) => {
    function buildNode(scope: ScopeNode): TreeNode {
      const kids = childScopes(scope);
      const agents = agentsInScope(scope);
      const spend = agents.reduce((s, a) => s + a.monthlySpend, 0);
      const node: TreeNode = {
        id: scope.id,
        name: scope.name,
        type: scope.type,
        monthlySpend: spend,
        agentCount: agents.length,
        budgetCap: scope.budgetCap,
        budgetUtilPct: Math.round((spend / scope.budgetCap) * 100),
        criticalCount: agents.filter((a) => a.tier === "critical").length,
        children: kids.map(buildNode),
      };
      return node;
    }

    const root = SCOPES.find((s) => s.type === "org")!;
    return { tenantId: opts.ctx.tenantId!, tree: buildNode(root) };
  }),
});

const spendRouter = t.router({
  summary: tenantProcedure
    .input(z.object({ scope: scopeInput }))
    .query(async (opts) => {
      const scope = resolveScope(opts.input.scope);
      const agents = agentsInScope(scope);
      const spend = agents.reduce((s, a) => s + a.monthlySpend, 0);
      const tiers = { critical: 0, standard: 0, background: 0 };
      for (const a of agents) tiers[a.tier]++;

      return {
        tenantId: opts.ctx.tenantId!,
        scope: { id: scope.id, name: scope.name, type: scope.type },
        totalMonthlySpend: spend,
        agentCount: agents.length,
        budgetCap: scope.budgetCap,
        budgetUtilPct: Math.round((spend / scope.budgetCap) * 100),
        proxiedTrafficPct: 84,
        pendingApprovals: FIXTURE_ACCESS_REQUESTS.length,
        tierBreakdown: [
          { tier: "critical", count: tiers.critical, color: "#e11d48" },
          { tier: "standard", count: tiers.standard, color: "#2563eb" },
          { tier: "background", count: tiers.background, color: "#64748b" },
        ],
      };
    }),

  byModel: tenantProcedure
    .input(z.object({ scope: scopeInput }))
    .query(async (opts) => {
      // TODO(1.1): scope-filter from ClickHouse
      return { tenantId: opts.ctx.tenantId!, models: FIXTURE_MODEL_SPEND };
    }),

  trend: tenantProcedure
    .input(z.object({ scope: scopeInput }))
    .query(async (opts) => {
      // TODO(1.1): scope-filter from ClickHouse
      return { tenantId: opts.ctx.tenantId!, points: FIXTURE_SPEND_TREND };
    }),
});

const agentsRouter = t.router({
  list: tenantProcedure
    .input(z.object({ scope: scopeInput, status: z.enum(["active", "disabled", "all"]).default("all") }))
    .query(async (opts) => {
      const scope = resolveScope(opts.input.scope);
      let agents = agentsInScope(scope);
      if (opts.input.status !== "all") {
        agents = agents.filter((a) => a.status === opts.input.status);
      }
      agents = [...agents].sort((a, b) => b.monthlySpend - a.monthlySpend);
      return {
        tenantId: opts.ctx.tenantId!,
        scope: { id: scope.id, name: scope.name, type: scope.type },
        agents: agents.map((a) => ({
          id: a.id,
          name: a.name,
          tier: a.tier,
          stakeholder: a.stakeholder,
          scope: a.scopeLabel,
          monthlySpend: a.monthlySpend,
          status: a.status,
          taskType: a.taskType,
        })),
      };
    }),

  create: tenantProcedure
    .input(
      z.object({
        name: z.string().min(1),
        scopeType: z.enum(["org", "department", "group", "team", "workstream"]),
        scopeId: z.string().uuid(),
        stakeholderUserId: z.string().uuid(),
        type: z.string(),
        priorityTier: z.enum(["critical", "standard", "background"]).default("standard"),
      }),
    )
    .mutation(async (opts) => {
      return { id: "agt_new", tenantId: opts.ctx.tenantId!, ...opts.input };
    }),
});

const accessRouter = t.router({
  pendingApprovals: tenantProcedure
    .input(z.object({ scope: scopeInput }))
    .query(async (opts) => {
      return { tenantId: opts.ctx.tenantId!, requests: FIXTURE_ACCESS_REQUESTS };
    }),

  requestAccess: tenantProcedure
    .input(z.object({ resourceId: z.string(), actions: z.array(z.string()), reason: z.string().optional() }))
    .mutation(async (opts) => {
      return { id: "req_new", tenantId: opts.ctx.tenantId!, status: "pending" };
    }),
});

const healthRouter = t.router({
  check: publicProcedure.query((): ServiceHealth => getHealth("control-plane", telemetryState.active)),
});

// ── Root router ────────────────────────────────────────────────────────────

export const appRouter = t.router({
  health: healthRouter,
  orgTree: orgTreeRouter,
  agents: agentsRouter,
  spend: spendRouter,
  access: accessRouter,
});

export type AppRouter = typeof appRouter;
