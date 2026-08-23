import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter, createContext } from "@arm/trpc";

/** Force dynamic — tRPC routes must never be statically prerendered. */
export const dynamic = "force-dynamic";

/**
 * tRPC API route handler (guide 03 §3), mirroring
 * apps/control-plane/web's route — same pattern, separate app (different
 * trust level: this one also serves PUBLIC setup-token redemption).
 *
 * Dev-mode tenant: "d9d9d9d9-0000-4000-8000-000000000001" — the SAME fixture
 * tenant `packages/trpc/src/onboarding-router.ts` (`FIXTURE_TENANT_ID`) and
 * `packages/trpc/src/catalog-router.ts` (`TENANT_ID`) use, so the
 * questionnaire → recommendation → redemption flow resolves against
 * consistent fixture data end to end.
 *
 * TODO(1.1): wire real OIDC/invite-code tenant resolution (guide 03 §3:
 * "/start" is SSO-gated when the tenant requires it, else an invite code).
 */
const DEV_TENANT_ID = "d9d9d9d9-0000-4000-8000-000000000001";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () =>
      createContext({
        claims: { sub: "onboarding-dev-user", tenant_id: DEV_TENANT_ID, email: "employee@acme.com" },
      }),
  });

export { handler as GET, handler as POST };
