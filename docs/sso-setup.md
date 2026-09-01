# Connecting ARM to your identity provider

**Audience: whoever runs ARM for a company.** For the employee-facing side —
connecting an agent, the connections wizard — see
[`agent-onboarding-guide.md`](agent-onboarding-guide.md).

Out of the box ARM authenticates nobody. Every request to the dashboard and to
the onboarding app resolves to one built-in development identity, so a fresh
clone runs with no configuration at all. That is the right default for
evaluating ARM and the wrong one for anything else.

This page is how you replace it.

## The three states

ARM decides once, at startup, from environment variables
(`resolveAuthMode` in `packages/auth/src/index.ts`):

| What you set                                 | Mode          | Behaviour                                                       |
| -------------------------------------------- | ------------- | --------------------------------------------------------------- |
| Nothing, and `NODE_ENV` is not `production`  | `development` | Every request is the built-in dev user. Fine for evaluation.    |
| Issuer + JWKS + audience                     | `oidc`        | Bearer tokens are verified against your IdP's JWKS.             |
| Nothing, and `NODE_ENV=production`           | `refuse`      | Every authenticated call returns `401`. **This is deliberate.** |
| Some but not all of issuer / JWKS / audience | `refuse`      | Also `401`. A half-built verifier is worse than none.           |

The `refuse` state is the important one. A production deployment with no IdP
configured used to serve every caller the same fixed identity with the same
fixed tenant — an open dashboard that looked like a working one. It now fails
closed and logs exactly what is missing:

```
[auth] control-plane: refuse — NODE_ENV=production with no OIDC configuration.
Set ARM_OIDC_ISSUER_URL, ARM_OIDC_JWKS_URL and ARM_OIDC_AUDIENCE
(see docs/sso-setup.md), or set ARM_ALLOW_DEV_IDENTITY=1 if you intend
everyone to share one fixed identity.
```

If you genuinely want the shared identity in production — a kiosk demo, a
locked-down internal sandbox — `ARM_ALLOW_DEV_IDENTITY=1` says so out loud.

## The variables

```bash
ARM_OIDC_ISSUER_URL   # must match the `iss` claim in your tokens exactly
ARM_OIDC_JWKS_URL     # where ARM fetches your signing keys
ARM_OIDC_AUDIENCE     # must match the `aud` claim — usually your app/client id
ARM_OIDC_TENANT_ID    # the ARM tenant verified users belong to
ARM_OIDC_TENANT_CLAIM # optional; default "tenant_id"
ARM_OIDC_EMAIL_CLAIM  # optional; default "email"
```

**`ARM_OIDC_TENANT_ID` is the one people miss.** ARM scopes every query by
tenant (Invariant 6), so a verified user with no tenant cannot be served. No
Okta, Entra or Google token carries a `tenant_id` claim unless someone
configures one, so for the normal case — one ARM deployment, one company —
set `ARM_OIDC_TENANT_ID` and leave `ARM_OIDC_TENANT_CLAIM` alone. If you do
put the tenant in a custom claim, point `ARM_OIDC_TENANT_CLAIM` at it; the
claim wins when present and the fixed value is the fallback.

A token that verifies but resolves to no tenant is rejected with a message
saying so, rather than being quietly assigned one.

## Try it locally first, without an IdP tenant

You do not need an Okta or Entra tenant to check that your wiring is right.
ARM ships a local issuer that serves a discovery document and a JWKS and mints
signed RS256 tokens:

```bash
make mock-idp
```

It prints the exact variables to export. In a second terminal:

```bash
export ARM_OIDC_ISSUER_URL=http://localhost:9999
export ARM_OIDC_JWKS_URL=http://localhost:9999/jwks.json
export ARM_OIDC_AUDIENCE=arm-control-plane
export ARM_OIDC_TENANT_ID=d9d9d9d9-0000-4000-8000-000000000001
pnpm --filter @arm-app/web dev
```

And in a third, prove all four cases:

```bash
TOKEN=$(curl -s 'http://localhost:9999/token?email=eng@acme.com' | jq -r .access_token)

# 1. valid token → data
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3100/api/trpc/orgTree.fullTree

# 2. no token → 401
curl -s http://localhost:3100/api/trpc/orgTree.fullTree

# 3. tampered token → 401
curl -s -H "Authorization: Bearer ${TOKEN%?}X" http://localhost:3100/api/trpc/orgTree.fullTree

# 4. expired token → 401
curl -s 'http://localhost:9999/token?ttl=1' | jq -r .access_token   # wait 2s, then send it
```

The rejection reason (`signature verification failed`, `"exp" claim timestamp
check failed`) is logged server-side and never returned to the caller, who
only ever sees `UNAUTHORIZED`.

The mock issuer generates its keypair in memory on every start and never
writes it anywhere. It has no login UI, no authorization code flow and no
client authentication — it signs whatever you ask it to. It is a test double.
Never run it anywhere that matters.

