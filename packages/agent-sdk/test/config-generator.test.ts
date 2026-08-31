import { describe, it, expect } from "vitest";
import { generateAgentConfig, AGENTS, verifyConnection } from "../src/index.js";

describe("agent config generator", () => {
  it("generates config for opencode", () => {
    const result = generateAgentConfig({
      agentType: "opencode",
      tenantUrl: "https://data.arm.acme.com",
      subAccountId: "sa_test",
      apiKey: "arm_sk_test",
    });
    expect(result.success).toBe(true);
    expect(result.configPath).toContain("opencode");
  });

  it("generates config for claude code", () => {
    const result = generateAgentConfig({
      agentType: "claude_code",
      tenantUrl: "https://data.arm.acme.com",
      subAccountId: "sa_test",
      apiKey: "arm_sk_test",
    });
    expect(result.success).toBe(true);
    expect(result.configPath).toContain(".claude");
  });

  it("generates .env config for custom", () => {
    const result = generateAgentConfig({
      agentType: "custom",
      tenantUrl: "https://data.arm.acme.com",
      subAccountId: "sa_test",
      apiKey: "arm_sk_test",
    });
    expect(result.success).toBe(true);
    expect(result.configPath).toContain(".env");
  });

  it("rejects unknown agent types", () => {
    const result = generateAgentConfig({
      agentType: "nonexistent",
      tenantUrl: "",
      subAccountId: "",
      apiKey: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("AGENTS registry", () => {
  it("has all 5 supported types", () => {
    expect(Object.keys(AGENTS)).toEqual(["opencode", "claude_code", "copilot", "pi", "custom"]);
  });

  it("each agent has configPath + format", () => {
    for (const [key, agent] of Object.entries(AGENTS)) {
      expect(agent.configPath).toBeTruthy();
      expect(agent.format).toBeTruthy();
    }
  });
});

describe("verifyConnection", () => {
  it("returns failure for unreachable proxy (expected — no proxy running)", async () => {
    const result = await verifyConnection("http://localhost:19999");
    expect(result.ok).toBe(false);
  });
});
