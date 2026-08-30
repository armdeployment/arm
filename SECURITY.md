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
  environment-variable *references*, never literal secrets;
  `assertNoSecretsInConfig` fails the install if a literal appears.
- **Tenant isolation.** Every query is `tenant_id`-scoped; the
  `tenant-isolation` guardrail rejects unscoped queries.
- **Content-addressed artifacts.** Component blobs are pinned by sha256 and
  a digest mismatch is a hard failure — unverified bytes are never written
  to disk.

## Known gaps — read before deploying

These are deliberate, documented limitations of the current state, not
oversights:

- **`ARM_SETUP_TOKEN_SECRET` has a well-known development fallback.** If
  you do not set it, setup tokens are signed with a public string. Set it
  to a long random value in any deployment reachable by anyone else.
- **No live OIDC verification yet.** `apps/control-plane/web` and
  `apps/onboarding` inject a fixed development tenant/user identity rather
  than verifying a real IdP token (`TODO(1.1)` in their tRPC routes). Do
  not expose these to untrusted networks as-is.
- **The data-plane proxy's quota store is in-memory.** Restarting the proxy
  resets consumption; it is not yet a durable enforcement boundary.
- **`ARM_DEMO` read-only mode covers fixture-mode mutations only.** It does
  not roll back writes made against a real Postgres.

## Supported versions

Pre-1.0: only the latest `main` receives fixes.
