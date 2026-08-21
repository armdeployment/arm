---
title: "Guide 01 — Library / Artifactory"
date: 2026-08-21
status: proposed
owner_agent: library
---

# Guide 01 — The Library (Artifactory)

**Mission.** Build the artifact repository that holds plugins, MCP servers, skills,
sub-agents, templates and prompt packs, organised by job function, with immutable
content-addressed storage, a review-gated publish pipeline, and discovery — both
searching what the tenant has and finding useful things it doesn't.

This is the largest of the four modules and the one the other three depend on for
data. Build it in the slice order below; each slice ends green.

**Prerequisite:** guide 00 landed. Contracts are frozen — import from
`@arm/proto`/`@arm/db`, never edit them.

**You own:** `packages/artifactory/**`, `packages/discovery/**`,
`packages/catalog/**`, `packages/profiles/**`, `packages/trpc/src/library-router.ts`,
`apps/data-plane/artifact-cache/**`, guardrails `component-review.ts`,
`artifact-integrity.ts`, `blob-residency.ts`.

---

## 1. Mental model

Three layers, cleanly separated:

```
component            what a thing IS      (identity, kind, owner, review status)
component_version    what a thing HAS     (immutable manifest + optional blob digest)
component_blob       what a thing WEIGHS  (content-addressed bytes in a backend)
```

A **Work Package** (existing D9 entity, `packages/catalog`) is a pinned set of
component versions plus routing/budget/permissions. The artifactory does not know
about packages; packages reference the artifactory. Dependency direction is
`artifactory → catalog`, never the reverse — the `boundaries` guard enforces it.

**Immutability rule.** A published `component_version` row is never updated. The
only mutable field is `yanked`. Corrections ship as a new version. Every write path
must uphold this; add a DB-level trigger comment and a unit test that attempts an
update and expects a thrown error.

**Residency rule (Invariant 1).** Tenant-authored component blobs — a skill someone
wrote containing internal process knowledge — are content. They live in the tenant's
storage backend (`residency = 'tenant'`). Only `source_kind = 'first_party'`
artifacts may live control-plane-side. The `blob-residency` guard is the executable
form of this; write its mutation proof.

---

## 2. Slice A — `packages/artifactory`

New package, deps: `@arm/proto`, `@arm/config`, `@arm/db`. Pure logic plus storage
adapters; no tRPC, no React.

```
packages/artifactory/src/
  index.ts
  digest.ts            sha256 helpers, "sha256:<hex>" formatting + parsing
  manifest.ts          component manifest canonicalization + hashing
  publish.ts           validate → hash → store blob → insert version (transactional)
  resolve.ts           slug@range → concrete component_version (semver resolution)
  storage/
    backend.ts         StorageBackend interface
    fs.ts              filesystem backend (dev + self-hosted default)
    s3.ts              S3-compatible backend (SaaS)
    oci.ts             stub, throws NotImplemented — do not build
  cache.ts             pull-through cache policy (digest-keyed, immutable, no TTL)
  fixtures.ts          seed components for tests + demo
```

### 2.1 `StorageBackend`

```ts
export interface StorageBackend {
  readonly kind: "fs" | "s3" | "oci";
  put(digest: string, body: Uint8Array, mediaType: string): Promise<void>;
  get(digest: string): Promise<Uint8Array>;
  head(digest: string): Promise<{ size: number; mediaType: string } | null>;
  presignGet(digest: string, ttlSeconds: number): Promise<string>;
}
```

- `put` is **idempotent and verifying**: recompute sha256 of `body`; if it does not
  match `digest`, throw. If the digest already exists with the same size, no-op.
- `presignGet` on the fs backend returns a signed local URL served by the data-plane
  artifact cache (§5), not a file path.
- No backend ever deletes. Yanking is metadata.

### 2.2 Publish pipeline (`publish.ts`)

```
publishComponentVersion(input) →
  1. zod-validate the manifest against componentVersionSchema
  2. reject if component.review_status !== "approved"        (component-review guard)
  3. reject if version already exists                        (immutability)
  4. reject if semver is not strictly greater than the latest non-yanked version
  5. if a blob is supplied: compute digest, assert declared === computed,
     pick backend by residency, put(), upsert component_blob
  6. compute manifest_sha256 over the canonical manifest
  7. insert component_version in ONE transaction with the blob row
  8. return { componentId, version, manifestSha256, blobDigest }
```

Fail loud at every step — never store a dangling reference (the M5 rule already
stated in `packages/catalog/src/provision.ts`).

### 2.3 Resolution (`resolve.ts`)

