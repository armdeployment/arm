import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter, createContext } from "@arm/trpc";
import { authenticateRequest, resolveAuthMode } from "@arm/auth";
import { config } from "@arm/config";

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
 * Authentication follows the same three-way `resolveAuthMode` decision as
 * apps/control-plane/web — verify when an IdP is configured, fall back to the
 * development identity below when nothing is, refuse under NODE_ENV=production
 * with neither. See docs/sso-setup.md.
 *
 * Note the trust asymmetry with the dashboard: this app also serves PUBLIC
 * setup-token redemption, which is authenticated by the signed token itself
 * (`ARM_SETUP_TOKEN_SECRET`) rather than by a session, and so is deliberately
 * reachable without OIDC. Guide 03 §3's invite-code path is the other half of
 * that and is still unbuilt.
 */
const DEV_TENANT_ID = "d9d9d9d9-0000-4000-8000-000000000001";

const DEVELOPMENT_IDENTITY = {
  sub: "onboarding-dev-user",
  tenant_id: DEV_TENANT_ID,
  email: "employee@acme.com",
};

const authMode = resolveAuthMode(config);

if (authMode.kind !== "oidc") {
  console.warn(`[auth] onboarding: ${authMode.kind} — ${authMode.reason}`);
}

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: async () =>
      createContext({
        claims: await authenticateRequest(req.headers, authMode, {
          developmentIdentity: DEVELOPMENT_IDENTITY,
        }),
      }),
  });

export { handler as GET, handler as POST };
