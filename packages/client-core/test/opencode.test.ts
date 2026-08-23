import { describe, it, expect } from "vitest";
import {
  renderOpencodeConfig,
  assertNoSecretsInConfig,
  mcpTokenEnvVar,
  componentToMcpEntry,
} from "../src/opencode.js";
import { makeManifest, makeResolvedComponent, makeComponent, makeComponentVersion, TENANT_ID } from "./helpers.js";

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

  it("maps every callable manifest component to an mcp entry, skipping installable ones", () => {
    const parsed = rendered.parsed as { mcp: Record<string, Record<string, unknown>> };
    // jira (mcp) + github-issues (http_api) are callable; 8d-generator (skill) is not.
    expect(Object.keys(parsed.mcp)).toEqual(["jira", "github_issues"]);
    const jira = parsed.mcp["jira"]!;
    expect(jira["type"]).toBe("http");
    expect(jira["url"]).toBe("https://mcp.acme.internal/jira");
    const headers = jira["headers"] as Record<string, string>;
    expect(headers["Authorization"]).toBe(`\${${mcpTokenEnvVar("jira")}}`);
  });

  it("renders cli components as stdio entries", () => {
    const manifest = makeManifest({
      components: [
        makeResolvedComponent({
          component: makeComponent({
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            slug: "opc-diag",
            name: "opc-diag",
            kind: "cli",
            endpoint: "opc-diag --list",
            auth_strategy: "none",
          }),
          version: makeComponentVersion({ component_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }),
        }),
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

describe("componentToMcpEntry — kind routing", () => {
  it("renders a cli component as a stdio entry using the command from config_schema", () => {
    const resolved = makeResolvedComponent({
      component: makeComponent({ name: "opc-diag", kind: "cli", endpoint: "unused", auth_strategy: "pat" }),
      version: makeComponentVersion({ config_schema: { command: "opc-diag --serve" } }),
    });
    expect(componentToMcpEntry(resolved)).toEqual({
      type: "stdio",
      command: "opc-diag --serve",
      env: { [mcpTokenEnvVar("opc-diag")]: `\${${mcpTokenEnvVar("opc-diag")}}` },
    });
  });

  it("falls back to the component name as command when config_schema has no command", () => {
    const resolved = makeResolvedComponent({
      component: makeComponent({ name: "opc-diag", kind: "cli", endpoint: "unused", auth_strategy: "pat" }),
      version: makeComponentVersion({ config_schema: {} }),
    });
    expect(componentToMcpEntry(resolved)).toEqual({
      type: "stdio",
      command: "opc-diag",
      env: { [mcpTokenEnvVar("opc-diag")]: `\${${mcpTokenEnvVar("opc-diag")}}` },
    });
  });

  it("omits the env block for cli components with auth_strategy none", () => {
    const resolved = makeResolvedComponent({
      component: makeComponent({ name: "opc-diag", kind: "cli", endpoint: "unused", auth_strategy: "none" }),
      version: makeComponentVersion({ config_schema: { command: "opc-diag --serve" } }),
    });
    const entry = componentToMcpEntry(resolved);
    expect(entry["type"]).toBe("stdio");
    expect(entry["command"]).toBe("opc-diag --serve");
    expect(entry["env"]).toBeUndefined();
    expect(entry["url"]).toBeUndefined();
    expect(entry["headers"]).toBeUndefined();
  });

  it("renders mcp components as http entries with env-var auth refs only", () => {
    const resolved = makeResolvedComponent(); // kind mcp, auth pat (jira defaults)
    expect(componentToMcpEntry(resolved)).toEqual({
      type: "http",
      url: "https://mcp.acme.internal/jira",
      headers: { Authorization: `\${${mcpTokenEnvVar("jira")}}` },
    });
  });

  it("renders http_api and connector components as http entries too", () => {
    const httpApi = makeResolvedComponent({
      component: makeComponent({ name: "vss", kind: "http_api", endpoint: "https://vss.internal" }),
    });
    expect(componentToMcpEntry(httpApi)).toEqual({
      type: "http",
      url: "https://vss.internal",
      headers: { Authorization: `\${${mcpTokenEnvVar("vss")}}` },
    });
    const connector = makeResolvedComponent({
      component: makeComponent({ name: "cmms", kind: "connector", endpoint: "cmms.internal:8443" }),
    });
    expect(componentToMcpEntry(connector)["type"]).toBe("http");
    expect(componentToMcpEntry(connector)["url"]).toBe("cmms.internal:8443");
  });

  it("rendered cli configs carry env-var references, never literal secrets", () => {
    const manifest = makeManifest({
      components: [
        makeResolvedComponent({
          component: makeComponent({ name: "opc-diag", kind: "cli", endpoint: "unused", auth_strategy: "pat" }),
          version: makeComponentVersion({ config_schema: { command: "opc-diag --serve" } }),
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
