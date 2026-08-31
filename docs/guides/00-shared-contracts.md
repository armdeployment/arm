---
title: "Guide 00 — Shared contracts (Wave 0, blocking)"
date: 2026-08-21
status: proposed
owner_agent: contracts
---

# Guide 00 — Shared Contracts

**Mission.** Land every type, table, event schema, enum, router stub and guardrail
stub that the four Wave-1 modules depend on, so they can be built in parallel
without touching each other. **No module logic.** When you are done the repo
typechecks, all tests pass, all guardrails are green, and four placeholder routers
exist waiting to be filled in.

Read `AGENTS.md` and `docs/solutions/2026-08-21-d10-adoption-first-restructure.md`
before starting. Locked assumptions A1–A8 are in `docs/guides/README.md`.

**You own:** `packages/proto/**`, `packages/db/src/schema/**`,
`packages/db/drizzle/**`, `packages/clickhouse/**`,
`scripts/guardrails/src/checks/boundaries.ts`, `scripts/guardrails/src/checks/ci-sync.ts`,
new guardrail **stubs** only, and the router-registration block in
`packages/trpc/src/index.ts`.

---

## 1. The `tool` → `component` cutover (A3)

`tool` and `tool_version` in `packages/db/src/schema/catalog.ts` are replaced by
`component` and `component_version` in a new `packages/db/src/schema/artifactory.ts`.
Delete the old tables and their proto schemas. There is no production data — do
**not** write a compatibility shim, a dual-read path, or a v1 canonicalizer.

Permission verbs are the one thing that does **not** rename. `tool:invoke`,
`tool:configure`, `tool:publish` (D8/D9) stay as-is and apply only to _callable_
components (`kind ∈ {mcp, http_api, cli, connector}`). Non-callable components
(skill, subagent, template, prompt_pack, plugin) are installed, not invoked, and
have no verb. Record this rule in `docs/CONCEPTS.md`.

---

## 2. New enums — `packages/db/src/schema/enums.ts`

```ts
export const componentKindEnum = pgEnum("component_kind", [
  "mcp",
  "http_api",
  "cli",
  "connector", // callable  → tool:* verbs apply
  "plugin",
  "skill",
  "subagent",
  "template",
  "prompt_pack", // installable
]);

export const componentSourceKindEnum = pgEnum("component_source_kind", [
  "first_party",
  "tenant_authored",
  "imported",
]);

export const storageBackendEnum = pgEnum("storage_backend", ["fs", "s3", "oci"]);
export const blobResidencyEnum = pgEnum("blob_residency", ["control_plane", "tenant"]);
export const discoverySourceKindEnum = pgEnum("discovery_source_kind", [
  "mcp_registry",
  "git",
  "http_index",
  "marketplace",
]);
export const discoveryCandidateStatusEnum = pgEnum("discovery_candidate_status", [
  "new",
  "triaged",
  "promoted",
  "rejected",
]);
export const questionnaireStatusEnum = pgEnum("questionnaire_status", [
  "draft",
  "published",
  "archived",
]);
```

`toolKindEnum` and `toolReviewStatusEnum`: rename `toolReviewStatusEnum` →
`componentReviewStatusEnum` (same members: `draft | in_review | approved | rejected
| deprecated`); delete `toolKindEnum` (subsumed by `componentKindEnum`).

---

## 3. New Postgres tables

### 3.1 `packages/db/src/schema/artifactory.ts`

