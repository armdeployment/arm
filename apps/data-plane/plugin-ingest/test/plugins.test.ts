import { describe, it, expect } from "vitest";
import { getAgentPluginConfig, getDiscoveryManifest, startAgentOAuth } from "../src/index.js";

describe("agent plugins", () => {
  it("returns config for all 4 supported types", () => {
    expect(getAgentPluginConfig("opencode")).toBeTruthy();
    expect(getAgentPluginConfig("claude_code")).toBeTruthy();
    expect(getAgentPluginConfig("copilot")).toBeTruthy();
    expect(getAgentPluginConfig("pi")).toBeTruthy();
  });
  it("returns null for unsupported type", () => {
    expect(getAgentPluginConfig("unknown" as any)).toBeNull();
  });
  it("discovery manifest lists all 4 agents", () => {
    const manifest = getDiscoveryManifest("https://data.arm.acme.com");
    expect(manifest.supportedAgents.length).toBe(4);
  });
  it("OAuth flow returns auth URL with state", () => {
    const result = startAgentOAuth("opencode", "tn_demo");
    expect(result.authUrl).toContain("authorize");
    expect(result.state).toContain("opencode");
  });
});
