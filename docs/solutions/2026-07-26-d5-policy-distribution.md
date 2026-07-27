---
title: "D5: Policy distribution — pull-first, push deferred"
date: 2026-07-26
status: decided
supersedes: none
---

# D5: Policy distribution model

## Decision

**Pull-first (b), push deferred.** The data plane pulls policy updates from the control plane on a bounded TTL. Push-based invalidation is deferred to a future phase.

## Context

When the control plane updates a policy (e.g., a new deny rule), how does the data plane learn about it?

## Options considered

- **(a) Push-first** — control plane pushes updates to data plane immediately on change.
- **(b) Pull-first** — data plane pulls on a TTL; push deferred.

## Rationale

(b) wins because:
1. **Bounded worst case**: push has an unbounded worst case — a silently missed push means a stale deny rule stays active indefinitely. Pull is bounded by TTL: worst case is a TTL-duration delay.
2. **No new VPC connectivity surface**: the data plane already has outbound mTLS to the control plane. Push would require inbound connectivity to the data plane (new firewall surface, new attack vector).
3. **SLA**: 10-second pull interval, DENY-class propagation ≤ 15s, fail-closed when stale.

## Consequences

- Data plane reports `policy_version` + `last_refresh` on every pull (spec §14.1 freshness guard).
- Control-plane health surface flags caches stale beyond SLA.
- Push-based invalidation remains a Phase 2+ option if field data demands lower latency.
