/**
 * ARM Agent Plugin Ingest (spec §8.1, §9 Phase 4).
 *
 * First-party agent plugins for automated onboarding and discovery.
 * Agents self-configure via the data-plane discovery endpoint
 * (/.well-known/arm-agent) and authenticate via the OIDC issuer.
 *
 * Supported agent types: opencode, claude code, copilot, Pi
 *
 * Stub mode: serves the agent config template. Real mode: validates
 * agent identity and provisions credentials through the control plane.
 */

// ── Agent Plugin Types ─────────────────────────────────────────────────────

export type AgentPluginType = "opencode" | "claude_code" | "copilot" | "pi";

export interface AgentPluginConfig {
  type: AgentPluginType;
  displayName: string;
  baseUrlEnvVar: string;    // e.g. ARM_BASE_URL, OPENROUTER_BASE_URL
  apiKeyEnvVar: string;     // e.g. ARM_API_KEY, ANTHROPIC_API_KEY
  configFile: string;       // e.g. ~/.config/opencode/config.json
  setupInstructions: string;
  discoveryUrl: string;     // /.well-known/arm-agent
}

// ── Plugin Registry ────────────────────────────────────────────────────────

export const AGENT_PLUGINS: Record<AgentPluginType, AgentPluginConfig> = {
  opencode: {
    type: "opencode",
    displayName: "OpenCode",
    baseUrlEnvVar: "OPENCODE_BASE_URL",
    apiKeyEnvVar: "OPENCODE_API_KEY",
    configFile: "~/.config/opencode/config.json",
    setupInstructions:
      'Set OPENCODE_BASE_URL=<tenant-data-plane-url> and OPENCODE_API_KEY=<sub-account-credential> in ~/.config/opencode/config.json',
    discoveryUrl: "/.well-known/arm-agent/opencode",
  },
  claude_code: {
    type: "claude_code",
    displayName: "Claude Code",
    baseUrlEnvVar: "ANTHROPIC_BASE_URL",
    apiKeyEnvVar: "ANTHROPIC_API_KEY",
    configFile: "~/.claude/config.toml",
    setupInstructions:
      'Set ANTHROPIC_BASE_URL=<tenant-data-plane-url>/v1 and ANTHROPIC_API_KEY=<sub-account-credential> in ~/.claude/config.toml',
    discoveryUrl: "/.well-known/arm-agent/claude-code",
  },
  copilot: {
    type: "copilot",
    displayName: "GitHub Copilot",
    baseUrlEnvVar: "COPILOT_API_ENDPOINT",
    apiKeyEnvVar: "COPILOT_ARM_TOKEN",
    configFile: "~/.copilot/config.json",
    setupInstructions:
      'Point Copilot proxy to <tenant-data-plane-url> with X-ARM-SubAccountId header',
    discoveryUrl: "/.well-known/arm-agent/copilot",
  },
  pi: {
    type: "pi",
    displayName: "Pi Coding Agent",
    baseUrlEnvVar: "PI_BASE_URL",
    apiKeyEnvVar: "PI_API_KEY",
    configFile: "~/.pi-agent/config.json",
    setupInstructions:
      'Set PI_BASE_URL=<tenant-data-plane-url> and PI_API_KEY=<sub-account-credential> in ~/.pi-agent/config.json',
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
 * with their discovery URLs.
 */
export function getDiscoveryManifest(baseUrl: string) {
  const types = Object.keys(AGENT_PLUGINS) as AgentPluginType[];
  return {
    arm: {
      version: "0.0.0",
      description: "ARM Agent Gateway — HR-style control plane for AI agents",
      documentation: "https://docs.arm.example.com",
    },
    supportedAgents: types.map((type) => ({
      type,
      displayName: AGENT_PLUGINS[type].displayName,
      discoveryUrl: `${baseUrl}${AGENT_PLUGINS[type].discoveryUrl}`,
      setupInstructions: AGENT_PLUGINS[type].setupInstructions,
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
