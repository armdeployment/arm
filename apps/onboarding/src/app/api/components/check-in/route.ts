import { appRouter, createContext } from "@arm/trpc";
import { authenticateRequest, resolveAuthMode } from "@arm/auth";
import { config } from "@arm/config";
import { checkInRequestSchema } from "@arm/proto";

export const dynamic = "force-dynamic";

/**
 * REST facade over `library.checkIn` — the client reports which component
 * versions it has installed and gets back what is stale.
 *
 * A facade rather than a tRPC call for the same reason as
 * `/api/setup/redeem`: `@arm/client-core` must not depend on `@arm/trpc`
 * (boundaries guardrail), so the wire contract is plain JSON. The response
 * shape is `checkInResponseSchema` (@arm/proto), which
 * `client-core/src/update.ts` parses — change one and the other stops
 * working, which is why both sides read the same schema.
 *
 * Authentication reuses `resolveAuthMode`, so this endpoint inherits the same
 * fail-closed behaviour as every other authenticated surface: under
 * NODE_ENV=production with no OIDC configured it refuses rather than
 * accepting every caller as the development identity. The tenant is taken
 * from the verified claims and never from the body — a client that could name
 * its own tenant could write inventory into, and read update plans out of,
 * someone else's.
 */
const DEV_TENANT_ID = "d9d9d9d9-0000-4000-8000-000000000001";
// Matches this app's own tRPC route identity, so both surfaces agree.
const DEVELOPMENT_IDENTITY = {
  sub: "onboarding-dev-user",
  tenant_id: DEV_TENANT_ID,
  email: "employee@acme.com",
};

const authMode = resolveAuthMode(config);

export async function POST(req: Request): Promise<Response> {
  const claims = await authenticateRequest(req.headers, authMode, {
    developmentIdentity: DEVELOPMENT_IDENTITY,
  });
  if (claims === null) {
    return Response.json(
      { error: "unauthorized: a valid agent token is required to check in" },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "malformed request body" }, { status: 400 });
  }

  // `tenant_id` is required by the schema but deliberately ignored below —
  // the authenticated tenant wins. Defaulted here so a client need not send a
  // value that would be discarded anyway.
  const parsed = checkInRequestSchema.safeParse({
    ...(typeof body === "object" && body !== null ? body : {}),
    // Last, so it wins: a `tenant_id` in the body is overwritten by the
    // authenticated one rather than merely being ignored downstream.
    tenant_id: claims.tenant_id,
  });
  if (!parsed.success) {
    return Response.json(
      {
        error: `invalid check-in payload: ${parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ")}`,
      },
      { status: 400 },
    );
  }

  const caller = appRouter.createCaller(createContext({ claims }));
  const result = await caller.library.checkIn({
    subAccountId: parsed.data.sub_account_id,
    clientVersion: parsed.data.client_version,
    components: parsed.data.components,
  });
  return Response.json(result);
}
