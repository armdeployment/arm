# Security Policy

## Reporting a vulnerability

Please report security issues privately via GitHub's
[private vulnerability reporting](https://github.com/armdeployment/arm/security/advisories/new)
rather than opening a public issue.

Include what you did, what you expected, and what happened. We'll
acknowledge receipt and keep you updated on the fix.

## Project status

ARM is pre-1.0. Treat it as **not yet production-hardened** — see the
deliberate gaps listed below before deploying it anywhere sensitive.

## Security model in brief

ARM's security posture is defined by the cross-cutting invariants in
[`docs/arm-spec.md`](docs/arm-spec.md) §11, and enforced by executable
guardrails (`pnpm guardrails`) rather than convention:

- **Prompt bodies and resource content never leave the tenant VPC.** The
  control plane is metadata + audit only. Enforced by the
  `no-content-egress`, `blob-residency`, and `no-content-in-activation`
  guardrails.
- **Short-lived credentials everywhere.** Rendered agent configs contain
  environment-variable _references_, never literal secrets;
  `assertNoSecretsInConfig` fails the install if a literal appears.
- **Tenant isolation.** Every query is `tenant_id`-scoped; the
  `tenant-isolation` guardrail rejects unscoped queries.
- **Content-addressed artifacts.** Component blobs are pinned by sha256 and
  a digest mismatch is a hard failure — unverified bytes are never written
  to disk.

## Known gaps — read before deploying

These are deliberate, documented limitations of the current state, not
oversights:

- **`ARM_SETUP_TOKEN_SECRET` must be set in production, and now is
  enforced.** The development fallback is a well-known public string, so a
  deployment using it can have setup tokens minted by anyone who has read
  the source — and a setup token is the credential a brand-new machine
  presents with no prior session. Under `NODE_ENV=production` ARM now
  **refuses to mint or accept** a setup token signed with the fallback (or
  with the fallback copied into the env var), rather than issuing one. Set it to a long random
  value; the `arm-control-plane` chart's `secrets.setupToken` wires it in.
- **OIDC verification is live, but only bearer-token verification.**
  `apps/control-plane/web` and `apps/onboarding` verify `Authorization:
Bearer` tokens against your IdP's JWKS when `ARM_OIDC_ISSUER_URL`,
  `ARM_OIDC_JWKS_URL` and `ARM_OIDC_AUDIENCE` are set — see
  [`docs/sso-setup.md`](docs/sso-setup.md). With none of them set they fall
  back to a fixed development identity, and under `NODE_ENV=production`
  they **refuse every authenticated request** rather than doing so silently.
  IdP groups map onto ARM roles via `resolveRolesFromGroups`. What is still
  missing: ARM does not run the browser login flow that obtains a token — put
  a reverse proxy that does in front of it.
- **No SCIM or SAML.** `provisionSCIMUser`, `provisionSCIMGroup` and
  `verifySAMLAssertion` in `packages/auth` throw `NotImplementedError`.
  They previously returned fixture data that looked like success —
  `verifySAMLAssertion` in particular returned a complete, valid assertion
  for `user@acme.com` given any input at all, which would have been an
  authentication bypass for its first caller. Nothing called them, which is
  the only reason it was never exploitable. Use OIDC, and map IdP groups to
  roles with `resolveRolesFromGroups` ([`docs/sso-setup.md`](docs/sso-setup.md)).
- **The data-plane proxy's quota store is per-replica.** Consumption is now
  written through to disk (`PROXY_QUOTA_STATE_DIR`) and reloaded on start, so
  restarting the proxy no longer hands every agent its daily cap back, and
  the day key rolls the cap over without a scheduled job. It is still
  process-local: run more than one replica and the cap is enforced **per
  replica**, so the effective cap is that multiple of the configured one. A
  shared store is not built yet; the Helm chart says so at install time.
- **Metering ingest is authenticated by a shared secret, not mTLS.** The
  control plane's `/api/ingest/metering` accepts a bearer token
  (`ARM_INGEST_TOKEN`); the spec's answer is mTLS, and this is the
  in-application equivalent for deployments terminating TLS at an ingress.
  Ingest refuses under `NODE_ENV=production` when the token is unset, because
  an open ingest endpoint lets anyone forge any tenant's spend.
- **`ARM_DEMO` read-only mode covers fixture-mode mutations only.** It does
  not roll back writes made against a real Postgres. Within fixture mode the
  rollback is now genuinely complete: snapshots were shallow copies that
  shared their elements, so a resolver mutating a field on an existing object
  (rather than replacing it) survived the "rollback". They are deep copies
  now.

## Supported versions

Pre-1.0: only the latest `main` receives fixes.
