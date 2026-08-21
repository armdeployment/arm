/**
 * ARM Agent Plugin Ingest (spec §8.1, §9 Phase 4, D9 Phase 1.6).
 *
 * First-party agent plugins for automated onboarding and discovery.
 * Agents self-configure via the data-plane discovery endpoint
 * (/.well-known/arm-agent) and authenticate via the OIDC issuer.
 *
 * Supported agent types: opencode, claude code, copilot, Pi
 *
 * Stub mode: serves the agent config template. Real mode: validates
 * agent identity and provisions credentials through the control plane.
 *
 * D9 Phase 1.6: opencode is the reference package runtime — the discovery
 * manifest advertises the supported work-package roles and
 * `writeOpencodePackageConfig` renders the runtime config via
 * @arm/client-core (env-var credential references only, Invariants 4/5).
 */

import {
  clientPackageManifestSchema,
  renderOpencodeConfig,
  assertNoSecretsInConfig,
  verifyManifestIntegrity,
} from "@arm/client-core";

// ── Agent Plugin Types ─────────────────────────────────────────────────────

export type AgentPluginType = "opencode" | "claude_code" | "copilot" | "pi";

export interface AgentPluginConfig {
  type: AgentPluginType;
  displayName: string;
  baseUrlEnvVar: string; // e.g. ARM_BASE_URL, OPENROUTER_BASE_URL
  apiKeyEnvVar: string; // e.g. ARM_API_KEY, ANTHROPIC_API_KEY
  configFile: string; // e.g. ~/.config/opencode/config.json
  setupInstructions: string;
  discoveryUrl: string; // /.well-known/arm-agent
  /** Work-package roles this plugin can install (opencode is the reference). */
  packages?: string[];
}

/** Work-package roles the data plane currently supports (D9 pilot set). */
export const SUPPORTED_PACKAGE_ROLES = [
  "quality_engineer",
  "plc_programmer",
  "maintenance_technician",
  "office_worker_general",
  "exec_assistant",
] as const;

/** Minimum agent runtime version required for package installs (D9). */
export const MIN_AGENT_VERSION = "0.16.0";

// ── Plugin Registry ────────────────────────────────────────────────────────

export const AGENT_PLUGINS: Record<AgentPluginType, AgentPluginConfig> = {
  opencode: {
    type: "opencode",
    displayName: "OpenCode",
    baseUrlEnvVar: "OPENCODE_BASE_URL",
    apiKeyEnvVar: "OPENCODE_API_KEY",
    configFile: "~/.config/opencode/config.json",
    setupInstructions:
      "Set OPENCODE_BASE_URL=<tenant-data-plane-url> and OPENCODE_API_KEY=<sub-account-credential> in ~/.config/opencode/config.json",
    discoveryUrl: "/.well-known/arm-agent/opencode",
    packages: [...SUPPORTED_PACKAGE_ROLES],
  },
  claude_code: {
    type: "claude_code",
    displayName: "Claude Code",
    baseUrlEnvVar: "ANTHROPIC_BASE_URL",
    apiKeyEnvVar: "ANTHROPIC_API_KEY",
    configFile: "~/.claude/config.toml",
    setupInstructions:
      "Set ANTHROPIC_BASE_URL=<tenant-data-plane-url>/v1 and ANTHROPIC_API_KEY=<sub-account-credential> in ~/.claude/config.toml",
    discoveryUrl: "/.well-known/arm-agent/claude-code",
  },
  copilot: {
    type: "copilot",
    displayName: "GitHub Copilot",
    baseUrlEnvVar: "COPILOT_API_ENDPOINT",
    apiKeyEnvVar: "COPILOT_ARM_TOKEN",
    configFile: "~/.copilot/config.json",
    setupInstructions:
      "Point Copilot proxy to <tenant-data-plane-url> with X-ARM-SubAccountId header",
    discoveryUrl: "/.well-known/arm-agent/copilot",
  },
  pi: {
    type: "pi",
    displayName: "Pi Coding Agent",
    baseUrlEnvVar: "PI_BASE_URL",
    apiKeyEnvVar: "PI_API_KEY",
    configFile: "~/.pi-agent/config.json",
    setupInstructions:
      "Set PI_BASE_URL=<tenant-data-plane-url> and PI_API_KEY=<sub-account-credential> in ~/.pi-agent/config.json",
    discoveryUrl: "/.well-known/arm-agent/pi",
  },
};

