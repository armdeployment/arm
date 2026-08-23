/**
 * opencode runtime config rendering (D9 Phase 1.6, updated D10 for manifest
 * v2 components — reference runtime).
 *
 * Renders an opencode config.json from a verified package manifest. The ARM
 * proxy becomes the model backend; each *callable* component
 * (mcp/http_api/cli/connector — guide 00 §1) becomes an MCP entry.
 * Installable components (skill/subagent/template/prompt_pack/plugin) are
 * NOT rendered here — they are materialized to disk by components.ts.
 *
 * SECURITY (Invariants 4/5, roadmap §5.2): this module NEVER writes a real
 * credential into the file. The proxy credential is an environment-variable
 * reference (`${ARM_AGENT_TOKEN}`) resolved by the agent runtime from the
 * companion `<agentHome>/.arm-env` file (written 0o600 by `runSetup`, never
 * committed, never inlined). Component auth headers are environment-variable
 * references (`${ARM_MCP_<NAME>_TOKEN}`) resolved by the agent runtime from
 * the OS keychain / tenant-vault broker. The only literals in the file are
 * routing metadata (sub-account id, tenant id) — identifiers, not secrets.
 * `assertNoSecretsInConfig` enforces this contract on every rendered config.
 */

import type { ClientPackageManifest, ResolvedComponent } from "./manifest.js";
import { isCallableComponentKind } from "./manifest.js";

/** Arguments for rendering an opencode config. */
export interface RenderOpencodeConfigArgs {
  manifest: ClientPackageManifest;
  armProxyUrl: string;
  subAccountId: string;
  tenantId: string;
  /** Base directory for the opencode config (defaults to ~/.config/opencode). */
  agentHome?: string;
}

/** Render result: path on disk, serialized content, and parsed object. */
export interface RenderedOpencodeConfig {
  configPath: string;
  content: string;
  parsed: unknown;
}

/** Default opencode config directory when no agentHome is given. */
export const DEFAULT_OPENCODE_HOME = "~/.config/opencode";

/** Sanitize a component name into a safe config key / env-var token. */
function sanitizeComponentName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** The env var holding a component's MCP token — referenced, never inlined. */
export function mcpTokenEnvVar(componentName: string): string {
  return `ARM_MCP_${sanitizeComponentName(componentName).toUpperCase()}_TOKEN`;
}

/**
 * Map a resolved *callable* component to an opencode MCP entry.
 *
 * - `cli` components → opencode `stdio` entry. The command comes from
 *   `version.config_schema.command` (falls back to the component name). When
 *   the component authenticates (auth_strategy not null/"none"), an `env`
 *   block maps `ARM_MCP_<NAME>_TOKEN` to the env-var reference
 *   `${ARM_MCP_<NAME>_TOKEN}` — the runtime resolves it from the keychain /
 *   vault broker. No auth → no env block at all.
 * - `mcp` / `http_api` / `connector` components → `http` entry against the
 *   component endpoint. The Authorization header is an env-var reference
 *   only — raw credentials must never appear here.
 */
export function componentToMcpEntry(resolved: ResolvedComponent): Record<string, unknown> {
  const { component, version } = resolved;
  const hasAuth = component.auth_strategy !== null && component.auth_strategy !== "none";

  if (component.kind === "cli") {
    const configCommand = version.config_schema["command"];
    const command = typeof configCommand === "string" ? configCommand : component.name;
    const entry: Record<string, unknown> = { type: "stdio", command };
    if (hasAuth) {
      entry.env = { [mcpTokenEnvVar(component.name)]: `\${${mcpTokenEnvVar(component.name)}}` };
    }
    return entry;
  }

  return {
    type: "http",
    url: component.endpoint ?? "",
    headers: { Authorization: `\${${mcpTokenEnvVar(component.name)}}` },
  };
}

/**
 * Render the opencode config.json for a verified package manifest.
 *
 * `parsed` is the deserialized object for programmatic inspection; `content`
 * is the pretty-printed JSON written to `configPath`. `configPath` is
 * `<agentHome ?? ~/.config/opencode>/config.json` — creating the directory is
 * the caller's job (runSetup does it).
 */
export function renderOpencodeConfig(args: RenderOpencodeConfigArgs): RenderedOpencodeConfig {
  const { manifest, armProxyUrl, subAccountId, tenantId } = args;
  const agentHome = args.agentHome ?? DEFAULT_OPENCODE_HOME;

  const mcp: Record<string, unknown> = {};
  for (const resolved of manifest.components) {
    if (!isCallableComponentKind(resolved.component.kind)) continue; // installed to disk, not wired as MCP
    mcp[sanitizeComponentName(resolved.component.name)] = componentToMcpEntry(resolved);
  }

  const config = {
    $schema: "https://opencode.ai/config.json",
    base_url: armProxyUrl.replace(/\/+$/, ""),
    // Env-var reference to the short-lived metered token minted by the
    // control plane (Invariant 4). The literal token lives in
    // `<agentHome>/.arm-env` (0o600) — never inlined here.
    api_key: "${ARM_AGENT_TOKEN}",
    extra_headers: {
      "X-ARM-SubAccountId": subAccountId,
      // Routing metadata (Invariant 2) — an identifier, not a secret.
      "X-ARM-TenantId": tenantId,
    },
    mcp,
  };

  const content = `${JSON.stringify(config, null, 2)}\n`;
  return { configPath: `${agentHome}/config.json`, content, parsed: JSON.parse(content) };
}

const SECRET_LITERAL_PATTERNS: ReadonlyArray<RegExp> = [
  // API-key style literals, e.g. "sk-ant-…", "sk-live-…"
  /\bsk-[A-Za-z0-9_-]{6,}/,
  // Derived sub-account identity keys (underscore form) — forbidden since
  // they were forgeable (H2: deterministic arm_sk_<subAccountId>).
  /\barm_sk_[A-Za-z0-9_-]{2,}/,
  // Bearer tokens inline (quoted or bare)
  /\bbearer\b/i,
  // Quoted bearer literals with a token value, e.g. "Bearer ghp_…"
  /["']?Bearer\s+[A-Za-z0-9._~+/=-]{6,}/i,
  // Password-like assignments with a literal value
  /["']?(password|passwd|pwd|client_secret)["']?\s*[:=]\s*["'][^"']+["']/i,
];

/**
 * Fail loud if a rendered config contains literal secret material.
 * Env-var references (`${VAR}`) are the only allowed credential form
 * (Invariants 4/5 — short-lived credentials; secrets never land in files).
 */
export function assertNoSecretsInConfig(content: string): void {
  for (const pattern of SECRET_LITERAL_PATTERNS) {
    const match = pattern.exec(content);
    if (match) {
      throw new Error(
        `secret literal detected in rendered config: "${match[0].slice(0, 40)}" — ` +
          "credentials must be env-var references only (Invariants 4/5)",
      );
    }
  }
}
