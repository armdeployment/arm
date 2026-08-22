/**
 * Guardrail entry point. Importing this module registers all checks.
 * The runner (run.ts) reads the populated REGISTRY.
 */

import "./checks/tenant-isolation.js";
import "./checks/no-content-egress.js";
import "./checks/no-secret-dumps.js";
import "./checks/boundaries.js";
import "./checks/safe-render.js";
import "./checks/ci-sync.js";
import "./checks/no-profile-branching.js";
import "./checks/taxonomy-scope.js";
import "./checks/work-type-unknown.js";
import "./checks/package-integrity.js";
import "./checks/package-least-privilege.js";
import "./checks/tool-endpoint-scope.js";
import "./checks/package-drift.js";
import "./checks/component-review.js";
import "./checks/artifact-integrity.js";
import "./checks/blob-residency.js";
import "./checks/questionnaire-determinism.js";
import "./checks/no-content-in-activation.js";

export * from "./types.js";
export { checkTenantIsolation, shapeOf } from "./checks/tenant-isolation.js";
export { checkNoContentEgress, parseColumns } from "./checks/no-content-egress.js";
export { checkNoSecretDumps } from "./checks/no-secret-dumps.js";
export { checkBoundaries } from "./checks/boundaries.js";
export { checkSafeRender } from "./checks/safe-render.js";
export { checkCISync, parseTableWorkflows } from "./checks/ci-sync.js";
export { checkNoProfileBranching } from "./checks/no-profile-branching.js";
export { checkTaxonomyScope, type TaxonomyRow } from "./checks/taxonomy-scope.js";
export {
  checkWorkTypeUnknown,
  UNKNOWN_THRESHOLD_PCT,
  type ClassificationStats,
} from "./checks/work-type-unknown.js";
export {
  checkPackageIntegrity,
  verifyFixtureIntegrity,
  canonicalize,
  sha256Canonical,
  type VersionedManifest,
  type CatalogVersionFixture,
  type CatalogFixtureToolRef,
  type ManifestHashTools,
} from "./checks/package-integrity.js";
export { checkLeastPrivilege } from "./checks/package-least-privilege.js";
export {
  checkToolEndpoints,
  verifyToolEndpoints,
  type ToolEndpointRecord,
  type ToolEndpointWireFixture,
} from "./checks/tool-endpoint-scope.js";
export {
  checkPackageDrift,
  DEFAULT_MAX_LAG,
  type InstalledPackageVersion,
} from "./checks/package-drift.js";
export { checkComponentReview, type ComponentRefWithStatus } from "./checks/component-review.js";
export {
  checkArtifactIntegrity,
  type ComponentVersionBlobRef,
} from "./checks/artifact-integrity.js";
export { checkBlobResidency, type BlobResidencyRow } from "./checks/blob-residency.js";
export {
  checkQuestionnaireDeterminism,
  type DeterminismViolation,
} from "./checks/questionnaire-determinism.js";
export {
  checkNoContentInActivation,
  type ActivationContentCheckInput,
} from "./checks/no-content-in-activation.js";
