/**
 * @arm/client-core — shared ARM client engine (D9 Phase 1.6).
 *
 * One engine, three shapes (roadmap §5): the `arm` CLI, the ARM Desktop
 * wizard, and MDM packages all run this code. Responsibilities: package
 * manifest fetch + integrity verification, opencode config rendering with
 * env-var-only credentials, connections-wizard guide content, and the full
 * one-click `runSetup` orchestration.
 *
 * SECURITY (Invariants 4/5): rendered configs contain environment-variable
 * references only — never raw credentials (assertNoSecretsInConfig enforces).
 */

export { manifestSha256, canonicalize } from "./hash.js";

export {
  fetchManifest,
  verifyManifestIntegrity,
  buildCanonicalManifest,
  clientPackageManifestSchema,
} from "./manifest.js";
export type {
  ClientPackageManifest,
  WorkPackage,
  WorkPackageVersion,
  Tool,
  CanonicalPackageManifest,
  CanonicalToolRef,
} from "./manifest.js";

export {
  renderOpencodeConfig,
  assertNoSecretsInConfig,
  toolToMcpEntry,
  mcpTokenEnvVar,
  DEFAULT_OPENCODE_HOME,
} from "./opencode.js";
export type { RenderOpencodeConfigArgs, RenderedOpencodeConfig } from "./opencode.js";

export { GUIDE_LIBRARY, getConnectionGuide, renderGuideSteps } from "./connections.js";
export type { ConnectionMethod, ConnectionGuide, ConnectionsManifestEntry } from "./connections.js";

export {
  runSetup,
  verifyMeteredRoundTrip,
  collectConnectionsNeeded,
  budgetHint,
} from "./setup.js";
export type { SetupArgs, SetupResult } from "./setup.js";
