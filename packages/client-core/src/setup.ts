/**
 * One-command employee provisioning (D9 Phase 1.6, updated D10 for manifest
 * v2 / A4 token path, roadmap §5.1, docs/guides/03-client-downloader.md §5).
 *
 * `runSetup` is the shared engine behind `arm setup` (CLI): fetch (or accept
 * a pre-resolved) package manifest → verify content integrity (fail loud on
 * tamper) → render the opencode config → write it → install non-callable
 * components by verified digest → verify a metered round-trip against the
 * ARM proxy → return a human- and machine-readable result. A network health
 * failure is never fatal: the result carries `online: false` with a
 * plain-language message.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  fetchManifest,
  verifyManifestIntegrity,
  buildCanonicalManifest,
  type ClientPackageManifest,
} from "./manifest.js";
import { renderOpencodeConfig, assertNoSecretsInConfig, resolveAgentHome } from "./opencode.js";
import { installComponents } from "./components.js";
import { provisionRuntime } from "./runtime-provision.js";
import { ArmClientError } from "./errors.js";
import type { ConnectionsManifestEntry, ConnectionMethod } from "./connections.js";

/** Inputs for a full setup run. */
export interface SetupArgs {
  controlPlaneUrl: string;
  token: string;
  roleKey: string;
  armProxyUrl: string;
  subAccountId: string;
  tenantId: string;
  /**
   * Short-lived metered token minted by the control plane (Invariant 4).
   * NEVER written into the config JSON — when provided it is written to the
   * companion `<agentHome>/.arm-env` file (mode 0o600) as
   * `ARM_AGENT_TOKEN=<token>`, which the runtime sources at agent start.
   */
  agentToken?: string;
  agentHome?: string;
  /**
   * Data-plane artifact cache base URL. Required only to install
   * *installable* components (skill/subagent/template/…) by digest — when
   * absent, callable components (which need no on-disk install) still work,
   * but installable ones are skipped (no `installedPaths`).
   */
  dataPlaneUrl?: string;
  /**
   * Pre-resolved + integrity-verified manifest — set by
   * `resolveFromSetupToken` (the A4 token path, setup-token.ts). When
   * present, `runSetup` skips `fetchManifest`/`verifyManifestIntegrity` and
   * uses this directly; every other step (render, write, install, health
   * check, activation events) is unchanged. The `--role`/flags path leaves
   * this unset and `runSetup` fetches by `roleKey` as before.
   */
  manifest?: ClientPackageManifest;
  /**
   * A6: true when the recommended package requires manager approval and
   * hasn't been approved yet. Passed straight through to `SetupResult` so
   * the CLI can print "your agent is installed; tool access is waiting on
   * your manager" — install never blocks on approval.
   */
  pendingApproval?: boolean;
}

/** Result of a setup run — safe to print directly in a terminal. */
export interface SetupResult {
  online: boolean;
  healthMessage: string;
  roleKey: string;
  packageVersion: string;
  /** Names of every component in the resolved manifest (callable + installable). */
  components: string[];
  /** Absolute paths of installable components actually written to disk. */
  installedPaths: string[];
  connectionsNeeded: ConnectionsManifestEntry[];
  configPath: string;
  /** Path of the companion env file; present only when an agentToken was provided. */
  envFilePath?: string;
  budgetHint: string;
  /** Runtime kinds ("python"/"node") auto-downloaded because no usable copy
   *  was already on this machine — empty when every `cli` component's
   *  declared runtime was already present, or none declared one. */
  runtimesProvisioned: string[];
  /** A6 — true when tool access is pending manager approval. */
  pendingApproval: boolean;
}

/**
 * Verify the metered round-trip: GET `${armProxyUrl}/health`.
 *
 * With an agent token, the call is authenticated (`Authorization: Bearer
 * <agentToken>`) and the metered path is exercised end-to-end. Without a
 * token the health check degrades to an unauthenticated GET: reachability is
 * established but metering is not proven, so the result reports
 * `online: false` with "agent token required for metered call" — the proxy
 * may be up, but nothing metered was verified. Never throws — network
 * failure yields `online: false` with a plain-language message.
 */
