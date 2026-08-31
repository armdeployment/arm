#!/usr/bin/env node
/**
 * A local OIDC issuer, for testing ARM's SSO wiring without an IdP tenant.
 *
 * Setting up SSO is the step where a deployment stops being a demo, and until
 * now there was no way to exercise it: you either had an Okta/Entra tenant or
 * you ran ARM with its built-in development identity. This serves the two
 * endpoints ARM actually consumes — a discovery document and a JWKS — and
 * mints signed tokens on demand, so the whole path (bearer token → signature
 * verification → claim mapping → tenant scoping) can be run end to end on a
 * laptop.
 *
 *   pnpm --filter @arm/auth mock-idp        # or: make mock-idp
 *
 * The keypair is generated fresh on every start and never written to disk.
 * That is deliberate — nothing here should ever be mistaken for a credential,
 * and a restarted issuer invalidating every previously minted token is the
 * correct behaviour for a dev tool.
 *
 * This is a test double, not an IdP: no login UI, no authorization code flow,
 * no refresh tokens, no client authentication. It signs whatever you ask it
 * to. Never run it anywhere that matters.
 */

import { createServer } from "node:http";
import { generateKeyPair, exportJWK, SignJWT } from "jose";

const PORT = Number.parseInt(process.env.MOCK_IDP_PORT ?? "9999", 10);
const ISSUER = process.env.MOCK_IDP_ISSUER ?? `http://localhost:${PORT}`;
const AUDIENCE = process.env.MOCK_IDP_AUDIENCE ?? "arm-control-plane";
const KID = "mock-idp-key-1";

const { publicKey, privateKey } = await generateKeyPair("RS256", { extractable: true });
const publicJwk = { ...(await exportJWK(publicKey)), kid: KID, alg: "RS256", use: "sig" };

/** Mints a token shaped like the ones a real IdP issues for a workforce user. */
async function mintToken({ sub, email, tenant, groups, ttlSeconds }) {
  const payload = { email };
  // A real Okta/Entra token carries no tenant_id claim — that is exactly why
  // ARM_OIDC_TENANT_ID exists. Only set it when the caller asks, so the
  // default token exercises the realistic path.
  if (tenant) payload.tenant_id = tenant;
  if (groups) payload.groups = groups.split(",");

  return new SignJWT(payload)
    .setProtectedHeader({ alg: "RS256", kid: KID })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds ?? 3600}s`)
    .sign(privateKey);
}

const json = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body, null, 2));
};

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", ISSUER);

  if (url.pathname === "/.well-known/openid-configuration") {
    return json(res, 200, {
      issuer: ISSUER,
      jwks_uri: `${ISSUER}/jwks.json`,
      token_endpoint: `${ISSUER}/token`,
      response_types_supported: ["id_token"],
      subject_types_supported: ["public"],
      id_token_signing_alg_values_supported: ["RS256"],
    });
  }

  if (url.pathname === "/jwks.json") {
    return json(res, 200, { keys: [publicJwk] });
  }

  if (url.pathname === "/token") {
    const q = url.searchParams;
    const token = await mintToken({
      sub: q.get("sub") ?? "60000000-0000-4000-8000-000000000001",
      email: q.get("email") ?? "eng@acme.com",
      tenant: q.get("tenant") ?? undefined,
      groups: q.get("groups") ?? undefined,
      ttlSeconds: q.get("ttl") ? Number.parseInt(q.get("ttl"), 10) : undefined,
    });
    return json(res, 200, { access_token: token, token_type: "Bearer" });
  }

  return json(res, 404, { error: "not_found", tried: url.pathname });
}).listen(PORT, () => {
  const tenant = "d9d9d9d9-0000-4000-8000-000000000001";
  console.log(`
mock OIDC issuer listening on ${ISSUER}

Point ARM at it:

  export ARM_OIDC_ISSUER_URL=${ISSUER}
  export ARM_OIDC_JWKS_URL=${ISSUER}/jwks.json
  export ARM_OIDC_AUDIENCE=${AUDIENCE}
  export ARM_OIDC_TENANT_ID=${tenant}

Then start the dashboard and call it with a token:

  TOKEN=$(curl -s '${ISSUER}/token?email=eng@acme.com' | jq -r .access_token)
  curl -s -H "Authorization: Bearer $TOKEN" \\
    http://localhost:3100/api/trpc/orgTree.fullTree

Without the header, or with a tampered token, the same call returns 401.
`);
});
