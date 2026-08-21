import { describe, it, expect } from "vitest";
import {
  renderOpencodeConfig,
  assertNoSecretsInConfig,
  mcpTokenEnvVar,
  toolToMcpEntry,
} from "../src/opencode.js";
import { makeManifest, makeTool, TENANT_ID } from "./helpers.js";

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

describe("toolToMcpEntry — kind routing", () => {
  it("renders a cli tool as a stdio entry using the command from config_schema", () => {
    const tool = makeTool({
      name: "opc-diag",
      kind: "cli",
      endpoint: "unused",
      auth_strategy: "pat",
      config_schema: { command: "opc-diag --serve" },
    });
    expect(toolToMcpEntry(tool)).toEqual({
      type: "stdio",
      command: "opc-diag --serve",
      env: { [mcpTokenEnvVar("opc-diag")]: `\${${mcpTokenEnvVar("opc-diag")}}` },
    });
  });

  it("falls back to the tool name as command when config_schema has no command", () => {
    const tool = makeTool({
      name: "opc-diag",
      kind: "cli",
      endpoint: "unused",
      auth_strategy: "pat",
      config_schema: {},
    });
    expect(toolToMcpEntry(tool)).toEqual({
      type: "stdio",
      command: "opc-diag",
      env: { [mcpTokenEnvVar("opc-diag")]: `\${${mcpTokenEnvVar("opc-diag")}}` },
    });
  });

  it("omits the env block for cli tools with auth_strategy none", () => {
    const tool = makeTool({
      name: "opc-diag",
      kind: "cli",
      endpoint: "unused",
      auth_strategy: "none",
      config_schema: { command: "opc-diag --serve" },
    });
    const entry = toolToMcpEntry(tool);
    expect(entry["type"]).toBe("stdio");
    expect(entry["command"]).toBe("opc-diag --serve");
    expect(entry["env"]).toBeUndefined();
    expect(entry["url"]).toBeUndefined();
    expect(entry["headers"]).toBeUndefined();
  });

  it("renders mcp tools as http entries with env-var auth refs only", () => {
    const tool = makeTool(); // kind mcp, auth pat
    expect(toolToMcpEntry(tool)).toEqual({
      type: "http",
      url: "https://mcp.acme.internal/jira",
      headers: { Authorization: `\${${mcpTokenEnvVar("jira")}}` },
    });
  });

  it("renders http_api and connector tools as http entries too", () => {
    const httpApi = makeTool({ name: "vss", kind: "http_api", endpoint: "https://vss.internal" });
    expect(toolToMcpEntry(httpApi)).toEqual({
      type: "http",
      url: "https://vss.internal",
      headers: { Authorization: `\${${mcpTokenEnvVar("vss")}}` },
    });
    const connector = makeTool({ name: "cmms", kind: "connector", endpoint: "cmms.internal:8443" });
    expect(toolToMcpEntry(connector)["type"]).toBe("http");
    expect(toolToMcpEntry(connector)["url"]).toBe("cmms.internal:8443");
  });

  it("rendered cli configs carry env-var references, never literal secrets", () => {
    const manifest = makeManifest({
      tools: [
        makeTool({
          name: "opc-diag",
          kind: "cli",
          endpoint: "unused",
          auth_strategy: "pat",
          config_schema: { command: "opc-diag --serve" },
        }),
      ],
    });
    const result = renderOpencodeConfig({
      manifest,
      armProxyUrl: "https://data.arm.acme.com",
      subAccountId: "sa_123",
      tenantId: TENANT_ID,
    });
    const parsed = result.parsed as { mcp: Record<string, Record<string, unknown>> };
    expect(parsed.mcp["opc_diag"]).toEqual({
      type: "stdio",
      command: "opc-diag --serve",
      env: { [mcpTokenEnvVar("opc-diag")]: `\${${mcpTokenEnvVar("opc-diag")}}` },
    });
    expect(() => assertNoSecretsInConfig(result.content)).not.toThrow();
    expect(result.content).not.toMatch(/\bsk-|arm_sk_|bearer/i);
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