## Mapping groups to roles

A verified user arrives with a subject, an email, a tenant — and their group
memberships, if your IdP emits them. `ARM_OIDC_GROUPS_CLAIM` says which claim
carries them (default `groups`; Auth0 rules usually namespace it, e.g.
`https://acme.com/groups`). Array, comma-separated string and absent are all
accepted, because providers disagree.

Groups become ARM roles through rules your tenant configures:

```ts
import { resolveRolesFromGroups, hasPermission } from "@arm/auth";

const rules = [
  { group: "arm-admins", role: { name: "org_admin", permissions: ["*"] } },
  {
    group: "plant-7-leads",
    role: { name: "plant_lead", permissions: ["agent:create", "budget:read"] },
    scopeType: "plant",
    scopeId: "plant_7",
  },
];

const roles = resolveRolesFromGroups(claims.groups ?? [], rules);
hasPermission(roles, "agent:create"); // true for a plant-7 lead
```

Two things worth knowing. Group matching is **case-insensitive**, because
Entra returns group names with the directory's casing and nobody reproduces
it by hand. And a group with no rule grants **nothing**, silently — most
directories are full of groups that have nothing to do with ARM, and that is
not an error worth failing a login over.

The rules are tenant configuration read from `roleTable`, not something
`@arm/auth` resolves: it is a layer-2 package and may not import `@arm/db`
(AGENTS.md), so the caller loads the rules and passes them in. This is also
why group membership grants roles but does not _create_ them — authority
still flows from roles a tenant admin defined, never from a group name.

## Microsoft Entra ID (Azure AD)

Register ARM as an app, then:

```bash
ARM_OIDC_ISSUER_URL=https://login.microsoftonline.com/<tenant-guid>/v2.0
ARM_OIDC_JWKS_URL=https://login.microsoftonline.com/<tenant-guid>/discovery/v2.0/keys
ARM_OIDC_AUDIENCE=<application-client-id>
ARM_OIDC_TENANT_ID=<your ARM tenant uuid>
```

Entra's v2.0 issuer includes the `/v2.0` suffix and the tenant GUID, not the
`onmicrosoft.com` domain — a mismatch here is the most common cause of
`unexpected "iss" claim value`. If your app requests the `email` claim as
`upn` instead, set `ARM_OIDC_EMAIL_CLAIM=upn`.

## Okta

```bash
ARM_OIDC_ISSUER_URL=https://<org>.okta.com/oauth2/<authorization-server-id>
ARM_OIDC_JWKS_URL=https://<org>.okta.com/oauth2/<authorization-server-id>/v1/keys
ARM_OIDC_AUDIENCE=api://arm
ARM_OIDC_TENANT_ID=<your ARM tenant uuid>
```

Use the custom authorization server (`/oauth2/<id>`), not the org server
(`/oauth2/v1`), if you want to control the `aud` claim — the org server always
issues tokens audienced to Okta itself.

## Google Workspace

```bash
ARM_OIDC_ISSUER_URL=https://accounts.google.com
ARM_OIDC_JWKS_URL=https://www.googleapis.com/oauth2/v3/certs
ARM_OIDC_AUDIENCE=<oauth-client-id>.apps.googleusercontent.com
ARM_OIDC_TENANT_ID=<your ARM tenant uuid>
```

Google's issuer is the bare `https://accounts.google.com` with no trailing
slash and no path.

## What this does not cover yet

Being explicit, so none of it is discovered mid-rollout:

- **No browser login flow.** ARM verifies bearer tokens; it does not run the
  authorization code redirect that obtains one. A reverse proxy that performs
  login and forwards the token (oauth2-proxy, an ingress auth annotation, your
  API gateway) is the assumed deployment shape.
- **No SCIM provisioning.** ARM does not accept an IdP's provisioning push.
  `provisionSCIMUser` and `provisionSCIMGroup` now throw `NotImplementedError`
  rather than returning the phantom success they used to. Group-based access
  works without SCIM — see "Mapping groups to roles" above.
- **No SAML.** `verifySAMLAssertion` throws. It previously returned a
  complete, valid-looking assertion for `user@acme.com` given _any_ input,
  which would have been an authentication bypass for its first caller. Use
  OIDC; every provider above speaks it.
- **The onboarding app's public setup-token path is deliberately not
  SSO-gated.** Redemption is authenticated by the signed token itself
  (`ARM_SETUP_TOKEN_SECRET`), because the employee redeeming it may not have a
  dashboard session. Set that secret; its fallback is a well-known dev string.
- **No token caching or revocation.** Every request verifies against the JWKS
  (jose caches the key set, not the decision). There is no session, so there is
  nothing to revoke — a token is valid until it expires.

See [`../SECURITY.md`](../SECURITY.md) for the full list of known gaps.
