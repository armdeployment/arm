/**
 * ARM Agent SDK — Connect Your Coding Agent to ARM
 *
 * Supports: OpenCode, Claude Code, GitHub Copilot, Pi Coding Agent, and custom setups.
 *
 * How it works:
 *   1. Run `npx @arm/agent-sdk setup` (or `pnpm --filter @arm/agent-sdk setup`)
 *   2. Choose your agent type
 *   3. Enter your ARM tenant URL, sub-account ID, and API key
 *   4. The SDK generates the correct config file for your agent
 *   5. Your agent now routes all LLM calls through the ARM proxy
 *      → identity, metering, budget enforcement, DLP gate
 *
 * Under the hood: every supported agent tool lets you override the API
 * base URL and API key. ARM provides a proxy endpoint that accepts
 * the same API format (OpenAI-compatible) but adds governance.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { join, dirname, resolve as pathResolve } from "node:path";
import { homedir } from "node:os";

// ── Agent Definitions ──────────────────────────────────────────────────────

export interface AgentConfig {
  /** Human-readable name. */
  displayName: string;
  /** CLI flag value (e.g. "opencode"). */
  type: string;
  /** Path to the config file (supports ~ expansion). */
  configPath: string;
  /** Key in config JSON/TOML where base_url is set. */
  baseUrlKey: string;
  /** Key in config JSON/TOML where api_key is set. */
  apiKeyKey: string;
  /** Optional: extra headers to inject. */
  extraHeadersKey?: string;
  /** Format of the config file. */
  format: "json" | "toml" | "env" | "yaml";
  /** How to write the config (default: merge into existing file). */
  writeMode: "merge" | "replace";
}

export const AGENTS: Record<string, AgentConfig> = {
  opencode: {
    displayName: "OpenCode",
    type: "opencode",
    configPath: "~/.config/opencode/config.json",
    baseUrlKey: "base_url",
    apiKeyKey: "api_key",
    extraHeadersKey: "extra_headers",
    format: "json",
    writeMode: "merge",
  },
  claude_code: {
    displayName: "Claude Code",
    type: "claude_code",
    configPath: "~/.claude/config.toml",
    baseUrlKey: "anthropic_base_url",
    apiKeyKey: "anthropic_api_key",
    format: "toml",
    writeMode: "merge",
  },
  copilot: {
    displayName: "GitHub Copilot",
    type: "copilot",
    configPath: "~/.copilot/config.json",
    baseUrlKey: "copilot_api_endpoint",
    apiKeyKey: "copilot_arm_token",
    format: "json",
    writeMode: "merge",
  },
  pi: {
    displayName: "Pi Coding Agent",
    type: "pi",
    configPath: "~/.pi-agent/config.json",
    baseUrlKey: "base_url",
    apiKeyKey: "api_key",
    format: "json",
    writeMode: "merge",
  },
  custom: {
    displayName: "Custom / Generic",
    type: "custom",
    configPath: "~/.arm/agent.env",
    baseUrlKey: "ARM_BASE_URL",
    apiKeyKey: "ARM_API_KEY",
    extraHeadersKey: "ARM_HEADERS",
    format: "env",
    writeMode: "replace",
  },
};

// ── Config Generation ──────────────────────────────────────────────────────

export interface SetupInput {
  agentType: string;
  tenantUrl: string;
  subAccountId: string;
  apiKey: string;
}

export interface SetupResult {
  success: boolean;
  configPath: string;
  configWritten: boolean;
  message: string;
  verificationUrl: string;
}

/** Expands ~ in paths to the user's home directory. */
function expandHome(p: string): string {
  if (p.startsWith("~")) {
    return join(homedir(), p.slice(1));
  }
  return p;
}

/** Reads an existing JSON config file (or returns empty object). */
function readJSON(path: string): Record<string, unknown> {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return {};
  }
}

