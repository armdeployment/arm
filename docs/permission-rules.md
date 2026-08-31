# Permission Rules — Tiered Delegation & Deny-Overrides

> Skeleton. Cross-referenced by `docs/arm-spec.md` §11 invariant 3 ("Higher-level deny always wins") and §6.1 (Resolution model). Tables finalize once the 1.3 schema is locked. Until then this document records the _contract_ implementers must honor so the 1.0/1.2 schema can be written against it.

## 1. Scope

Applies to the `permission` / access-policy domain only (resource grants). The LLM-policy domain (`LLMPolicy`, `Budget`) is resolved separately by the Policy Engine except for the cross-domain classification gate (§3 below).

## 2. Authority hierarchy

From most authoritative (highest) to least (lowest):

| Rank | Level       | Authority                                               |
| ---- | ----------- | ------------------------------------------------------- |
| 0    | Org default | broadest; constrains everything below                   |
| 1    | Department  | may narrow within dept                                  |
| 2    | Group       | may narrow within group                                 |
| 3    | Team        | may narrow within team                                  |
| 4    | Workstream  | may narrow within workstream                            |
| 5    | Agent       | narrowest; per-resource explicit grants refine defaults |

"Higher" = closer to the Org root (lower rank number). A **deny** at a higher rank overrides **any allow** at a lower rank, _including a lower-rank explicit grant_. An **allow** at a higher rank does **not** constitute a grant at a lower rank; lower ranks may still deny.

## 3. Cross-domain gate (classification → LLM routing)

A resource's `ClassificationLevel.rank` gates which LLM may receive that resource's **content**:

- `restricted` / `confidential` content ⇒ the agent's holding context is tagged; closed external models (Anthropic/OpenAI) are **disallowed** for subsequent turns until the tagged context is dropped.
- This gate is enforced in the **data plane** (proxy + resource connector), not the control plane, so it survives the metadata-only boundary (invariant 1).

> Decided (D2-a, 2026-07-26): Phase 1 enforcement is per-agent `classification_context` tagging in the data plane — _mint_ connectors tag at credential-vending time, _proxy_ connectors at response time; the proxy/gateway refuses closed-external-model routing while context ≥ `confidential`. Full mechanism: spec §6.5.

## 4. Resolution algorithm (per principal × resource × action)

```text
result := INHERIT  # default deny unless an allow is found

# 1. Walk hierarchy from Org (rank 0) down to Agent (rank 5).
for level in [Org, Dept, Group, Team, Workstream, Agent]:
    rule := lookup(level, principal, resource, action)

    if rule.decision == DENY:
        return DENY                      # higher deny wins, short-circuit
    if rule.decision == ALLOW:
        result := ALLOW                  # tentative; a higher level may still deny on a later pass? no -- we go top-down, so any later DENY at a *higher* rank already returned. Lower-rank ALLOW cannot override a higher DENY because we already returned.
        result_constraints := merge(result_constraints, rule.constraints)

# 2. Apply per-resource explicit grants (rank 5 refinement).
grant := lookup_explicit_grant(principal, resource, action)
if grant and grant.expires_at > now() and grant not revoked:
    result := ALLOW
    result_constraints := merge(result_constraints, grant.constraints)

# 3. ABAC classification check.
if agent.classification_clearance < resource.classification.rank:
    return DENY                          # classification gate, never overridable

return result with merged_constraints
```

Walk is **top-down**: the first `DENY` encountered (always from the highest applicable rank) wins immediately. `ALLOW`s accumulate constraints; a higher-rank `DENY` always prevails over any accumulated lower-rank `ALLOW`.

## 5. Constraints vocabulary (initial)

| Constraint          | Applies to           | Example                 |
| ------------------- | -------------------- | ----------------------- |
| `prefix`            | S3 / GCS object keys | `/{team}/`              |
| `ttl_seconds`       | minted credentials   | `900` (15 min)          |
| `max_rows`          | DB proxy query       | `1000`                  |
| `read_only`         | any                  | `true`                  |
| `sites[]`           | SharePoint/Graph     | `["site-A"]`            |
| `classifications[]` | LLM routing gate     | `["public","internal"]` |

## 6. Enforcement point matrix

| Strategy | Where rules resolved                                     | Where decided                                      | Revocation                     |
| -------- | -------------------------------------------------------- | -------------------------------------------------- | ------------------------------ |
| mint     | control plane Policy Engine (cache pushed to data plane) | data plane connector (issues STS/OAuth/signed URL) | TTL expiry (short-lived)       |
| proxy    | data plane (per-call)                                    | data plane brokers every call                      | drop session / close conn      |
| sync     | control plane reconciles external perms as grants        | external system (Graph/IAM) enforces               | drift-detection job reconciles |

## 7. Audit emission

Every resolution emits an `access_audit_event` (see `docs/arm-spec.md` §4.2) with `decision ∈ {allow, deny, jit_grant}` and a human-readable `reason` referencing the rank that produced the decisive rule.

## 8. Open items (to resolve against 1.3 schema)

- [ ] Exact column for "deny at rank N" in `PermissionGrant` (decision enum) vs a separate `DenyRule` table.
- [ ] Whether Workstream/Agent levels may issue `ALLOW` at all or only refine/constrain (current assumption: may allow within authority).
- [ ] Constraint merge conflict policy (e.g., two `prefix` allows → intersection or union?).
- [ ] JIT grant expiry vs session-bound proxy sessions: shared `expires_at` column?

## 5. Enforcement Reference (1.3 — as implemented)

The policy resolver in `packages/policy` implements:

| Rule                | Behavior                          |
| ------------------- | --------------------------------- |
| No matching grant   | Default deny                      |
| Allow at any level  | Allow (unless higher deny exists) |
| Deny at any level   | Denies all lower-level allows     |
| Expired grant       | Ignored (treated as no grant)     |
| Wildcard action `*` | Matches any action                |

### S3 Connector

- Strategy: mint (STS AssumeRoleWithWebIdentity)
- Enforcement: IAM policy templated from grants at credential mint time
- TTL: ≤15 min default, ≤60 min max (Invariant §11.4)

### GCS Connector

- Strategy: mint (Workload Identity Federation)
- Enforcement: Scoped OAuth token with bucket/prefix constraints
- TTL: ≤15 min default, ≤60 min max

### DB Connector

- Strategy: proxy (ARM brokers every query)
- Enforcement: Per-call policy check + query audit
- Classification: Redacts confidential columns for restricted agents

### SharePoint Connector

- Strategy: mint + sync hybrid
- Enforcement: Graph API scoped token + periodic permission drift detection
- Drift: Stale grants auto-revoked; drift >0 triggers alert
