/**
 * One-command employee provisioning (D9 Phase 1.6, roadmap §5.1).
 *
 * `runSetup` is the shared engine behind `arm setup` (CLI) and the ARM
 * Desktop wizard: fetch the role's package manifest → verify content
 * integrity (fail loud on tamper) → render the opencode config → write it →
 * verify a metered round-trip against the ARM proxy → return a human- and
 * machine-readable result. A network health failure is never fatal: the
 * result carries `online: false` with a plain-language message.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fetchManifest, verifyManifestIntegrity, type ClientPackageManifest } from "./manifest.js";
import { renderOpencodeConfig, assertNoSecretsInConfig, DEFAULT_OPENCODE_HOME } from "./opencode.js";
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
}

/** Result of a setup run — safe to print directly in a terminal. */
export interface SetupResult {
  online: boolean;
  healthMessage: string;
  roleKey: string;
  packageVersion: string;
  tools: string[];
  skills: string[];
  connectionsNeeded: ConnectionsManifestEntry[];
  configPath: string;
  /** Path of the companion env file; present only when an agentToken was provided. */
  envFilePath?: string;
  budgetHint: string;
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
];

/** Fallback guide ids by auth method (used when no vendor matches). */
function fallbackGuideId(authMethod: ConnectionMethod): string {
  return authMethod === "oauth" ? "generic-oauth" : "generic-pat";
}

/**
 * Build the connections manifest for this package: every tool whose
 * auth_strategy is not "none" needs a connection. Guide id is picked from
 * vendor hints on the tool name/endpoint; scopes come from the package
 * version's pinned tool refs when present, else the guide's defaults.
 */
export function collectConnectionsNeeded(
  manifest: ClientPackageManifest,
): ConnectionsManifestEntry[] {
  const refsByToolId = new Map(manifest.version.tools.map((ref) => [ref.tool_id, ref.scopes]));

  return manifest.tools
    .filter((tool) => tool.auth_strategy !== "none")
    .map((tool) => {
      const authMethod = tool.auth_strategy as ConnectionMethod;
      const hint = VENDOR_GUIDE_HINTS.find((candidate) =>
        candidate.pattern.test(`${tool.name} ${tool.endpoint}`),
      );
      const pinnedScopes = refsByToolId.get(tool.id) ?? [];
      return {
        toolId: tool.id,
        toolName: tool.name,
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
 * manifest, integrity mismatch, unwritable config) — proxy health problems
 * degrade to `online: false` with a message instead.
 *
 * When `agentToken` is provided it is written to `<agentHome>/.arm-env`
 * (mode 0o600, Invariant 4: short-lived credentials, secrets never land in
 * config files) and never into the config JSON — the config references it as
 * `${ARM_AGENT_TOKEN}`.
 */
export async function runSetup(args: SetupArgs): Promise<SetupResult> {
  const manifest = await fetchManifest(args.controlPlaneUrl, args.token, args.roleKey);

  if (!verifyManifestIntegrity(manifest.version)) {
    throw new Error(
      `package manifest integrity check FAILED for "${args.roleKey}"@${manifest.version.version} — ` +
        "refusing to write config from a tampered manifest",
    );
  }

  const rendered = renderOpencodeConfig({
    manifest,
    armProxyUrl: args.armProxyUrl,
    subAccountId: args.subAccountId,
    tenantId: args.tenantId,
    ...(args.agentHome !== undefined ? { agentHome: args.agentHome } : {}),
  });
  assertNoSecretsInConfig(rendered.content);

  await mkdir(dirname(rendered.configPath), { recursive: true });
  await writeFile(rendered.configPath, rendered.content, "utf8");

  const agentHome = args.agentHome ?? DEFAULT_OPENCODE_HOME;
  let envFilePath: string | undefined;
  if (args.agentToken !== undefined) {
    envFilePath = `${agentHome}/.arm-env`;
    await mkdir(dirname(envFilePath), { recursive: true });
    await writeFile(envFilePath, `ARM_AGENT_TOKEN=${args.agentToken}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
  }

  const health = await verifyMeteredRoundTrip(args.armProxyUrl, args.agentToken);

  return {
    online: health.online,
    healthMessage: health.message,
    roleKey: args.roleKey,
    packageVersion: manifest.version.version,
    tools: manifest.tools.map((tool) => tool.name),
    skills: manifest.version.skills,
    connectionsNeeded: collectConnectionsNeeded(manifest),
    configPath: rendered.configPath,
    ...(envFilePath !== undefined ? { envFilePath } : {}),
    budgetHint: budgetHint(manifest.version.budget_template),
  };
}