/** Reads an existing TOML config file (or returns empty string). */
function readTOML(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

/** Writes a JSON config: merges with existing to avoid overwriting other settings. */
function writeJSONConfig(
  agent: AgentConfig,
  path: string,
  baseUrl: string,
  apiKey: string,
  subAccountId: string,
): void {
  const existing = readJSON(path);
  existing[agent.baseUrlKey] = baseUrl;
  existing[agent.apiKeyKey] = apiKey;
  if (agent.extraHeadersKey) {
    existing[agent.extraHeadersKey] = {
      ...((existing[agent.extraHeadersKey] as Record<string, string>) ?? {}),
      "X-ARM-SubAccountId": subAccountId,
      "X-ARM-TenantId": "tn_demo",
    };
  }
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(existing, null, 2) + "\n");
}

/** Writes a TOML config: appends ARM settings to existing file. */
function writeTOMLConfig(agent: AgentConfig, path: string, baseUrl: string, apiKey: string): void {
  const existing = readTOML(path);
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const armSection = existing.includes("[arm]")
    ? ""
    : `\n\n[arm]\nbase_url = "${baseUrl}"\napi_key = "${apiKey}"\n`;
  writeFileSync(path, existing + armSection);
}

/** Writes an .env config file. */
function writeEnvConfig(
  agent: AgentConfig,
  path: string,
  baseUrl: string,
  apiKey: string,
  subAccountId: string,
): void {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(
    path,
    `# ARM Agent Configuration\n${agent.baseUrlKey}=${baseUrl}\n${agent.apiKeyKey}=${apiKey}\nARM_SUB_ACCOUNT_ID=${subAccountId}\n`,
  );
}

/**
 * Generates the agent config file. This is the core function — called by
 * the CLI and by the web dashboard's onboarding flow.
 */
export function generateAgentConfig(input: SetupInput): SetupResult {
  const agent = AGENTS[input.agentType];
  if (!agent) {
    return {
      success: false,
      configPath: "",
      configWritten: false,
      message: `Unknown agent type: ${input.agentType}. Supported: ${Object.keys(AGENTS).join(", ")}`,
      verificationUrl: "",
    };
  }

  const configPath = expandHome(agent.configPath);

  try {
    switch (agent.format) {
      case "json":
        writeJSONConfig(agent, configPath, input.tenantUrl, input.apiKey, input.subAccountId);
        break;
      case "toml":
        writeTOMLConfig(agent, configPath, input.tenantUrl, input.apiKey);
        break;
      case "env":
        writeEnvConfig(agent, configPath, input.tenantUrl, input.apiKey, input.subAccountId);
        break;
      default:
        return {
          success: false,
          configPath,
          configWritten: false,
          message: `Unsupported config format: ${agent.format}`,
          verificationUrl: "",
        };
    }

    return {
      success: true,
      configPath,
      configWritten: true,
      message: `✓ ${agent.displayName} configured successfully!\n  Config: ${configPath}\n  Proxy: ${input.tenantUrl}\n  Sub-account: ${input.subAccountId}\n\n  Your agent is now routing through ARM — all calls will be metered, budgeted, and policy-enforced.`,
      verificationUrl: `${input.tenantUrl}/health`,
    };
  } catch (err) {
    return {
      success: false,
      configPath,
      configWritten: false,
      message: `Failed to write config: ${(err as Error).message}`,
      verificationUrl: "",
    };
  }
}

/** Verifies connectivity to the ARM proxy by hitting the health endpoint. */
export async function verifyConnection(
  tenantUrl: string,
): Promise<{ ok: boolean; latencyMs: number; detail: string }> {
  const t0 = Date.now();
  try {
    const res = await fetch(`${tenantUrl}/health`, { method: "GET" });
    const latency = Date.now() - t0;
    if (res.ok) {
      const body = (await res.json()) as Record<string, unknown>;
      return {
        ok: true,
        latencyMs: latency,
        detail: `Connected to ARM proxy v${body.version ?? "?"} (${latency}ms)`,
      };
    }
    return { ok: false, latencyMs: latency, detail: `Proxy returned ${res.status}` };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - t0,
      detail: `Connection failed: ${(err as Error).message}`,
    };
  }
}