`resolve(slug, range)` → highest non-yanked version satisfying the semver range,
scoped to the tenant, with first-party fallback when the tenant has no own copy.
Pure function over a supplied version list so it is unit-testable without a DB.

---

## 3. Slice B — job-function taxonomy

`docs/research/oem-job-taxonomy.md` holds ~250 job types across 20 functions as
prose. Convert it to data.

1. Add `JobFunctionSeed` to `packages/profiles/src/types.ts`:
   `{ key, name, functionFamily, aliases[], headcountWeight }`.
2. Add a `jobFunctions: JobFunctionSeed[]` field to the profile bundle and populate
   it in `manufacturing.profile.ts` (full taxonomy) and `tech.profile.ts` (a
   software-org taxonomy of ~60 roles). `finance` and `holding` get a minimal set.
3. Keys are stable snake_case slugs (`quality_engineer`, `maintenance_technician`).
   `aliases` carry the synonyms an employee might pick in the questionnaire
   ("PQE", "product quality engineer") — the `client` module maps free choices onto
   these, so aliases matter.
4. Keep `packages/profiles` a **leaf package, pure data, JSON-serializable** — the
   `no-profile-branching` guard already enforces no behaviour there.
5. Map the 10 pilot packages (roadmap §6) to job functions via
   `work_package_job_function`.

Deliverable check: `pnpm --filter @arm/profiles test` asserts every seeded package's
`job_functions` resolve to seeded job-function keys, and every job-function key is
unique per profile.

---

## 4. Slice C — manifest v2 in `packages/catalog`

The contracts agent froze the eight-field list (guide 00 §4) and committed
`packages/proto/test/fixtures/manifest-v2-golden.json`.

1. Rewrite `packages/catalog/src/manifest.ts`: `canonicalManifest` emits exactly the
   eight fields, arrays sorted as specified, `manifest_version: 2` first. Delete the
   v1 field-list comment and replace it with the v2 one (the file's own rule: any
   change to the field list is a wire break and must update the client + golden
   vector in the same PR — you are doing exactly that).
2. Delete `packages/catalog/src/types.ts` structural mirrors; import the inferred
   types from `@arm/proto` now that it exports them.
3. `validatePackageVersion` now asserts: every `components[]` entry resolves to an
   existing, approved, non-yanked `component_version`; a package must ship at least
   one component; `job_functions[]` are all seeded keys.
4. `buildPackageVersionFromSeed` resolves seed slugs through the artifactory
   (`resolve()`), not a `toolIdsBySlug` map. Unmapped slug = hard error, unchanged.
5. Regenerate the golden vector test in `packages/catalog/test/canonical-golden.test.ts`
   to read the shared fixture from `@arm/proto`.

**Coordination note.** `packages/client-core` also implements
`buildCanonicalManifest` and is owned by the `client` agent. Both read the same
committed golden fixture, so the two implementations converge without either agent
touching the other's file. If your canonicalizer disagrees with the fixture, the
fixture wins.

---

## 5. Slice D — `apps/data-plane/artifact-cache`

A small Node service in the tenant VPC. Responsibilities:

- `GET /artifacts/:digest` — serve a blob. Check local cache → tenant backend →
  (for first-party only) upstream control-plane CDN. Verify sha256 on every fill
  before caching. Never re-sign, never rewrite.
- `HEAD /artifacts/:digest` — size + media type.
- Emit `component_pull_event` (metadata only) per served request.
- Digest-keyed cache with **no TTL** — content-addressed artifacts are immutable, so
  a cache entry can never go stale. Evict by LRU on a size cap.

Imports `@arm/proto` and `@arm/config` **only** (data-plane boundary rule). It must
not import `@arm/artifactory` — copy the ~30 lines of digest verification rather
than crossing the boundary, and note why in a comment.

---

## 6. Slice E — `packages/discovery`

Deps: `@arm/proto`, `@arm/config`, `@arm/db`, `@arm/artifactory`.

### 6.1 Internal discovery (build first)

```
packages/discovery/src/
  index.ts
  search.ts      Postgres FTS + pg_trgm query builder over component + work_package
  facets.ts      counts by kind, job function, data classification, mode, source
  recommend.ts   pure ranking helpers (see below)
  gaps.ts        questionnaire responses whose job function has no published package
```

- **Search infra: Postgres only.** Add a generated `tsvector` column + GIN index on
  `component(name, slug, description)` and `work_package(name, description)`, plus a
  `pg_trgm` index for fuzzy slug matching. Do not add a search service.
