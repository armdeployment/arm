/**
 * `@arm/artifactory` — the D10 component repository (docs/guides/01-library-artifactory.md).
 *
 * Immutable, content-addressed artifact storage: components (identity),
 * component versions (immutable manifest + optional blob digest), and
 * component blobs (content-addressed bytes in a pluggable backend). Pure
 * logic plus storage adapters — no tRPC, no React (guide 01 §2).
 *
 * `packages/artifactory` deps: `@arm/proto`, `@arm/config`, `@arm/db` only.
 * `packages/catalog` may import this package (D10 boundary exception,
 * `scripts/guardrails/src/checks/boundaries.ts`); this package must never
 * import `@arm/catalog` back.
 */

export { DIGEST_RE, sha256Hex, formatDigest, digestOf, isValidDigest, parseDigest, assertDigestMatches } from "./digest.js";

export { canonicalizeComponentManifest, componentManifestSha256 } from "./manifest.js";

export {
  publishComponentVersion,
  type ComponentRow,
  type ComponentRepoPort,
  type PublishBlobInput,
  type PublishComponentVersionInput,
  type PublishResult,
  type BackendsByResidency,
} from "./publish.js";

export {
  resolve,
  compareSemVer,
  satisfiesRange,
  type ResolvableComponentVersion,
  type ResolveResult,
  type ResolveOptions,
} from "./resolve.js";

export type { StorageBackend } from "./storage/backend.js";
export { NotImplementedError } from "./storage/backend.js";
export { FsStorageBackend, DEV_PLACEHOLDER_SIGNING_KEY, type FsBackendOptions } from "./storage/fs.js";
export {
  S3StorageBackend,
  type S3BackendOptions,
  type S3RequestSigner,
  type S3SignedRequest,
} from "./storage/s3.js";
export { OciStorageBackend } from "./storage/oci.js";

export { DigestCache, type DigestCacheEntry, type DigestCacheOptions, type DigestFetcher } from "./cache.js";

export {
  FIXTURE_TENANT_ID,
  componentFixtures,
  componentVersionFixtures,
  componentBlobFixtures,
  fixtureResolvableVersions,
  componentFixturesBySlug,
} from "./fixtures.js";
