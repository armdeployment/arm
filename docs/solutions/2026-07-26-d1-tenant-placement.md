---
title: "D1: Tenant placement — Tenant above Organization + dual delivery"
date: 2026-07-26
status: decided
supersedes: none
---

# D1: Tenant placement

## Decision

**(b) Tenant sits above Organization**, with **dual delivery** (SaaS + self-hosted) from one schema.

## Context

The original spec had Organization as the top-level entity. The question: where does Tenant sit, and how does the schema serve both SaaS (multi-tenant) and self-hosted (single-tenant) deployments?

## Options considered

- **(a) Organization is top-level** — no Tenant entity; multi-tenancy via row-level security only.
- **(b) Tenant above Organization** — Tenant is the root; Orgs nest within; self-hosted = one Tenant row.

## Rationale

(b) wins because:
1. **Deployment-neutral**: self-hosted on-prem is a degenerate case of multi-tenant SaaS (one Tenant row). Same schema, same guardrails, same code paths.
2. **MSP / holding-company support**: one tenant can host several organizations without schema changes.
3. **Uniform isolation**: every multi-tenant table carries `tenant_id NOT NULL` (Invariant §11.6), enforced by `guardrails/tenant-isolation`. This guard runs identically in both deployments.
4. **Dual delivery**: brokerage mode for SaaS, pass-through master keys for self-hosted. The `deployment` enum (`saas` | `self_hosted`) on Tenant switches behavior without branching the schema.

## Consequences

- Every table (except `tenant` itself) has `tenant_id NOT NULL`.
- Self-hosted deployments seed exactly one Tenant row at install time.
- See `docs/arm-spec.md` §3.4 for the deployment model.
