import { describe, it, expect } from "vitest";
import {
  getAgentPluginConfig,
  getDiscoveryManifest,
  startAgentOAuth,
  writeOpencodePackageConfig,
  SUPPORTED_PACKAGE_ROLES,
  MIN_AGENT_VERSION,
} from "../src/index.js";
import { buildCanonicalManifest, manifestSha256 } from "@arm/client-core";

/** Minimal schema-valid package manifest fixture (manifest v2, D10 wire contract). */
function makeManifest() {
  const version = {
    id: "44444444-4444-4444-8444-444444444444",
    package_id: "33333333-3333-4333-8333-333333333333",
    version: "1.0.0",
    manifest_version: 2 as const,
    components: [
      {
        component_id: "11111111-1111-4111-8111-111111111111",
        version: "2.1.0",
        kind: "mcp" as const,
        scopes: ["read:jira-work"],
      },
    ],
    permissions: [],
    model_routing: {},
    budget_template: { monthly_usd_cap: 150 },
    starter_prompts: [],
    min_agent_version: "0.16.0",
    job_functions: ["quality_engineer"],
  };
  return {
    package: {
      id: "33333333-3333-4333-8333-333333333333",
      tenant_id: "99999999-9999-4999-8999-999999999999",
      role_key: "quality_engineer",
      name: "Quality Engineer",
      family: "quality",
      mode: "copilot",
      description: "8D/PPAP/SPC toolkit",
    },
    version: {
      ...version,
      manifest_sha256: manifestSha256(buildCanonicalManifest(version)),
    },
    components: [
      {
        component: {
          id: "11111111-1111-4111-8111-111111111111",
          tenant_id: "99999999-9999-4999-8999-999999999999",
          slug: "jira",
          kind: "mcp",
          name: "jira",
          description: "Jira MCP connector",
          owner_user_id: "88888888-8888-4888-8888-888888888888",
          review_status: "approved",
          source_kind: "first_party",
          source_ref: "",
          endpoint: "https://mcp.acme.internal/jira",
          auth_strategy: "pat",
          data_classification: "internal",
          homepage_url: null,
        },
        version: {
          id: "22222222-2222-4222-8222-222222222222",
          tenant_id: "99999999-9999-4999-8999-999999999999",
          component_id: "11111111-1111-4111-8111-111111111111",
          version: "2.1.0",
          manifest: {},
          manifest_sha256: "0".repeat(64),
          blob_digest: null,
          blob_size_bytes: null,
          blob_media_type: null,
          config_schema: {},
          requires: [],
          changelog: "",
        },
      },
    ],
  };
}

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

describe("discovery manifest (D9 packages section)", () => {
  it("advertises the supported package roles", () => {
    const manifest = getDiscoveryManifest("https://data.arm.acme.com");
    expect(manifest.packages).toEqual([
      "quality_engineer",
      "plc_programmer",
      "maintenance_technician",
      "office_worker_general",
      "exec_assistant",
    ]);
  });

  it("advertises the minimum agent version", () => {
    const manifest = getDiscoveryManifest("https://data.arm.acme.com");
    expect(manifest.min_agent_version).toBe(MIN_AGENT_VERSION);
    expect(manifest.min_agent_version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("opencode is the first-class package runtime", () => {
    const opencode = getAgentPluginConfig("opencode")!;
    expect(opencode.packages).toEqual([...SUPPORTED_PACKAGE_ROLES]);
  });
});

describe("writeOpencodePackageConfig", () => {
  it("renders an opencode config from a valid manifest", () => {
    const { configPath, content } = writeOpencodePackageConfig(makeManifest(), {
      armProxyUrl: "https://data.arm.acme.com",
      subAccountId: "sa_123",
      tenantId: "99999999-9999-4999-8999-999999999999",
      agentHome: "/tmp/opencode-home",
    });
    expect(configPath).toBe("/tmp/opencode-home/config.json");
    expect(content).toContain("https://data.arm.acme.com");
    expect(content).toContain('"api_key": "${ARM_AGENT_TOKEN}"');
    expect(content).toContain('"X-ARM-TenantId": "99999999-9999-4999-8999-999999999999"');
    expect(content).toContain("${ARM_MCP_JIRA_TOKEN}");
    // Env-var references only — never raw credentials (Invariants 4/5).
    expect(content).not.toContain("arm_sk_");
    expect(content).not.toMatch(/\bsk-/);
  });

  it("throws on schema-invalid manifests", () => {
    expect(() => writeOpencodePackageConfig({ package: { nope: true } })).toThrow();
  });
});
