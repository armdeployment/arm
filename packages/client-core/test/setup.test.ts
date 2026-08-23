import { describe, it, expect, afterEach } from "vitest";
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { runSetup, verifyMeteredRoundTrip } from "../src/setup.js";
import { ArmClientError } from "../src/errors.js";
import { makeManifest, TENANT_ID, SKILL_BLOB_DIGEST, SKILL_BLOB_TEXT } from "./helpers.js";

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
      serveSkillBlob?: boolean;
    } = {},
  ) {
    const manifest = options.manifest ?? makeManifest();
    const healthStatus = options.healthStatus ?? 200;
    const serveSkillBlob = options.serveSkillBlob ?? true;
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
      if (path === `/artifacts/${encodeURIComponent(SKILL_BLOB_DIGEST)}`) {
        if (!serveSkillBlob) {
          res.statusCode = 404;
          res.end();
          return;
        }
        res.statusCode = 200;
        res.setHeader("content-type", "text/markdown");
        res.end(SKILL_BLOB_TEXT);
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

  it("installs a package end-to-end: fetch → verify → write config → install component → metered round-trip", async () => {
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
      dataPlaneUrl: baseUrl,
    });

    expect(result.online).toBe(true);
    expect(result.roleKey).toBe("quality_engineer");
    expect(result.packageVersion).toBe("1.0.0");
    expect(result.components).toEqual(["jira", "github-issues", "8d-generator"]);
    expect(result.budgetHint).toBe("$150/month");
    expect(result.configPath).toBe(`${agentHome}/config.json`);
    expect(result.envFilePath).toBe(`${agentHome}/.arm-env`);
    expect(result.pendingApproval).toBe(false);

    const written = await readFile(result.configPath, "utf8");
    expect(written).toContain('"mcp"');
    expect(written).toContain("${ARM_MCP_JIRA_TOKEN}");
    expect(written).toContain('"api_key": "${ARM_AGENT_TOKEN}"');
    expect(written).toContain(`"X-ARM-TenantId": "${TENANT_ID}"`);
    expect(written).not.toMatch(/\bsk-/);
    expect(written).not.toMatch(/arm_sk_/);
    expect(written).not.toContain(METERED_TOKEN);
    // Only callable components (jira, github-issues) get MCP entries.
    expect(written).not.toContain("8d-generator");

    // The metered token lives only in the companion env file, 0o600.
    const envContent = await readFile(result.envFilePath!, "utf8");
    expect(envContent).toBe(`ARM_AGENT_TOKEN=${METERED_TOKEN}\n`);
    const envMode = (await stat(result.envFilePath!)).mode & 0o777;
    expect(envMode).toBe(0o600);

    // The skill component (installable, has a blob) was pulled + verified + written.
    expect(result.installedPaths).toHaveLength(1);
    const skillPath = result.installedPaths[0]!;
    expect(skillPath).toBe(join(agentHome, "skills", "8d-generator"));
    expect(await readFile(skillPath, "utf8")).toBe(SKILL_BLOB_TEXT);

    const connections = result.connectionsNeeded;
    expect(connections).toHaveLength(2);
    const jira = connections.find((c) => c.componentName === "jira")!;
    expect(jira.authMethod).toBe("pat");
    expect(jira.guideId).toBe("jira-pat");
    expect(jira.requiredScopes).toEqual(["read:jira-work"]);
    const github = connections.find((c) => c.componentName === "github-issues")!;
    expect(github.authMethod).toBe("oauth");
    expect(github.guideId).toBe("github-pat");
  });

  it("skips component installation when dataPlaneUrl is absent (no installedPaths)", async () => {
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

    expect(result.installedPaths).toEqual([]);
  });

  it("hard-fails with DIGEST_MISMATCH when the artifact cache doesn't have the blob", async () => {
    const baseUrl = await startMockControlPlane({ serveSkillBlob: false });
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
        dataPlaneUrl: baseUrl,
      }),
    ).rejects.toMatchObject({ code: "DIGEST_MISMATCH" });
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

  it("fails loud with MANIFEST_TAMPERED on a tampered manifest hash", async () => {
    const manifest = makeManifest();
    const tampered = {
      ...manifest,
      version: { ...manifest.version, manifest_sha256: "0".repeat(64) },
    };
    const baseUrl = await startMockControlPlane({ manifest: tampered });
    const agentHome = await makeAgentHome();

    const err = await runSetup({
      controlPlaneUrl: baseUrl,
      token: "catalog-token",
      roleKey: "quality_engineer",
      armProxyUrl: baseUrl,
      subAccountId: "sa_123",
      tenantId: TENANT_ID,
      agentHome,
    }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ArmClientError);
    expect((err as ArmClientError).code).toBe("MANIFEST_TAMPERED");
    expect((err as Error).message).toMatch(/integrity check FAILED/);
  });

  it("uses a pre-resolved manifest when supplied, skipping fetchManifest (the A4 token path seam)", async () => {
    // No /api/catalog/packages/... route registered — if runSetup tried to
    // fetch by roleKey it would 404. It must not, because args.manifest is set.
    const server = createServer((req, res) => {
      if (req.url === "/health") {
        res.statusCode = 200;
        res.end("{}");
        return;
      }
      res.statusCode = 404;
      res.end();
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    servers.push(server);
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const agentHome = await makeAgentHome();

    const manifest = makeManifest();
    const result = await runSetup({
      controlPlaneUrl: baseUrl,
      token: "unused",
      roleKey: manifest.package.role_key,
      armProxyUrl: baseUrl,
      subAccountId: "sa_123",
      tenantId: TENANT_ID,
      agentHome,
      manifest,
      pendingApproval: true,
    });

    expect(result.roleKey).toBe("quality_engineer");
    expect(result.pendingApproval).toBe(true);
  });
});