export async function verifyMeteredRoundTrip(
  armProxyUrl: string,
  agentToken?: string,
): Promise<{ online: boolean; message: string }> {
  const healthUrl = `${armProxyUrl.replace(/\/+$/, "")}/health`;
  if (agentToken === undefined || agentToken === "") {
    try {
      const res = await fetch(healthUrl, { signal: AbortSignal.timeout(5_000) });
      if (res.ok) {
        return { online: false, message: "agent token required for metered call" };
      }
      return {
        online: false,
        message: `proxy health endpoint returned HTTP ${res.status} (no agent token — metered call not attempted)`,
      };
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      return { online: false, message: `proxy unreachable: ${detail}` };
    }
  }
  try {
    const res = await fetch(healthUrl, {
      headers: { Authorization: `Bearer ${agentToken}` },
      signal: AbortSignal.timeout(5_000),
    });
    if (res.ok) {
      return { online: true, message: `metered round-trip OK (HTTP ${res.status})` };
    }
    return { online: false, message: `proxy health endpoint returned HTTP ${res.status}` };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { online: false, message: `proxy unreachable: ${detail}` };
  }
}

/** Vendor → guide routing for the connections manifest. */
const VENDOR_GUIDE_HINTS: ReadonlyArray<{
  pattern: RegExp;
  guideId: string;
  defaultScopes: string[];
}> = [
  { pattern: /jira|atlassian/i, guideId: "jira-pat", defaultScopes: ["read:jira-work"] },
  { pattern: /github/i, guideId: "github-pat", defaultScopes: ["repo", "read:org"] },
  {
    pattern: /bigquery|gcp|google/i,
    guideId: "gcp-bigquery",
    defaultScopes: ["roles/bigquery.jobUser"],
  },
  { pattern: /aws|identity\s*center/i, guideId: "aws-ssso", defaultScopes: [] },
  {
    pattern: /sharepoint|microsoft|entra/i,
    guideId: "sharepoint-oauth",
    defaultScopes: ["Sites.Read.All", "Files.Read.All"],
  },
  { pattern: /gitlab/i, guideId: "gitlab-pat", defaultScopes: ["api", "read_repository"] },
  {
    pattern: /azure\s*devops|dev\.azure/i,
    guideId: "azure-devops-oauth",
    defaultScopes: [],
  },
  { pattern: /confluence/i, guideId: "confluence-oauth", defaultScopes: [] },
  { pattern: /jama/i, guideId: "jama-pat", defaultScopes: [] },
  { pattern: /polarion/i, guideId: "polarion-pat", defaultScopes: [] },
  { pattern: /codebeamer/i, guideId: "codebeamer-pat", defaultScopes: [] },
  { pattern: /valispace/i, guideId: "valispace-pat", defaultScopes: [] },
  {
    pattern: /teamcenter|active\s*workspace/i,
    guideId: "teamcenter-pat",
    defaultScopes: [],
  },
  { pattern: /windchill/i, guideId: "windchill-pat", defaultScopes: [] },
  { pattern: /net-?inspect/i, guideId: "net-inspect-pat", defaultScopes: [] },
  { pattern: /aqua(\s*pro)?/i, guideId: "aqua-pro-oauth", defaultScopes: [] },
  {
    pattern: /\bsap\b|btp/i,
    guideId: "sap-qm-service-account",
    defaultScopes: ["QM read"],
  },
  { pattern: /omniverse|nucleus/i, guideId: "omniverse-oauth", defaultScopes: [] },
  { pattern: /cplace/i, guideId: "cplace-oauth", defaultScopes: [] },
  {
    pattern: /doors|jazz|\belm\b|ibm/i,
    guideId: "doors-oauth",
    defaultScopes: [],
  },
];

/** Fallback guide ids by auth method (used when no vendor matches). */
function fallbackGuideId(authMethod: ConnectionMethod): string {
  return authMethod === "oauth" ? "vendor-oauth" : "vendor-pat";
}

/**
 * Build the connections manifest for this package: every component whose
 * auth_strategy is not null/"none" needs a connection. Guide id is picked
 * from vendor hints on the component name/endpoint; scopes come from the
 * package version's pinned component refs when present, else the guide's
 * defaults.
 */
export function collectConnectionsNeeded(
  manifest: ClientPackageManifest,
): ConnectionsManifestEntry[] {
  const scopesByComponentId = new Map(
    manifest.version.components.map((ref) => [ref.component_id, ref.scopes]),
  );

  return manifest.components
    .filter(
      ({ component }) => component.auth_strategy !== null && component.auth_strategy !== "none",
    )
    .map(({ component }) => {
      const authMethod = component.auth_strategy as ConnectionMethod;
      const hint = VENDOR_GUIDE_HINTS.find((candidate) =>
        candidate.pattern.test(`${component.name} ${component.endpoint ?? ""}`),
      );
      const pinnedScopes = scopesByComponentId.get(component.id) ?? [];
      return {
        componentId: component.id,
        componentName: component.name,
        authMethod,
        guideId: hint?.guideId ?? fallbackGuideId(authMethod),
        requiredScopes: pinnedScopes.length > 0 ? pinnedScopes : (hint?.defaultScopes ?? []),
      };
    });
}