```
component            id, tenant_id, slug, kind, name, description, owner_user_id,
                     review_status, source_kind, source_ref, endpoint (nullable),
                     auth_strategy (nullable), data_classification, homepage_url,
                     created_at, updated_at
                     UNIQUE (tenant_id, slug)

component_version    id, tenant_id, component_id, version (semver), manifest jsonb,
                     manifest_sha256, blob_digest (nullable, "sha256:<hex>"),
                     blob_size_bytes, blob_media_type, config_schema jsonb,
                     requires jsonb ([{component_slug, range}]), changelog,
                     yanked bool default false, published_at, published_by
                     UNIQUE (component_id, version)

component_blob       digest PK ("sha256:<hex>"), tenant_id (nullable for
                     first_party), media_type, size_bytes, storage_backend,
                     residency, storage_key, uploaded_by, created_at

job_function         id, tenant_id, key, name, function_family, industry_profile,
                     aliases jsonb, headcount_weight int default 0, created_at
                     UNIQUE (tenant_id, key)

component_job_function      component_id, job_function_id      PK both
work_package_job_function   package_id,   job_function_id      PK both

discovery_source     id, tenant_id, kind, name, endpoint, auth_ref (nullable),
                     enabled bool, last_synced_at, created_at

discovery_candidate  id, tenant_id, source_id, external_ref, proposed_kind, name,
                     description, raw_manifest jsonb, status, promoted_component_id
                     (nullable), first_seen_at, reviewed_by, reviewed_at
                     UNIQUE (source_id, external_ref)
```

Every table carries `tenant_id NOT NULL` except `component_blob` (nullable only for
`residency = 'control_plane'` first-party artifacts). Add that exemption explicitly
to `scripts/guardrails/src/checks/tenant-isolation.ts` with a comment — do not
weaken the guard generically.

### 3.2 `packages/db/src/schema/onboarding.ts`

```
questionnaire_definition  id, tenant_id, version int, industry_profile, graph jsonb,
                          status, published_at, created_at
                          UNIQUE (tenant_id, version)

questionnaire_response    id, tenant_id, definition_version, user_id (nullable),
                          org_node_id (nullable), answers jsonb (STRUCTURED ONLY —
                          no free text, see A5), resolved_job_function_key,
                          recommended_package_version_ids jsonb, created_at

setup_token               id (= jti), tenant_id, token_sha256, user_id,
                          package_version_ids jsonb, connections_digest,
                          activation_code (6 chars, UNIQUE per tenant),
                          expires_at, redeemed_at (nullable),
                          redeemed_client_version, created_at
```

`setup_token` stores a **hash** of the token, never the token. Add a comment
pointing at Invariant 4.

### 3.3 `work_package_version` changes — `packages/db/src/schema/catalog.ts`

Drop `tools`, `skills`, `subagent_configs`, `template_refs`.
Add:

```
manifest_version  integer NOT NULL DEFAULT 2
components        jsonb NOT NULL DEFAULT '[]'   -- ComponentRef[]
job_functions     jsonb NOT NULL DEFAULT '[]'   -- string[] (job_function.key)
```

Add to `work_package`: `approval_required boolean NOT NULL DEFAULT true` (A6).

Regenerate migrations with `pnpm --filter @arm/db db:generate`.

---

## 4. Manifest v2 — the hashed field list

This is a deliberate wire break. `packages/catalog/src/manifest.ts` documents the
v1 nine-field list; replace it with **exactly these eight fields**, in this order,
snake_case, arrays sorted deterministically:

```
1. manifest_version   (integer, always 2)
2. components         [{component_id, version, kind, scopes[]}]  sorted by component_id
3. permissions        string[]                                    sorted
4. model_routing      object
5. budget_template    object
6. starter_prompts    string[]                                    order preserved
7. min_agent_version  string
8. job_functions      string[]                                    sorted
```

You define the type + the canonicalizer contract in `packages/proto`; the `library`
agent reimplements `canonicalManifest` in `packages/catalog` and `client-core`
against it and regenerates the golden vector. Ship a **shared golden vector** as a
committed JSON fixture at `packages/proto/test/fixtures/manifest-v2-golden.json`
with its expected sha256, so both implementations are tested against one artifact.

---

## 5. `packages/proto` additions

Add zod schemas + inferred type exports (the existing file exports schemas but not
types — for the new ones **export both**, so `packages/catalog` stops declaring
structural mirrors in `types.ts`):