- **Ranking** (`recommend.ts`) is a pure function over rows so it is unit-testable:
  score = job-function match (weight 3) + same-department install count (weight 2) +
  review status `approved` (required) + recency tiebreak. Deterministic ordering,
  ties broken by slug ascending. No LLM anywhere on this path.
- **Gaps** is the product-critical output: job functions with headcount weight but
  zero published packages, ranked by weight. It feeds `/adoption` and the roadmap.

### 6.2 External discovery (build second)

```
  sources/
    types.ts        DiscoverySource adapter interface
    mcp-registry.ts public MCP registry adapter
    git.ts          internal git org scanner (repo topic / manifest file convention)
    http-index.ts   generic JSON index adapter
  sync.ts           poll a source → upsert discovery_candidate rows
  promote.ts        candidate → component (draft) with provenance recorded
```

Non-negotiable rules, each with a test:

1. A synced candidate lands as `discovery_candidate`, **never** as a component.
2. `promote()` creates the component with `review_status = 'draft'` and
   `source_kind = 'imported'`, recording `source_ref`. Publishing still requires the
   normal approval path — `component-review` blocks any package from pinning it.
3. Every imported version pins an exact upstream version + digest. Never a tag,
   branch, or `latest`.
4. Sync never executes fetched code and never follows redirects off the source host.
5. Adapters run on a worker schedule, not in a request path.

---

## 7. Slice F — `packages/trpc/src/library-router.ts`

Replace the guide-00 placeholder. All procedures are `tenantProcedure`.

| Procedure | Shape |
|---|---|
| `search` | `{ q?, kinds?, jobFunction?, classification?, mode?, cursor?, limit }` → `{ items, facets, nextCursor }` |
| `facets` | `{ q? }` → counts per dimension |
| `getComponent` | `{ slug }` → component + versions + job functions + install count |
| `listVersions` | `{ componentId }` → versions, newest first, `yanked` flagged |
| `publishVersion` | mutation, requires `tool:publish`; delegates to `@arm/artifactory` |
| `listJobFunctions` | `{ family? }` → taxonomy with package coverage counts |
| `recommendForJobFunction` | `{ key }` → ranked packages + components |
| `gaps` | → uncovered job functions ranked by headcount weight |
| `listSources` / `listCandidates` | discovery admin surfaces |
| `promoteCandidate` / `rejectCandidate` | mutations, require `tool:publish`, audited |

Every mutation emits an audit event and follows the high-stakes pattern (impact
preview data returned, never a silent write).

---

## 8. Guardrails you own

| Guard | Implementation sketch | Mutation proof |
|---|---|---|
| `component-review` | scan all `work_package_version.components[]` against component review status | flip one seeded component to `draft` → guard red → restore byte-identically |
| `artifact-integrity` | every version with a blob has a well-formed `sha256:` digest; scan manifests for `http(s)://` where a digest field belongs | replace a digest with a URL → red |
| `blob-residency` | no `tenant_authored` component has a `control_plane` blob | flip one seed → red |

All three fail loudly on empty input — a scan of zero components is red (§14.2).

---

## 9. Acceptance criteria

- [ ] `packages/artifactory` publishes, resolves, and serves versions with verified digests; immutability test passes (update attempt throws).
- [ ] Both storage backends pass the same contract test suite; `oci.ts` throws `NotImplemented`.
- [ ] Job-function taxonomy seeded for all four profiles; ~250 keys for manufacturing; all pilot packages mapped.
- [ ] Manifest v2 canonicalizer matches the committed golden vector byte-for-byte.
- [ ] `apps/data-plane/artifact-cache` serves + verifies + emits pull events, importing only `proto`/`config`.
- [ ] Internal search returns facetted results from Postgres FTS with no new infra; ranking is a pure, unit-tested function.
- [ ] MCP-registry adapter produces `discovery_candidate` rows only; promotion yields `draft` components; four rules in §6.2 each have a test.
- [ ] `library` router replaces the placeholder; `pnpm typecheck && pnpm test && pnpm guardrails` green.
- [ ] Three guardrails mutation-proofed.

## 10. Out of scope

OCI registry backend, cross-tenant artifact sharing, paid/licensed components,
signature verification beyond sha256 (sigstore is a later decision), semantic search
/ embeddings, and the UI — `/library` belongs to the `server` agent.

## 11. Docs to update

`docs/arm-spec.md` §4.1, §5.1, §15; `docs/CONCEPTS.md`; a new decision record
`docs/solutions/2026-08-21-d12-component-library-discovery.md` recording the
artifactory design, the residency rule, and the sub-decisions you had to make.
