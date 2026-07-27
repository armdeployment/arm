/**
 * ARM tRPC package (spec §9 1.0, §14.3 dependency-direction layer 3).
 *
 * Layer 3: may import all layer-2 packages (proto, config, db, policy, auth).
 * Defines the API surface consumed by the Next.js app.
 *
 * Critical: the tenant middleware enforces Invariant §11.6 — every query
 * carries a mandatory tenant_id. No procedure can execute without a resolved
 * tenant context. This is the guardrail mandated by §14.1.
 *
 * FIXTURE DATA: routers return inline fixture data for the 1.0 scaffold.
 * TODO(1.1): replace with real Postgres/ClickHouse queries.
 */

import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import type { ARMClaims } from "@arm/auth";

// ── Context ────────────────────────────────────────────────────────────────

export interface ARMContext {
  claims: ARMClaims | null;
  tenantId: string | null;
}

export function createContext(opts: { claims?: ARMClaims | null }): ARMContext {
  const claims = opts.claims ?? null;
  return {
    claims,
    tenantId: claims?.tenant_id ?? null,
  };
}

// ── tRPC setup ─────────────────────────────────────────────────────────────

const t = initTRPC.context<ARMContext>().create();

// ── Middleware: tenant isolation (Invariant §11.6) ─────────────────────────

const tenantProcedure = t.procedure.use(async (opts) => {
  const { ctx } = opts;
  if (!ctx.claims || !ctx.tenantId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message:
        "No authenticated tenant context. All queries require a tenant_id (Invariant §11.6).",
    });
  }
  return opts.next({
    ctx: { ...ctx, tenantId: ctx.tenantId },
  });
});

const publicProcedure = t.procedure;

// ── Fixture data (TODO: replace with real queries in 1.1) ──────────────────

const FIXTURE_AGENTS = [
  { id: "agt_05", name: "incident-triage", tier: "critical" as const, stakeholder: "s.chen", scope: "Team: SRE", monthlySpend: 1580, status: "active" },
  { id: "agt_01", name: "hot-issue-resolver", tier: "critical" as const, stakeholder: "s.chen", scope: "Team: Payments", monthlySpend: 1240, status: "active" },
  { id: "agt_02", name: "code-review-bot", tier: "standard" as const, stakeholder: "j.park", scope: "Team: Platform", monthlySpend: 890, status: "active" },
  { id: "agt_07", name: "test-gen", tier: "standard" as const, stakeholder: "j.park", scope: "Team: Platform", monthlySpend: 430, status: "active" },
  { id: "agt_03", name: "ux-optimizer", tier: "background" as const, stakeholder: "m.kim", scope: "Dept: Product", monthlySpend: 320, status: "throttled" },
  { id: "agt_04", name: "doc-writer", tier: "standard" as const, stakeholder: "a.lee", scope: "Team: Docs", monthlySpend: 210, status: "active" },
  { id: "agt_08", name: "data-pipeline-monitor", tier: "background" as const, stakeholder: "k.tan", scope: "Team: Data", monthlySpend: 180, status: "disabled" },
  { id: "agt_06", name: "upgrade-bot", tier: "background" as const, stakeholder: "r.gupta", scope: "Group: Eng", monthlySpend: 95, status: "active" },
];

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

const FIXTURE_SUMMARY = {
  totalMonthlySpend: 5975,
  agentCount: 47,
  proxiedTrafficPct: 84,
  budgetUtilizationPct: 73,
  criticalReservePct: 20,
  backgroundFloorPct: 5,
  pendingApprovals: 2,
  tierBreakdown: [
    { tier: "critical", count: 4, color: "#f43f5e" },
    { tier: "standard", count: 31, color: "#3b82f6" },
    { tier: "background", count: 12, color: "#22c55e" },
  ],
};

const FIXTURE_ACCESS_REQUESTS = [
  { id: "req_01", agentId: "incident-triage", resourceId: "s3://prod-logs/", status: "pending", action: "read", reason: "Debug SEV-1 incident #2847" },
  { id: "req_02", agentId: "data-pipeline-monitor", resourceId: "db://analytics/transactions", status: "pending", action: "query", reason: "Weekly health check" },
];

// ── Routers ────────────────────────────────────────────────────────────────

const agentsRouter = t.router({
  list: tenantProcedure
    .input(z.object({ status: z.enum(["active", "disabled", "all"]).default("active") }))
    .query(async (opts) => {
      // TODO(1.1): SELECT * FROM agent WHERE tenant_id = $1
      const agents =
        opts.input.status === "all"
          ? FIXTURE_AGENTS
          : FIXTURE_AGENTS.filter((a) => a.status === opts.input.status);
      return { tenantId: opts.ctx.tenantId!, agents };
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
      // TODO: insert into agents table with tenantId from context.
      return { id: "agt_new", tenantId: opts.ctx.tenantId!, ...opts.input };
    }),
});

const spendRouter = t.router({
  summary: tenantProcedure.query(async (opts) => {
    // TODO(1.1): ClickHouse aggregate with tenant_id filter
    return { tenantId: opts.ctx.tenantId!, ...FIXTURE_SUMMARY };
  }),

  byModel: tenantProcedure.query(async (opts) => {
    return { tenantId: opts.ctx.tenantId!, models: FIXTURE_MODEL_SPEND };
  }),

  trend: tenantProcedure.query(async (opts) => {
    return { tenantId: opts.ctx.tenantId!, points: FIXTURE_SPEND_TREND };
  }),
});

const accessRouter = t.router({
  pendingApprovals: tenantProcedure.query(async (opts) => {
    return { tenantId: opts.ctx.tenantId!, requests: FIXTURE_ACCESS_REQUESTS };
  }),

  requestAccess: tenantProcedure
    .input(
      z.object({
        resourceId: z.string(),
        actions: z.array(z.string()),
        reason: z.string().optional(),
      }),
    )
    .mutation(async (opts) => {
      // TODO: create access_request row
      return { id: "req_new", tenantId: opts.ctx.tenantId!, status: "pending" };
    }),
});

const healthRouter = t.router({
  check: publicProcedure.query(() => ({
    status: "ok",
    version: "0.0.0",
    timestamp: new Date().toISOString(),
  })),
});

// ── Root router ────────────────────────────────────────────────────────────

export const appRouter = t.router({
  health: healthRouter,
  agents: agentsRouter,
  spend: spendRouter,
  access: accessRouter,
});

export type AppRouter = typeof appRouter;