- `componentKindSchema`, `componentReviewStatusSchema`, `componentSourceKindSchema`
- `componentSchema`, `componentVersionSchema`, `componentRefSchema`, `componentBlobSchema`
- `jobFunctionSchema`
- `discoverySourceSchema`, `discoveryCandidateSchema`
- `packageManifestV2Schema` (the 8 fields above)
- `questionnaireGraphSchema` — see §5.1
- `questionnaireAnswerSchema` — **structured values only**: `z.record(z.string(),
z.union([z.string(), z.array(z.string()), z.number(), z.boolean()]))`. No free-text
  field exists in this schema; that is the enforcement point for A5.
- `setupTokenClaimsSchema` — see §5.2
- `activationEventSchema`, `componentPullEventSchema` — see §6
- update `catalogSchemas`, `eventSchemas`, and `ALL_EVENT_FIELDS`
  (`no-content-egress` reads that list).

### 5.1 Questionnaire graph

```ts
questionNodeSchema = z.object({
  id: z.string(),
  kind: z.enum(["single", "multi", "scale"]), // NOTE: no "text" — A5
  prompt: z.string(),
  help: z.string().default(""),
  options: z.array(
    z.object({
      value: z.string(),
      label: z.string(),
      signals: z.object({
        job_functions: z.array(z.string()).default([]),
        components: z.array(z.string()).default([]),
        weight: z.number().default(1),
      }),
    }),
  ),
  next: z.array(z.object({ when: z.string().nullable(), goto: z.string().nullable() })),
});

questionnaireGraphSchema = z.object({
  version: z.number().int(),
  industry_profile: z.string(),
  entry: z.string(),
  nodes: z.array(questionNodeSchema),
});
```

### 5.2 Setup token claims

```ts
setupTokenClaimsSchema = z.object({
  iss: z.string(),
  aud: z.literal("arm-client"),
  jti: z.string(),
  sub: z.string(), // user id
  tenant_id: z.string(),
  package_version_ids: z.array(z.string()),
  connections_digest: z.string(), // sha256 of the connections manifest
  control_plane_url: z.string().url(),
  data_plane_url: z.string().url(),
  proxy_url: z.string().url(),
  exp: z.number(),
  iat: z.number(),
});
```

Never carries a credential, a secret, or free text. Add a contract test asserting
the schema has no field named `secret|token|password|key|answer|text`.

---

## 6. ClickHouse — `packages/clickhouse/migrations/0003_adoption.sql`

```sql
CREATE TABLE IF NOT EXISTS activation_event (
  ts               DateTime64(3),
  tenant_id        String,
  org_node_id      String,
  user_ref         String,                       -- pseudonymous id, never an email
  job_function_key LowCardinality(String) DEFAULT '',
  step             Enum('invited','questionnaire_started','questionnaire_completed',
                        'token_issued','downloaded','installed','runtime_ready',
                        'connections_started','connections_completed',
                        'first_metered_call','weekly_active'),
  outcome          Enum('ok','error','abandoned'),
  package_version_id String        DEFAULT '',
  client_version   LowCardinality(String) DEFAULT '',
  error_code       LowCardinality(String) DEFAULT '',
  duration_ms      UInt32 DEFAULT 0
) PARTITION BY (tenant_id, toYYYYMM(ts)) ORDER BY (tenant_id, ts);

CREATE TABLE IF NOT EXISTS component_pull_event (
  ts            DateTime64(3),
  tenant_id     String,
  component_id  String,
  version       String,
  blob_digest   String,
  bytes         UInt64,
  cache_hit     UInt8,
  client_version LowCardinality(String) DEFAULT ''
) PARTITION BY (tenant_id, toYYYYMM(ts)) ORDER BY (tenant_id, ts);
```

Both partitioned `(tenant_id, toYYYYMM(ts))` — Invariant 6, asserted at runtime the
same way `0001_init.sql` is.

---

## 7. Dependency direction

Update `scripts/guardrails/src/checks/boundaries.ts` to enforce:

```
proto → config → {db, clickhouse, policy, billing, auth, profiles}
      → {artifactory, catalog, discovery, questionnaire} → trpc → apps/*
```

- `packages/questionnaire` may import `proto` and `config` only (it must stay pure
  and dependency-light so `questionnaire-determinism` is checkable).
