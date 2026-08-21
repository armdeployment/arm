/**
 * @arm/catalog — D9 Work Package catalog core (spec §4.1 delta,
 * docs/solutions/2026-08-13-d9-work-packages.md).
 *
 * Pure, DB-free helpers for the Tool Registry + Work Package lifecycle:
 * content-addressed manifest hashing, canonical manifests, version validation
 * against registry tool versions, assignment state transitions and org-node
 * resolution, and seed → package-version provisioning. Re-exports the
 * catalog proto schemas from @arm/proto as the wire contracts.
 */

export { manifestSha256 } from "./hash.js";
export { canonicalManifest, validatePackageVersion } from "./manifest.js";
export type {
  CamelToolRef,
  SnakeToolRef,
  ManifestToolRef,
  ManifestToolRefWire,
  PackageManifestInput,
  PackageManifest,
} from "./manifest.js";
export { transitionAssignment, resolveAssignmentForOrgNode } from "./assignment.js";
export type { AssignmentStatusPatch, AssignmentLike } from "./assignment.js";
export { buildPackageVersionFromSeed } from "./provision.js";
export type { PackageVersionInsert } from "./provision.js";
export { toolFixtures, toolIdFixtures, toolVersionFixtures, packageVersionFixtures } from "./fixtures.js";
export type {
  Tool,
  ToolVersion,
  WorkPackage,
  WorkPackageVersion,
  WorkPackageToolRefWire,
  PackageAssignment,
} from "./types.js";

export {
  toolSchema,
  toolVersionSchema,
  workPackageSchema,
  workPackageVersionSchema,
  packageAssignmentSchema,
  workPackageModeSchema,
  packageAssignmentStatusSchema,
  catalogSchemas,
} from "@arm/proto";
export type {
  ToolKind,
  ToolReviewStatus,
  WorkPackageMode,
  PackageAssignmentStatus,
} from "@arm/proto";
