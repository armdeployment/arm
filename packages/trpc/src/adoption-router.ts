/**
 * Adoption router — PLACEHOLDER (docs/guides/00-shared-contracts.md §8).
 *
 * Procedure names are frozen by guide 00; every procedure here returns a
 * typed empty fixture. Filled in by the `server` Wave-1 agent
 * (docs/guides/02-server-panels.md) against the ClickHouse
 * `activation_event`/`component_pull_event` tables
 * (packages/clickhouse/migrations/0003_adoption.sql). This is the ONE file
 * `server` owns outright in packages/trpc/src (plus the registration block
 * in index.ts) — reflects A1: agent adoption at scale is the primary value
 * prop, so this router (funnel, time-to-value, coverage) is first-class, not
 * an afterthought bolted onto spend/cost panels.
 *
 * No module logic lives here — Wave 0 (`contracts`) ships shape only.
 */

import { initTRPC, TRPCError } from "@trpc/server";
import type { ARMContext } from "./index.js";

// ── tRPC setup (mirrors src/index.ts; routers must not import runtime values back) ──

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

export const adoptionRouter = t.router({
  /** TODO(server): activation funnel — counts per `activation_event.step` (invited → weekly_active). */
  funnel: tenantProcedure.query(async (opts) => ({
    tenantId: opts.ctx.tenantId!,
    steps: [] as unknown[],
  })),

  /** TODO(server): where users stall in the funnel (step with the largest drop-off / abandon rate). */
  stalls: tenantProcedure.query(async (opts) => ({
    tenantId: opts.ctx.tenantId!,
    stalls: [] as unknown[],
  })),

  /** TODO(server): median/percentile time from `invited` to `first_metered_call`. */
  timeToValue: tenantProcedure.query(async (opts) => ({
    tenantId: opts.ctx.tenantId!,
    medianMs: null as number | null,
  })),

  /** TODO(server): job-function coverage — which job functions have active adopters. */
  coverage: tenantProcedure.query(async (opts) => ({
    tenantId: opts.ctx.tenantId!,
    coverage: [] as unknown[],
  })),

  /** TODO(server): weekly-active user count (A1 primary metric — adoption at scale). */
  activeUsers: tenantProcedure.query(async (opts) => ({
    tenantId: opts.ctx.tenantId!,
    count: 0,
  })),

  /** TODO(server): recent activation events for the live activity feed. */
  recentActivations: tenantProcedure.query(async (opts) => ({
    tenantId: opts.ctx.tenantId!,
    activations: [] as unknown[],
  })),
});

export type AdoptionRouter = typeof adoptionRouter;