- `packages/artifactory` may not import `catalog`; `catalog` may import `artifactory`.
- `packages/discovery` may import `artifactory` + `db`, never `catalog` or `trpc`.
- Data-plane apps import `proto`/`config` only — unchanged.

Add a workspace entry for the new packages in `pnpm-workspace.yaml` if the glob
does not already cover them (`packages/*` does).

---

## 8. Router placeholders — `packages/trpc/src/index.ts`

Create `library-router.ts`, `onboarding-router.ts`, `adoption-router.ts` each
exporting a router with the procedure names listed below, every one returning a
typed empty fixture and a `TODO(module)` comment. Register all three plus the
existing `catalog` inside a clearly marked block:

```ts
// ── ROUTER REGISTRATION BLOCK — only the `server` agent edits below ──────────
export const appRouter = t.router({ …, catalog, library, onboarding, adoption });
// ── END ROUTER REGISTRATION BLOCK ────────────────────────────────────────────
```

Procedure names to stub (signatures are the module guides' business; names are
frozen here):

- `library`: `search`, `facets`, `getComponent`, `listVersions`, `publishVersion`,
  `listSources`, `listCandidates`, `promoteCandidate`, `rejectCandidate`,
  `listJobFunctions`, `recommendForJobFunction`, `gaps`
- `onboarding`: `getQuestionnaire`, `submitResponse`, `recommend`,
  `issueSetupToken`, `redeemSetupToken`, `resolveActivationCode`
- `adoption`: `funnel`, `stalls`, `timeToValue`, `coverage`, `activeUsers`,
  `recentActivations`

---

## 9. Guardrail stubs

Create in `scripts/guardrails/src/checks/`, registered in `run.ts`, each currently
asserting the shape it will police (and **failing loudly on empty input** — §14.2):

| File                           | Asserts                                                                                                                                      | Filled by |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| `component-review.ts`          | no `work_package_version.components` entry references a component whose `review_status ≠ approved`                                           | `library` |
| `artifact-integrity.ts`        | every `component_version` with a blob has a `sha256:` digest; no manifest contains a mutable URL where a digest belongs                      | `library` |
| `blob-residency.ts`            | no `component_blob` with `source_kind = tenant_authored` has `residency = control_plane` (Invariant 1)                                       | `library` |
| `questionnaire-determinism.ts` | the mapping module imports nothing outside `proto`/`config`; no `fetch`, `Date.now`, `Math.random`, or `crypto.randomUUID` reachable from it | `client`  |
| `no-content-in-activation.ts`  | `activationEventSchema` + `questionnaireAnswerSchema` contain no free-text field (extends `no-content-egress`)                               | `client`  |

Update the `AGENTS.md` CI table and `docs/arm-spec.md` §14.1 in the same PR
(`ci-sync` guard enforces the first).

---

## 10. Acceptance criteria

- [ ] `tool`/`tool_version` gone; `component`/`component_version` present; no shim.
- [ ] All tables in §3 exist with `tenant_id NOT NULL` (documented exemption only for first-party blobs).
- [ ] Drizzle migration regenerated and committed; `contract-check.yml` passes.
- [ ] ClickHouse `0003_adoption.sql` applied in the test harness; partition assertion covers both new tables.
- [ ] `packages/proto` exports schemas **and** inferred types for everything in §5; `ALL_EVENT_FIELDS` updated.
- [ ] `manifest-v2-golden.json` + expected sha256 committed.
- [ ] `setupTokenClaimsSchema` contract test (no secret-ish field names) passes.
- [ ] `boundaries` guard updated and red when a violation is introduced (mutation proof).
- [ ] Five guardrail stubs registered, each red on empty input.
- [ ] Three placeholder routers registered; `pnpm typecheck && pnpm test && pnpm guardrails` green.

## 11. Docs to update in the same PR series

`docs/arm-spec.md` §4.1 (new tables), §4.2 (new event tables), §14.1 (new guards),
§15 (layout); `docs/CONCEPTS.md` (component, artifact digest, job function, setup
token, activation funnel, discovery candidate, the `tool:*`-verbs-only-for-callable
rule); `AGENTS.md` (repo map, dependency direction, CI table).
