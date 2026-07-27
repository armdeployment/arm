---
title: "D2: Classification gate — context tagging at vend/return"
date: 2026-07-26
status: decided
supersedes: none
---

# D2: Classification gate enforcement point

## Decision

**(a) Context tagging at vend/return time.** The data plane maintains a per-agent `classification_context` (max classification of content obtained) with a ~30-min sliding TTL.

## Context

How should ARM enforce the rule that confidential+ content cannot be sent to closed external models (spec §6.5)?

## Options considered

- **(a) Context tagging at vend/return** — metadata-only; ARM never sees content bytes.
- **(b) Content inspection at proxy** — DLP scanning of actual content at the proxy layer.

## Rationale

(a) wins because:
1. **Prompt privacy (Invariant §11.1)**: ARM-the-control-plane is metadata + audit only. Content inspection would require content to flow through ARM, violating the core trust boundary.
2. **Strategy-appropriate tagging**: mint connectors (S3/GCS) tag at credential-vending time; proxy connectors (DB) tag at response time. The point where access is *implied* is when the tag fires.
3. **Phase 2 extensibility**: content-pattern DLP hooks are reserved at the proxy for Phase 2, but Phase 1 ships metadata-only audit by default.

## Consequences

- `classification_context` is session metadata, not content — lives entirely in the data plane.
- Only resource connectors may write it (write-path hardening, spec §6.5 v0.5).
- Session reset is authenticated, policy-gated, and audited.
- Gate decisions emit `access_audit_event(decision=deny, reason="classification_gate")`.
