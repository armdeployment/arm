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
 */
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
          sub: "dev-user",
          tenant_id: "tn_demo",
          email: "eng@acme.com",
        },
      });
    },
  });

export { handler as GET, handler as POST };
