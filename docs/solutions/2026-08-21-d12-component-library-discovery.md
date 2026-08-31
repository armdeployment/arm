---
title: "D12: Component Library (Artifactory) + Discovery — implementation record"
date: 2026-08-21
status: decided
supersedes: none
---

# D12 — Component Library (Artifactory) + Discovery

Implementation record for `docs/guides/01-library-artifactory.md`, built by the
`library` Wave-1 sub-agent against the frozen D10 contracts landed in
`docs/guides/00-shared-contracts.md`. This is the largest of the four Wave-1
modules — the artifact repository the other three depend on for data.

## 1. What shipped

| Package/app                                                                             | Role                                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/artifactory`                                                                  | Component Registry core: digest helpers, component-manifest canonicalization/hashing, publish pipeline, `slug@range` resolution, three storage backends (fs/s3/oci-stub), a pull-through cache policy, and the seed component fixtures (78 components: 40 callable from the Aug 2026 automotive OEM toolchain survey + 38 installable skill/subagent/template components, 80 versions, 2 real blobs). |
| `packages/discovery`                                                                    | Internal search/facets/recommend/gaps over `component` + `work_package`; external discovery adapters (MCP registry, git-org scanner, generic JSON index) → `sync` → `promote`.                                                                                                                                                                                                                        |
| `packages/profiles`                                                                     | D10 job-function taxonomy: `JobFunctionSeed`, 263 manufacturing keys (mechanically derived from `docs/research/oem-job-taxonomy.md`), 65 tech keys, minimal finance/holding sets; wired onto all 31 seeded work packages.                                                                                                                                                                             |
| `packages/catalog`                                                                      | Rewired to manifest v2: `canonicalManifest`/`validatePackageVersion` now operate on `components[]`/`job_functions[]`; `buildPackageVersionFromSeed` resolves seed component refs through `@arm/artifactory`'s `resolve()` instead of a bare slug→id map; the 6 pilot package fixtures now reference real, artifactory-resolved components.                                                            |
| `packages/trpc/src/library-router.ts`                                                   | All 13 frozen procedures implemented against the above, in-memory (fixture-mode, matching the rest of this scaffold — no live DB exists anywhere in the repo yet).                                                                                                                                                                                                                                    |
| `apps/data-plane/artifact-cache`                                                        | Hono service: `GET`/`HEAD /artifacts/:digest`, local→tenant-backend→control-plane-CDN fetch order, sha256 verification on every fill, `component_pull_event` emission, digest-keyed no-TTL LRU cache.                                                                                                                                                                                                 |
| `scripts/guardrails/src/checks/{component-review,artifact-integrity,blob-residency}.ts` | Registered checks now scan the real fixtures above instead of reporting an honest vacuous failure. All three mutation-proofed manually (break → red → restore byte-identical), in addition to the pure-function mutation proofs already shipped by `contracts` in Wave 0.                                                                                                                             |

## 2. Architecture

Three layers, matching guide 01 §1 exactly:

```
component            identity, kind, owner, review status
component_version    immutable manifest + optional blob digest
component_blob       content-addressed bytes in a pluggable backend
```

**Immutability.** `publishComponentVersion` (`packages/artifactory/src/publish.ts`)
rejects a version that already exists and rejects a version that isn't strictly
semver-greater than the latest non-yanked version. The only mutable field on a
published row is `yanked`. Corrections ship as a new version.

**Residency rule (Invariant 1).** Tenant-authored component blobs live at
`residency = 'tenant'`; only `source_kind = 'first_party'` artifacts may sit at
`residency = 'control_plane'`. The seed fixtures deliberately carry one blob of
each kind (a first-party `8d-generator` skill release, and a fictional
tenant-authored `internal-process-notes` prompt pack) so the `blob-residency`
guardrail has genuine substrate, not just an empty-passes-vacuously set.

## 3. Sub-decisions made

None of these were spec-frozen by guide 00 or guide 01 at the implementation-detail
level; each is a local, reversible choice made to fill in the guide's design intent.

1. **`resolve()` range grammar.** No semver dependency exists in this repo and the
   guide's own seed convention already treats a pinned version as exact
   (`WorkPackageComponentSeedInput.componentVersion`, `packages/db/src/schema/catalog.ts`).
   `resolve(slug, range, versions, { tenantId })` (`packages/artifactory/src/resolve.ts`)
   therefore treats a bare `"1.2.3"` as an EXACT match, and additionally supports
   `^`/`~`/`>=`/`<=`/`>`/`<`/`*` for future non-pinned resolution paths (e.g. a
   future `requires` dependency range). A small local comparator replaces an
   npm-style semver library.

2. **No live DB anywhere in this repo (confirmed before building).** Every
   existing router/package in the 1.0/D10 scaffold operates on injected or
   fixture data (`packages/trpc/src/index.ts`'s own header: "FIXTURE DATA...
   TODO(1.1): replace with real Postgres/ClickHouse queries"). `publishComponentVersion`
   and `syncSource`/`promoteCandidate` are therefore written against small
   injectable ports (`ComponentRepoPort`, adapter `fetchImpl`) rather than a
   Drizzle client, so they are fully unit-testable today and swap to a real DB
   with no change to orchestration logic. `packages/discovery/src/search.ts`
   ships BOTH a real Postgres FTS/`pg_trgm` query-builder (for when a DB
   lands) and a pure in-memory reference implementation the router actually
   calls today — the two are proven to agree by shared assertions in tests.

3. **S3 backend without an AWS SDK dependency.** `packages/artifactory`'s
   declared deps are fixed (`@arm/proto`/`@arm/config`/`@arm/db` — guide 01 §2).
   `storage/s3.ts` talks to any S3-compatible endpoint over the global `fetch`
   and defers request SIGNING to an injected `S3RequestSigner` port — this
   package never sees a raw credential (Invariant 4).

4. **fs backend presigned URLs.** `presignGet` on the fs backend returns an
   HMAC-signed local URL served by the artifact-cache app (per guide 01 §2.1),
   not a file path. The signing key is constructor-injected with an
   explicitly-labeled DEV-ONLY placeholder default — never a hardcoded
   production secret.

5. **Tool/skill/subagent/template → one `components[]` array.** The pre-D10
   catalog fixtures carried `tools`/`skills`/`subagentConfigs`/`templateRefs`
   as four separate lists (the last three were bare strings, not registry
   entities). D10's A3 ("no parallel skill/plugin tables") means every one of
   those strings had to become a real `kind: skill|subagent|template`
   component. 38 such components were minted (`packages/artifactory/src/fixtures.ts`)
   and the 6 pilot `packages/catalog` seeds now reference them as ordinary
   `ComponentRef`s.

6. **Job-function taxonomy generation.** The manufacturing taxonomy (263 keys)
   was mechanically converted from `docs/research/oem-job-taxonomy.md` §3 (20
   function families, "·"-separated job titles) — key = slugified title,
   aliases = parenthetical abbreviations + slash-alternate titles, weight =
   a keyword heuristic (operator/technician highest, leadership lowest). Two
   cross-cutting roles (`general_office_staff`, `executive_assistant`) were
   hand-added since no OEM engineering sweep covers them, but the existing
   pilot packages need them. The tech taxonomy (65 keys) is hand-authored —
   there's no equivalent research sweep for software orgs. Finance/holding
   get small hand-authored sets per the guide's "minimal set" instruction.

7. **Derived (not fabricated) signals in `library-router.ts`.** No
   `component_job_function` junction-table fixture exists yet (nobody has
   seeded one), so a component's job functions are derived as the union of
   `job_functions` across every pilot package version that pins it — a real
   relationship computed from shipped data, not an invented number.
   `installCount` similarly counts real package-fixture references. Where no
   real signal exists at all (per-department install counts for `recommend.ts`),
   the router passes an honest empty `{}` rather than fabricating one.

## 4. Known gaps / flagged blockers

1. **Postgres FTS DDL cannot land from this module.** Guide 01 §6.1 asks for a
   generated `tsvector` column + GIN index on `component(name, slug, description)`
   / `work_package(name, description)`, plus a `pg_trgm` index on `slug`. That
   DDL belongs in `packages/db/src/schema/artifactory.ts` / `catalog.ts`, both
   FROZEN (Wave 0 `contracts` ownership per `docs/guides/README.md`'s file-
   ownership table). `packages/discovery/src/search.ts`'s `buildComponentSearchSql`/
   `buildWorkPackageSearchSql` are written assuming a `search_vector` column of
   that shape and are unit-tested for correct SQL text, but cannot run against
   a real Postgres until `contracts` (or a follow-up migration) lands the
   columns/indexes. This does not block anything in this repo today — there is
   no live DB anywhere yet — but it is a real dependency for 1.1.

2. **One out-of-scope test now reads stale.** `packages/trpc/test/catalog-router.test.ts`
   (not owned by `library` per the file-ownership table) has a test named
   `"getPackage reports integrity_ok false for fixture versions (EXPECTED, D10
mechanical update)"` — its own header comments explicitly predict this: once
   `library` migrates `@arm/catalog`'s fixtures + canonicalizer to manifest v2
   (this PR), `integrity_ok` correctly flips to `true`, and that one hardcoded
   `.toBe(false)` assertion needs a one-line update to `.toBe(true)`. This is
   the intended, predicted outcome of doing this migration correctly, not a
   regression — flagged here rather than silently worked around, since editing
   that file is outside this module's ownership.

## 5. Out of scope (per guide 01 §10, unchanged)

OCI registry backend, cross-tenant artifact sharing, paid/licensed components,
signature verification beyond sha256, semantic search/embeddings, and the
`/library` UI (owned by `server`).
