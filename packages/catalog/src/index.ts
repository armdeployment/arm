/**
 * @arm/catalog — D10 Work Package catalog core (spec §4.1 delta,
 * docs/solutions/2026-08-13-d9-work-packages.md, updated
 * docs/guides/01-library-artifactory.md §4).
 *
 * Pure, DB-free helpers for the Work Package lifecycle: content-addressed
 * manifest v2 hashing, canonical manifests, version validation against the
 * Component Registry + job-function taxonomy, assignment state transitions
 * and org-node resolution, and seed → package-version provisioning (which
 * resolves component refs through `@arm/artifactory`, the D10 exception to
 * the strict same-rank dependency rule — `catalog` may import `artifactory`,
 * never the reverse). Re-exports the catalog proto schemas from `@arm/proto`
 * as the wire contracts.
 *
 * The Tool/Component Registry itself (browsing, publishing, search) lives in
 * `@arm/artifactory`/`@arm/discovery` — not here (D10, A3: `tool`
 * generalizes to `component`, one registry entity).
 */

export { manifestSha256 } from "./hash.js";
export {
  canonicalManifest,
  validatePackageVersion,
  type CamelComponentRef,
  type SnakeComponentRef,
  type ManifestComponentRef,
  type ManifestComponentRefWire,
  type PackageManifestInput,
  type PackageManifestWireInput,
  type PackageManifestSource,
  type PackageManifest,
  type ComponentVersionLookup,
} from "./manifest.js";
export { transitionAssignment, resolveAssignmentForOrgNode } from "./assignment.js";
export type { AssignmentStatusPatch, AssignmentLike } from "./assignment.js";
export { buildPackageVersionFromSeed } from "./provision.js";
export type { PackageVersionInsert } from "./provision.js";
export { packageVersionFixtures } from "./fixtures.js";

export {
  componentSchema,
  componentVersionSchema,
  componentRefSchema,
  jobFunctionSchema,
  workPackageSchema,
  workPackageVersionSchema,
  packageAssignmentSchema,
  workPackageModeSchema,
  packageAssignmentStatusSchema,
  packageManifestV2Schema,
  catalogSchemas,
} from "@arm/proto";
export type {
  Component,
  ComponentVersion,
  ComponentRef,
  ComponentKind,
  ComponentReviewStatus,
  ComponentSourceKind,
  JobFunction,
  WorkPackage,
  WorkPackageVersion,
  WorkPackageMode,
  PackageAssignment,
  PackageAssignmentStatus,
  PackageManifestV2,
} from "@arm/proto";
