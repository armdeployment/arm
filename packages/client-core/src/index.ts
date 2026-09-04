/**
 * @arm/client-core — shared ARM client engine (D9 Phase 1.6, updated D10 for
 * manifest v2 / components / the A4 token path).
 *
 * One engine, every shape (roadmap §5): the `arm` CLI and any future
 * platform installer run this code. Responsibilities: package manifest
 * fetch + integrity verification, component resolution/installation by
 * digest, opencode config rendering with env-var-only credentials,
 * connections-wizard guide content, the setup-token (A4) redemption path,
 * activation-event telemetry, and the full one-click `runSetup`
 * orchestration.
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
  resolvedComponentSchema,
  isCallableComponentKind,
  CALLABLE_COMPONENT_KINDS,
} from "./manifest.js";
export type {
  ClientPackageManifest,
  ResolvedComponent,
  WorkPackage,
  WorkPackageVersion,
  Component,
  ComponentVersion,
} from "./manifest.js";

export {
  pullComponentBlob,
  installComponent,
  installComponents,
  installDirFor,
} from "./components.js";
export type { InstalledComponent } from "./components.js";

export {
  renderOpencodeConfig,
  assertNoSecretsInConfig,
  componentToMcpEntry,
  mcpTokenEnvVar,
  DEFAULT_OPENCODE_HOME,
  resolveAgentHome,
} from "./opencode.js";
export type {
  RenderOpencodeConfigArgs,
  RenderedOpencodeConfig,
  McpRuntimeRequirement,
} from "./opencode.js";

export { GUIDE_LIBRARY, getConnectionGuide, renderGuideSteps } from "./connections.js";
export type { ConnectionMethod, ConnectionGuide, ConnectionsManifestEntry } from "./connections.js";

export {
  readInstalledState,
  writeInstalledState,
  installedStatePath,
  mergeInstalled,
} from "./installed-state.js";
export type { InstalledComponentRecord, InstalledState } from "./installed-state.js";
export { runUpdate, checkIn } from "./update.js";
export type { UpdateArgs, UpdateResult } from "./update.js";
export { runSetup, verifyMeteredRoundTrip, collectConnectionsNeeded, budgetHint } from "./setup.js";
export type { SetupArgs, SetupResult } from "./setup.js";

export { resolveFromSetupToken, setupRedemptionResponseSchema } from "./setup-token.js";
export type { SetupRedemptionResponse } from "./setup-token.js";

export { ArmClientError, ARM_ERROR_CODES, ARM_ERROR_FIXES, fixFor } from "./errors.js";
export type { ArmErrorCode } from "./errors.js";

export { buildActivationEvent, emitActivationEvent, trackActivation } from "./activation.js";
export type { ActivationEventInput } from "./activation.js";

export { scanWorkFolder, scanWorkFolders } from "./folder-scan.js";
export type { FolderScanOptions, FolderScanResult } from "./folder-scan.js";

export { scanInstalledTools } from "./plugin-scan.js";
export type { DetectedTool, PathExistsFn } from "./plugin-scan.js";

export { classifyPainPoints } from "./pain-points.js";
export type { PainPointTag } from "./pain-points.js";

export {
  detectRuntime,
  provisionRuntime,
  resolveProvisionTarget,
  parseExpectedChecksum,
  bundledRuntimeBinDir,
} from "./runtime-provision.js";
export type {
  RuntimeKind,
  RuntimeProbe,
  ProvisionTarget,
  ProvisionIO,
  ExecFileFn,
} from "./runtime-provision.js";

export { startInstallWizardServer, openInBrowser, DEFAULT_ARM_PROXY_URL } from "./gui-server.js";
export type { GuiServerOptions, GuiServerDeps, GuiServerHandle } from "./gui-server.js";

export { sendChatMessage, INSTALL_ASSISTANT_SYSTEM_PROMPT } from "./llm-chat.js";
export type { ChatMessage, ChatRole, ChatTurnArgs } from "./llm-chat.js";
