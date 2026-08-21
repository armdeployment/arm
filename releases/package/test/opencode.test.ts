import { describe, it, expect } from "vitest";
import { renderOpencodeConfig, assertNoSecretsInConfig, mcpTokenEnvVar } from "../src/opencode.js";
import { makeManifest, TENANT_ID } from "./helpers.js";

describe("renderOpencodeConfig", () => {
  const rendered = renderOpencodeConfig({
    manifest: makeManifest(),
    armProxyUrl: "https://data.arm.acme.com",
    subAccountId: "sa_123",
    tenantId: TENANT_ID,
  });

  it("points the runtime at the ARM proxy with an env-var token reference", () => {
    expect(rendered.configPath).toBe("~/.config/opencode/config.json");
    const parsed = rendered.parsed as Record<string, unknown>;
    expect(parsed["base_url"]).toBe("https://data.arm.acme.com");
    expect(parsed["api_key"]).toBe("${ARM_AGENT_TOKEN}");
    const headers = parsed["extra_headers"] as Record<string, string>;
    expect(headers["X-ARM-SubAccountId"]).toBe("sa_123");
    expect(headers["X-ARM-TenantId"]).toBe(TENANT_ID);
  });

  it("maps every manifest tool to an mcp entry with env-var refs only", () => {
    const parsed = rendered.parsed as { mcp: Record<string, Record<string, unknown>> };
    expect(Object.keys(parsed.mcp)).toEqual(["jira", "github_issues"]);
    const jira = parsed.mcp["jira"]!;
    expect(jira["type"]).toBe("http");
    expect(jira["url"]).toBe("https://mcp.acme.internal/jira");
    const headers = jira["headers"] as Record<string, string>;
    expect(headers["Authorization"]).toBe(`\${${mcpTokenEnvVar("jira")}}`);
  });

  it("renders cli tools as stdio entries", () => {
    const manifest = makeManifest({
      tools: [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          tenant_id: "99999999-9999-4999-8999-999999999999",
          name: "opc-diag",
          kind: "cli",
          endpoint: "opc-diag --list",
          auth_strategy: "none",
          data_classification: "internal",
          owner_user_id: "88888888-8888-4888-8888-888888888888",
          review_status: "approved",
        },
      ],
    });
    const result = renderOpencodeConfig({
      manifest,
      armProxyUrl: "https://data.arm.acme.com",
      subAccountId: "sa_123",
      tenantId: TENANT_ID,
      agentHome: "/home/alice/.config/opencode",
    });
    expect(result.configPath).toBe("/home/alice/.config/opencode/config.json");
    const parsed = result.parsed as { mcp: Record<string, Record<string, unknown>> };
    expect(parsed.mcp["opc_diag"]!["type"]).toBe("stdio");
  });

  it("contains no raw secrets", () => {
    expect(() => assertNoSecretsInConfig(rendered.content)).not.toThrow();
    expect(rendered.content).not.toMatch(/\bsk-/);
    expect(rendered.content).not.toMatch(/arm_sk_/);
    expect(rendered.content).not.toMatch(/bearer/i);
  });
});

describe("assertNoSecretsInConfig", () => {
  it("throws on API-key literals", () => {
    expect(() => assertNoSecretsInConfig('{"api_key": "sk-ant-api03-abcdef123456789"}')).toThrow(
      /secret literal/i,
    );
  });

  it("throws on derived arm_sk_ identity keys (underscore form)", () => {
    expect(() => assertNoSecretsInConfig('{"api_key": "arm_sk_sa_123"}')).toThrow(
      /secret literal/i,
    );
  });

  it("throws on bearer tokens", () => {
    expect(() => assertNoSecretsInConfig('"Authorization": "Bearer ghp_abcdef123456"')).toThrow(
      /secret literal/i,
    );
  });

  it("throws on unquoted bearer tokens", () => {
    expect(() => assertNoSecretsInConfig("Authorization: Bearer abcdef123456")).toThrow(
      /secret literal/i,
    );
  });

  it("throws on password literals", () => {
    expect(() => assertNoSecretsInConfig('"password": "hunter2"')).toThrow(/secret literal/i);
  });

  it("allows env-var references", () => {
    expect(() => assertNoSecretsInConfig('"Authorization": "${ARM_MCP_JIRA_TOKEN}"')).not.toThrow();
    expect(() => assertNoSecretsInConfig('"api_key": "${ARM_AGENT_TOKEN}"')).not.toThrow();
  });
});
