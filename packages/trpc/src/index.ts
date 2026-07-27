/**
 * ARM tRPC package (spec §9 1.0, §14.3 dependency-direction layer 3).
 *
 * Layer 3: may import all layer-2 packages (proto, config, db, policy, auth).
 * Defines the API surface consumed by the Next.js app.
 *
 * Critical: the tenant middleware enforces Invariant §11.6 — every query
 * carries a mandatory tenant_id. No procedure can execute without a resolved
 * tenant context. This is the guardrail mandated by §14.1.
 */

import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import type { ARMClaims } from "@arm/auth";

// ── Context ────────────────────────────────────────────────────────────────

export interface ARMContext {
  /** Resolved from the OIDC token at the request boundary. NULL = unauthenticated. */
  claims: ARMClaims | null;
  /** Tenant ID extracted from claims. Procedures use this for mandatory filtering. */
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

/**
 * Every protected procedure passes through this middleware. It:
 *   1. Rejects unauthenticated requests.
 *   2. Stamps tenantId into the context for downstream DB queries.
 *   3. Guarantees no procedure can run without a tenant scope.
 */
const tenantProcedure = t.procedure.use(async (opts) => {
  const { ctx } = opts;
  if (!ctx.claims || !ctx.tenantId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "No authenticated tenant context. All queries require a tenant_id (Invariant §11.6).",
    });
  }
  return opts.next({
    ctx: { ...ctx, tenantId: ctx.tenantId },
  });
});

// ── Public procedure (health check, .well-known) ──────────────────────────

const publicProcedure = t.procedure;

// ── Routers ────────────────────────────────────────────────────────────────

/** Agents router — CRUD for governed agent identities. */
const agentsRouter = t.router({
  list: tenantProcedure
    .input(z.object({ status: z.enum(["active", "disabled", "all"]).default("active") }))
    .query(async (opts) => {
      // TODO: real DB query with `eq(agents.tenantId, opts.ctx.tenantId)`
      // For now returns a typed stub so the UI can wire up.
      return {
        tenantId: opts.ctx.tenantId!,
        agents: [] as Array<{
          id: string;
          name: string;
          tier: "critical" | "standard" | "background";
          status: string;
          stakeholder: string;
          monthlySpend: number;
        }>,
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
      // TODO: insert into agents table with tenantId from context.
      return { id: "agt_new", tenantId: opts.ctx.tenantId!, ...opts.input };
    }),
});

/** Spend router — metering aggregates for dashboards. */
const spendRouter = t.router({
  summary: tenantProcedure.query(async (opts) => {
    // TODO: ClickHouse aggregate with tenant_id filter
    return {
      tenantId: opts.ctx.tenantId!,
      totalMonthlySpend: 0,
      proxiedTrafficPct: 0,
      budgetUtilizationPct: 0,
    };
  }),

  byModel: tenantProcedure.query(async (opts) => {
    return {
      tenantId: opts.ctx.tenantId!,
      models: [] as Array<{ model: string; spend: number; kind: string }>,
    };
  }),
});

/** Access router — JIT requests + audit log queries. */
const accessRouter = t.router({
  pendingApprovals: tenantProcedure.query(async (opts) => {
    return {
      tenantId: opts.ctx.tenantId!,
      requests: [] as Array<{
        id: string;
        agentId: string;
        resourceId: string;
        status: string;
      }>,
    };
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

/** Health router — public (no auth needed). */
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
