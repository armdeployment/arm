import { describe, it, expect, afterEach } from "vitest";
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { runSetup, verifyMeteredRoundTrip } from "../src/setup.js";
import { makeManifest, TENANT_ID } from "./helpers.js";

const METERED_TOKEN = "arm_mtr_test-token-0123456789";

describe("runSetup (E2E against a local mock control plane)", () => {
  const tempDirs: string[] = [];
  const servers: Server[] = [];

  afterEach(async () => {
    for (const server of servers.splice(0)) {
      server.close();
      await Promise.race([once(server, "close"), new Promise((r) => setTimeout(r, 250))]);
    }
    for (const dir of tempDirs.splice(0)) {
      await rm(dir, { recursive: true, force: true });
    }
  });

  async function startMockControlPlane(
    options: {
      manifest?: unknown;
      healthStatus?: number;
    } = {},
  ) {
    const manifest = options.manifest ?? makeManifest();
    const healthStatus = options.healthStatus ?? 200;
    const server = createServer((req, res) => {
      const path = req.url ?? "/";
      if (path === "/api/catalog/packages/quality_engineer/manifest") {
        res.statusCode = 200;
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify(manifest));
        return;
      }
      if (path === "/health") {
        res.statusCode = healthStatus;
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ ok: healthStatus === 200 }));
        return;
      }
      res.statusCode = 404;
      res.end();
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    servers.push(server);
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }

  async function makeAgentHome(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), "arm-client-core-"));
    tempDirs.push(dir);
    return dir;
  }

  it("installs a package end-to-end: fetch → verify → write config → metered round-trip", async () => {
    const baseUrl = await startMockControlPlane();
    const agentHome = await makeAgentHome();

    const result = await runSetup({
      controlPlaneUrl: baseUrl,
      token: "catalog-token",
      roleKey: "quality_engineer",
      armProxyUrl: baseUrl,
      subAccountId: "sa_123",
      tenantId: TENANT_ID,
      agentToken: METERED_TOKEN,
      agentHome,
    });

    expect(result.online).toBe(true);
    expect(result.roleKey).toBe("quality_engineer");
    expect(result.packageVersion).toBe("1.0.0");
    expect(result.tools).toEqual(["jira", "github-issues"]);
    expect(result.skills).toEqual(["8d-generator"]);
    expect(result.budgetHint).toBe("$150/month");
    expect(result.configPath).toBe(`${agentHome}/config.json`);
    expect(result.envFilePath).toBe(`${agentHome}/.arm-env`);

    const written = await readFile(result.configPath, "utf8");
    expect(written).toContain('"mcp"');
    expect(written).toContain("${ARM_MCP_JIRA_TOKEN}");
    expect(written).toContain('"api_key": "${ARM_AGENT_TOKEN}"');
    expect(written).toContain(`"X-ARM-TenantId": "${TENANT_ID}"`);
    expect(written).not.toMatch(/\bsk-/);
    expect(written).not.toMatch(/arm_sk_/);
    expect(written).not.toContain(METERED_TOKEN);

    // The metered token lives only in the companion env file, 0o600.
    const envContent = await readFile(result.envFilePath!, "utf8");
    expect(envContent).toBe(`ARM_AGENT_TOKEN=${METERED_TOKEN}\n`);
    const envMode = (await stat(result.envFilePath!)).mode & 0o777;
    expect(envMode).toBe(0o600);

    const connections = result.connectionsNeeded;
    expect(connections).toHaveLength(2);
    const jira = connections.find((c) => c.toolName === "jira")!;
    expect(jira.authMethod).toBe("pat");
    expect(jira.guideId).toBe("jira-pat");
    expect(jira.requiredScopes).toEqual(["read:jira-work"]);
    const github = connections.find((c) => c.toolName === "github-issues")!;
    expect(github.authMethod).toBe("oauth");
    expect(github.guideId).toBe("github-pat");
  });

  it("degrades to online:false when the proxy health check fails — never throws", async () => {
    const baseUrl = await startMockControlPlane({ healthStatus: 503 });
    const agentHome = await makeAgentHome();

    const result = await runSetup({
      controlPlaneUrl: baseUrl,
      token: "catalog-token",
      roleKey: "quality_engineer",
      armProxyUrl: baseUrl,
      subAccountId: "sa_123",
      tenantId: TENANT_ID,
      agentToken: METERED_TOKEN,
      agentHome,
    });

    expect(result.online).toBe(false);
    expect(result.healthMessage).toContain("503");
    expect(result.configPath).toBe(`${agentHome}/config.json`);
  });

  it("without an agent token: no env file, and the metered round-trip degrades to a reachability check", async () => {
    const baseUrl = await startMockControlPlane();
    const agentHome = await makeAgentHome();

    const result = await runSetup({
      controlPlaneUrl: baseUrl,
      token: "catalog-token",
      roleKey: "quality_engineer",
      armProxyUrl: baseUrl,
      subAccountId: "sa_123",
      tenantId: TENANT_ID,
      agentHome,
    });

    expect(result.online).toBe(false);
    expect(result.healthMessage).toBe("agent token required for metered call");
    expect(result.envFilePath).toBeUndefined();
  });

  it("returns online:false with a message when the proxy is unreachable", async () => {
    const health = await verifyMeteredRoundTrip("http://127.0.0.1:1", METERED_TOKEN);
    expect(health.online).toBe(false);
    expect(health.message).toBeTruthy();
  });

  it("returns online:false (token required) when reachable but no agent token", async () => {
    const baseUrl = await startMockControlPlane({ healthStatus: 200 });
    const health = await verifyMeteredRoundTrip(baseUrl);
    expect(health.online).toBe(false);
    expect(health.message).toBe("agent token required for metered call");
  });

  it("reports unreachable when no agent token and the proxy is down", async () => {
    const health = await verifyMeteredRoundTrip("http://127.0.0.1:1");
    expect(health.online).toBe(false);
    expect(health.message).toContain("proxy unreachable");
  });

  it("fails loud on a tampered manifest hash", async () => {
    const manifest = makeManifest();
    const tampered = {
      ...manifest,
      version: { ...manifest.version, manifest_sha256: "0".repeat(64) },
    };
    const baseUrl = await startMockControlPlane({ manifest: tampered });
    const agentHome = await makeAgentHome();

    await expect(
      runSetup({
        controlPlaneUrl: baseUrl,
        token: "catalog-token",
        roleKey: "quality_engineer",
        armProxyUrl: baseUrl,
        subAccountId: "sa_123",
        tenantId: TENANT_ID,
        agentHome,
      }),
    ).rejects.toThrow(/integrity check FAILED/);
  });
});
