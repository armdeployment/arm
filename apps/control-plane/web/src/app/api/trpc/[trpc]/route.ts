import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter, createContext } from "@arm/trpc";
import { authenticateRequest, resolveAuthMode } from "@arm/auth";
import { config } from "@arm/config";

/** Force dynamic — tRPC routes must never be statically prerendered. */
export const dynamic = "force-dynamic";

/**
 * tRPC API route handler (spec §9 1.0).
 *
 * Authentication is decided once, at module load, from env — see
 * `resolveAuthMode` in @arm/auth and docs/sso-setup.md:
 *
 *   - OIDC configured  → the Authorization bearer token is verified against
 *                        the IdP's JWKS and mapped to ARM claims.
 *   - nothing set, dev → the development identity below, so a fresh clone
 *                        runs with no configuration at all.
 *   - nothing set, prod → refuse. Every protected procedure returns
 *                        UNAUTHORIZED rather than silently treating every
 *                        caller as this one fixed user.
 *
 * Unauthenticated resolves to `claims: null`, which `createContext` accepts
 * and `protectedProcedure` rejects — so the failure happens at the router,
 * uniformly, instead of throwing out of this handler.
 *
 * DEV_TENANT_ID/DEV_USER_ID must be real UUIDs, not human-readable
 * placeholders like the "tn_demo"/"dev-user" these used to be (Wave 3 DB
 * wiring found this the hard way, twice: apps/onboarding's Postgres-backed
 * routers already used d9d9d9d9-0000-4000-8000-000000000001 for the
 * tenant, and library-router.ts's publishVersion/promoteCandidate write
 * claims.sub straight into owner_user_id/reviewed_by — real `uuid` columns
 * with FK constraints in both cases. Matching apps/onboarding's own
 * DEV_TENANT_ID so both apps' real-mode data agree; DEV_USER_ID matches
 * the OWNER_ID/FIXTURE_OWNER_ID convention @arm/artifactory's fixtures and
 * catalog-router.ts already use.
 */
const DEV_TENANT_ID = "d9d9d9d9-0000-4000-8000-000000000001";
const DEV_USER_ID = "60000000-0000-4000-8000-000000000001";

const DEVELOPMENT_IDENTITY = {
  sub: DEV_USER_ID,
  tenant_id: DEV_TENANT_ID,
  email: "eng@acme.com",
};

const authMode = resolveAuthMode(config);

if (authMode.kind !== "oidc") {
  // One line at startup, not one per request. Says which mode is live so
  // "why is everything 401" and "why am I logged in as eng@acme.com" are
  // both answerable from the log.
  console.warn(`[auth] control-plane: ${authMode.kind} — ${authMode.reason}`);
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
