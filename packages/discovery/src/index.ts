/**
 * `@arm/discovery` — searching what the tenant has and finding useful things
 * it doesn't (docs/guides/01-library-artifactory.md §6).
 *
 * Internal discovery (search/facets/recommend/gaps) over `component` +
 * `work_package`, and external discovery (source adapters → sync →
 * candidate → promote). Deps: `@arm/proto`, `@arm/config`, `@arm/db`,
 * `@arm/artifactory`.
 */

export {
  buildComponentSearchSql,
  buildWorkPackageSearchSql,
  searchInMemory,
  DEFAULT_SEARCH_LIMIT,
  type SearchInput,
  type BuiltQuery,
  type SearchableComponentRow,
  type SearchableWorkPackageRow,
  type SearchResultItem,
  type SearchResult,
} from "./search.js";

export { computeFacets, type Facets } from "./facets.js";

export {
  recommendForJobFunction,
  type RecommendCandidate,
  type RecommendInput,
  type RankedCandidate,
} from "./recommend.js";

export {
  computeGaps,
  type JobFunctionCoverage,
  type PackageJobFunctionRow,
  type CoverageGap,
} from "./gaps.js";

export type {
  DiscoveredCandidate,
  DiscoverySourceAdapter,
  DiscoverySourceRef,
} from "./sources/types.js";
export { fetchJsonSameOrigin } from "./sources/types.js";
export { mcpRegistryAdapter } from "./sources/mcp-registry.js";
export { gitOrgScannerAdapter } from "./sources/git.js";
export { httpIndexAdapter } from "./sources/http-index.js";

export {
  syncSource,
  type ExistingCandidateRow,
  type DiscoveryCandidateUpsert,
  type SyncResult,
} from "./sync.js";

export {
  promoteCandidate,
  pinImportedVersion,
  assertExactUpstreamPin,
  type PromoteCandidateInput,
  type PromotedComponent,
  type PinImportedVersionInput,
  type PinnedImportedVersion,
} from "./promote.js";