// ── Discovery Endpoint Handler ──────────────────────────────────────────────

/**
 * Serves agent config from /.well-known/arm-agent. Each agent type
 * queries its specific URL to get the setup instructions and endpoints.
 */
export function getAgentPluginConfig(agentType: AgentPluginType): AgentPluginConfig | null {
  return AGENT_PLUGINS[agentType] ?? null;
}

/**
 * Returns the full discovery manifest listing all supported agent types
 * with their discovery URLs, the supported work-package roles, and the
 * minimum agent runtime version (D9: runtimes self-update from this).
 */
export function getDiscoveryManifest(baseUrl: string) {
  const types = Object.keys(AGENT_PLUGINS) as AgentPluginType[];
  return {
    arm: {
      version: "0.0.0",
      description: "ARM Agent Gateway — HR-style control plane for AI agents",
      documentation: "https://docs.arm.example.com",
    },
    packages: [...SUPPORTED_PACKAGE_ROLES],
    min_agent_version: MIN_AGENT_VERSION,
    supportedAgents: types.map((type) => ({
      type,
      displayName: AGENT_PLUGINS[type].displayName,
      discoveryUrl: `${baseUrl}${AGENT_PLUGINS[type].discoveryUrl}`,
      setupInstructions: AGENT_PLUGINS[type].setupInstructions,
      ...(AGENT_PLUGINS[type].packages !== undefined
        ? { packages: AGENT_PLUGINS[type].packages }
        : {}),
    })),
  };
}

// ── OAuth Flow (spec §9 Phase 4) ───────────────────────────────────────────

export interface OAuthStartResponse {
  authUrl: string;
  state: string;
}

/**
 * Initiates the OAuth authorization code flow for an agent plugin.
 * The agent is redirected to the ARM control plane for authentication.
 *
 * Stub: returns a fixture auth URL.
 */
export function startAgentOAuth(agentType: AgentPluginType, tenantId: string): OAuthStartResponse {
  const state = `arm_${agentType}_${tenantId}_${Date.now()}`;
  return {
    authUrl: `https://control.arm.example.com/oauth/authorize?response_type=code&client_id=arm-${agentType}&redirect_uri=arm://callback&state=${state}`,
    state,
  };
}

// ── opencode Package Config Writer (D9 Phase 1.6) ──────────────────────────

export interface OpencodePackageConfigOptions {
  /** ARM data-plane proxy base URL (falls back to ARM_PROXY_URL / localhost). */
  armProxyUrl?: string;
  /** Target sub-account id (resolved via assignment in real mode). */
  subAccountId?: string;
  /** Target tenant id (resolved via assignment in real mode). */
  tenantId?: string;
  /** opencode home directory override. */
  agentHome?: string;
}

/**
 * Validate a package manifest against the proto-composed schema and render
 * the opencode config via @arm/client-core. Credentials are env-var
 * references only — never raw values (Invariants 4/5): the proxy credential
 * is `${ARM_AGENT_TOKEN}` (minted by the control plane, delivered out of
 * band), never a derived literal.
 */
export function writeOpencodePackageConfig(
  manifest: unknown,
  options: OpencodePackageConfigOptions = {},
): { configPath: string; content: string } {
  const parsed = clientPackageManifestSchema.parse(manifest);
  if (!verifyManifestIntegrity(parsed.version)) {
    throw new Error(
      "package manifest integrity verification FAILED — manifest_sha256 mismatch. " +
        "Refusing to render config (D9: config tamper is detected, never silently applied).",
    );
  }
  const rendered = renderOpencodeConfig({
    manifest: parsed,
    armProxyUrl: options.armProxyUrl ?? process.env["ARM_PROXY_URL"] ?? "http://localhost:8787",
    subAccountId: options.subAccountId ?? "pending-assignment",
    tenantId: options.tenantId ?? "pending-assignment",
    ...(options.agentHome !== undefined ? { agentHome: options.agentHome } : {}),
  });
  assertNoSecretsInConfig(rendered.content);
  return { configPath: rendered.configPath, content: rendered.content };
}
