/**
 * Library router — PLACEHOLDER (docs/guides/00-shared-contracts.md §8).
 *
 * Procedure names are frozen by guide 00; every procedure here returns a
 * typed empty fixture. Filled in by the `library` Wave-1 agent
 * (docs/guides/01-library-artifactory.md) against `packages/artifactory`,
 * `packages/discovery`, `packages/catalog`, and `packages/profiles`. This
 * file is registered in the router-registration block of
 * packages/trpc/src/index.ts; `library` owns THIS file's contents but not
 * the registration block.
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

export const libraryRouter = t.router({
  // ── Component Registry ────────────────────────────────────────────────
  /** TODO(library): full-text/faceted component search. */
  search: tenantProcedure.query(async (opts) => ({
    tenantId: opts.ctx.tenantId!,
    results: [] as unknown[],
  })),

  /** TODO(library): facet counts (kind, review_status, source_kind, …) for the search UI. */
  facets: tenantProcedure.query(async (opts) => ({
    tenantId: opts.ctx.tenantId!,
    facets: {} as Record<string, Record<string, number>>,
  })),

  /** TODO(library): fetch one component by id/slug with its versions. */
  getComponent: tenantProcedure.query(async (opts) => ({
    tenantId: opts.ctx.tenantId!,
    component: null as unknown,
  })),

  /** TODO(library): list published versions of a component. */
  listVersions: tenantProcedure.query(async (opts) => ({
    tenantId: opts.ctx.tenantId!,
    versions: [] as unknown[],
  })),

  /** TODO(library): publish a new component version (manifest + blob digest verification). */
  publishVersion: tenantProcedure.mutation(async (opts) => ({
    tenantId: opts.ctx.tenantId!,
    status: "not_implemented" as const,
  })),

  // ── Discovery ────────────────────────────────────────────────────────
  /** TODO(library): list configured discovery sources. */
  listSources: tenantProcedure.query(async (opts) => ({
    tenantId: opts.ctx.tenantId!,
    sources: [] as unknown[],
  })),

  /** TODO(library): list discovery candidates pending triage. */
  listCandidates: tenantProcedure.query(async (opts) => ({
    tenantId: opts.ctx.tenantId!,
    candidates: [] as unknown[],
  })),

  /** TODO(library): promote a discovery candidate into the Component Registry. */
  promoteCandidate: tenantProcedure.mutation(async (opts) => ({
    tenantId: opts.ctx.tenantId!,
    status: "not_implemented" as const,
  })),

  /** TODO(library): reject a discovery candidate. */
  rejectCandidate: tenantProcedure.mutation(async (opts) => ({
    tenantId: opts.ctx.tenantId!,
    status: "not_implemented" as const,
  })),

  // ── Job functions ────────────────────────────────────────────────────
  /** TODO(library): list the job-function taxonomy for this tenant/industry profile. */
  listJobFunctions: tenantProcedure.query(async (opts) => ({
    tenantId: opts.ctx.tenantId!,
    jobFunctions: [] as unknown[],
  })),

  /** TODO(library): recommend components/packages for a job function key. */
  recommendForJobFunction: tenantProcedure.query(async (opts) => ({
    tenantId: opts.ctx.tenantId!,
    recommendations: [] as unknown[],
  })),

  /** TODO(library): coverage-gap analysis — job functions with no assigned package. */
  gaps: tenantProcedure.query(async (opts) => ({
    tenantId: opts.ctx.tenantId!,
    gaps: [] as unknown[],
  })),
});

export type LibraryRouter = typeof libraryRouter;
