/**
 * Onboarding router — PLACEHOLDER (docs/guides/00-shared-contracts.md §8).
 *
 * Procedure names are frozen by guide 00; every procedure here returns a
 * typed empty fixture. Filled in by the `client` Wave-1 agent
 * (docs/guides/03-client-downloader.md) against `packages/questionnaire` and
 * `packages/client-core`. This file is registered in the router-registration
 * block of packages/trpc/src/index.ts; `client` owns THIS file's contents
 * but not the registration block.
 *
 * No module logic lives here — Wave 0 (`contracts`) ships shape only. In
 * particular: no free-text questionnaire field exists anywhere in this file
 * (A5, Invariant 1) — `submitResponse`'s eventual input MUST be shaped by
 * `questionnaireAnswerSchema` (@arm/proto), never a free-text blob.
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

export const onboardingRouter = t.router({
  /** TODO(client): fetch the published questionnaire graph for this tenant/industry profile. */
  getQuestionnaire: tenantProcedure.query(async (opts) => ({
    tenantId: opts.ctx.tenantId!,
    questionnaire: null as unknown,
  })),

  /** TODO(client): store a structured-answers-only response (A5) and resolve a job function. */
  submitResponse: tenantProcedure.mutation(async (opts) => ({
    tenantId: opts.ctx.tenantId!,
    status: "not_implemented" as const,
  })),

  /** TODO(client): recommend package versions for a resolved job function. */
  recommend: tenantProcedure.query(async (opts) => ({
    tenantId: opts.ctx.tenantId!,
    recommendations: [] as unknown[],
  })),

  /** TODO(client): issue a signed setup token (A4) — stores only its sha256, never the token. */
  issueSetupToken: tenantProcedure.mutation(async (opts) => ({
    tenantId: opts.ctx.tenantId!,
    status: "not_implemented" as const,
  })),

  /** TODO(client): redeem a setup token exactly once, returning install/runtime config. */
  redeemSetupToken: tenantProcedure.mutation(async (opts) => ({
    tenantId: opts.ctx.tenantId!,
    status: "not_implemented" as const,
  })),

  /** TODO(client): resolve a 6-char activation code to its setup token (out-of-band redemption). */
  resolveActivationCode: tenantProcedure.query(async (opts) => ({
    tenantId: opts.ctx.tenantId!,
    setupToken: null as unknown,
  })),
});

export type OnboardingRouter = typeof onboardingRouter;
