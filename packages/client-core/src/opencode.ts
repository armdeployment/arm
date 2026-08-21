/**
 * opencode runtime config rendering (D9 Phase 1.6 — reference runtime).
 *
 * Renders an opencode config.json from a verified package manifest. The ARM
 * proxy becomes the model backend; each package tool becomes an MCP entry.
 *
 * SECURITY (Invariants 4/5, roadmap §5.2): this module NEVER writes a real
 * credential into the file. The proxy credential is an environment-variable
 * reference (`${ARM_AGENT_TOKEN}`) resolved by the agent runtime from the
 * companion `<agentHome>/.arm-env` file (written 0o600 by `runSetup`, never
 * committed, never inlined). Tool auth headers are environment-variable
 * references (`${ARM_MCP_<NAME>_TOKEN}`) resolved by the agent runtime from
 * the OS keychain / tenant-vault broker. The only literals in the file are
 * routing metadata (sub-account id, tenant id) — identifiers, not secrets.
 * `assertNoSecretsInConfig` enforces this contract on every rendered config.
 */

import type { ClientPackageManifest, Tool } from "./manifest.js";

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

/** Sanitize a tool name into a safe config key / env-var token. */
function sanitizeToolName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** The env var holding a tool's MCP token — referenced, never inlined. */
export function mcpTokenEnvVar(toolName: string): string {
  return `ARM_MCP_${sanitizeToolName(toolName).toUpperCase()}_TOKEN`;
}

/**
 * Map a registry tool to an opencode MCP entry.
 *
 * - `cli` tools → opencode `stdio` entry. The command comes from
 *   `tool.config_schema.command` (falls back to the tool name). When the
 *   tool authenticates (auth_strategy ≠ "none"), an `env` block maps
 *   `ARM_MCP_<NAME>_TOKEN` to the env-var reference `${ARM_MCP_<NAME>_TOKEN}` —
 *   the runtime resolves it from the keychain / vault broker. No auth → no
 *   env block at all.
 * - `mcp` / `http_api` / `connector` tools → `http` entry against the tool
 *   endpoint. The Authorization header is an env-var reference only — raw
 *   credentials must never appear here.
 */
export function toolToMcpEntry(tool: Tool): Record<string, unknown> {
  if (tool.kind === "cli") {
    const command =
      typeof tool.config_schema?.command === "string" ? tool.config_schema.command : tool.name;
    const entry: Record<string, unknown> = { type: "stdio", command };
    if (tool.auth_strategy !== "none") {
      entry.env = { [mcpTokenEnvVar(tool.name)]: `\${${mcpTokenEnvVar(tool.name)}}` };
    }
    return entry;
  }

  return {
    type: "http",
    url: tool.endpoint,
    headers: { Authorization: `\${${mcpTokenEnvVar(tool.name)}}` },
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
  for (const tool of manifest.tools) {
    mcp[sanitizeToolName(tool.name)] = toolToMcpEntry(tool);
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