/** Human-readable budget hint from the package's budget template. */
export function budgetHint(budgetTemplate: Record<string, unknown>): string {
  const cap = budgetTemplate["monthly_usd_cap"];
  if (typeof cap === "number") {
    return `$${cap.toLocaleString("en-US")}/month`;
  }
  return "no monthly cap in package template";
}

/**
 * Run the full one-click setup flow. Throws only for hard failures (bad
 * manifest, integrity mismatch, unwritable config — as `ArmClientError`s
 * carrying a stable code, errors.ts) — proxy health problems degrade to
 * `online: false` with a message instead.
 *
 * When `agentToken` is provided it is written to `<agentHome>/.arm-env`
 * (mode 0o600, Invariant 4: short-lived credentials, secrets never land in
 * config files) and never into the config JSON — the config references it as
 * `${ARM_AGENT_TOKEN}`.
 */
export async function runSetup(args: SetupArgs): Promise<SetupResult> {
  const manifest =
    args.manifest ?? (await fetchManifest(args.controlPlaneUrl, args.token, args.roleKey));

  if (!verifyManifestIntegrity(manifest.version)) {
    throw new ArmClientError(
      "MANIFEST_TAMPERED",
      `package manifest integrity check FAILED for "${args.roleKey}"@${manifest.version.version} — ` +
        "refusing to write config from a tampered manifest",
    );
  }
  // Touch the canonicalizer so a drift between it and the pinned hash is
  // exercised even when a caller supplies a pre-verified manifest (defense
  // in depth — verifyManifestIntegrity already calls it internally too).
  void buildCanonicalManifest(manifest.version);

  const agentHome = resolveAgentHome(args.agentHome);

  const rendered = renderOpencodeConfig({
    manifest,
    armProxyUrl: args.armProxyUrl,
    subAccountId: args.subAccountId,
    tenantId: args.tenantId,
    agentHome,
  });

  const runtimesProvisioned: string[] = [];
  if (rendered.runtimeRequirements.length > 0) {
    const resolvedPathByRuntime = new Map<string, string>();
    for (const requirement of rendered.runtimeRequirements) {
      if (!resolvedPathByRuntime.has(requirement.runtime)) {
        const result = await provisionRuntime(requirement.runtime, { agentHome });
        resolvedPathByRuntime.set(requirement.runtime, result.path);
        if (result.provisioned) runtimesProvisioned.push(requirement.runtime);
      }
    }
    const parsed = rendered.parsed as { mcp: Record<string, { command?: string }> };
    for (const requirement of rendered.runtimeRequirements) {
      const entry = parsed.mcp[requirement.mcpKey];
      if (entry) entry.command = resolvedPathByRuntime.get(requirement.runtime)!;
    }
    rendered.content = `${JSON.stringify(parsed, null, 2)}\n`;
  }

  assertNoSecretsInConfig(rendered.content);

  try {
    await mkdir(dirname(rendered.configPath), { recursive: true });
    await writeFile(rendered.configPath, rendered.content, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === "EACCES") {
      throw new ArmClientError(
        "DISK_PERMISSION",
        `could not write config to ${rendered.configPath}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    throw err;
  }

  let envFilePath: string | undefined;
  if (args.agentToken !== undefined) {
    envFilePath = `${agentHome}/.arm-env`;
    await mkdir(dirname(envFilePath), { recursive: true });
    await writeFile(envFilePath, `ARM_AGENT_TOKEN=${args.agentToken}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
  }

  let installedPaths: string[] = [];
  if (args.dataPlaneUrl !== undefined) {
    const installed = await installComponents(manifest.components, {
      dataPlaneUrl: args.dataPlaneUrl,
      agentHome,
    });
    installedPaths = installed
      .map((entry) => entry.installedPath)
      .filter((path): path is string => path !== null);
  }

  const health = await verifyMeteredRoundTrip(args.armProxyUrl, args.agentToken);

  return {
    online: health.online,
    healthMessage: health.message,
    roleKey: args.roleKey,
    packageVersion: manifest.version.version,
    components: manifest.components.map(({ component }) => component.name),
    installedPaths,
    connectionsNeeded: collectConnectionsNeeded(manifest),
    configPath: rendered.configPath,
    ...(envFilePath !== undefined ? { envFilePath } : {}),
    budgetHint: budgetHint(manifest.version.budget_template),
    pendingApproval: args.pendingApproval ?? false,
    runtimesProvisioned,
  };
}
