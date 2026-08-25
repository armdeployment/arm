import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter, createContext } from "@arm/trpc";

/** Force dynamic — tRPC routes must never be statically prerendered. */
export const dynamic = "force-dynamic";

/**
 * tRPC API route handler (spec §9 1.0).
 *
 * In production, this extracts OIDC claims from the Authorization header and
 * passes them to createContext. For the 1.0 scaffold with no live IdP, a dev
 * tenant context is injected so the UI pipeline works end-to-end.
 *
 * TODO(1.1): wire real OIDC token verification from Authorization header.
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

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => {
      // Dev mode: inject a demo tenant so the full pipeline works.
      // Production: parse Authorization: Bearer <token> → verifyOIDCToken.
      return createContext({
        claims: {
          sub: DEV_USER_ID,
          tenant_id: DEV_TENANT_ID,
          email: "eng@acme.com",
        },
      });
    },
  });

export { handler as GET, handler as POST };
