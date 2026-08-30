import { describe, it, expect, afterEach } from "vitest";
import { startInstallWizardServer, type GuiServerHandle } from "../src/gui-server.js";
import type { SetupArgs, SetupResult } from "../src/setup.js";
import { makeManifest, TENANT_ID } from "./helpers.js";

const STUB_RESULT: SetupResult = {
  online: true,
  healthMessage: "metered round-trip OK (HTTP 200)",
  roleKey: "senior_manager",
  packageVersion: "1.0.0",
  components: ["jira", "kpi-briefing-generator"],
  installedPaths: [],
  connectionsNeeded: [
    { componentId: "c1", componentName: "jira", authMethod: "oauth", guideId: "jira-pat", requiredScopes: ["read:issue"] },
  ],
  configPath: "/tmp/opencode/config.json",
  budgetHint: "$300/month",
  pendingApproval: false,
  runtimesProvisioned: [],
};

describe("startInstallWizardServer", () => {
  let handle: GuiServerHandle | undefined;

  afterEach(async () => {
    await handle?.close();
    handle = undefined;
  });

  it("binds to 127.0.0.1 with an OS-assigned port and serves the wizard page", async () => {
    handle = await startInstallWizardServer({});
    expect(handle.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/);
    expect(handle.port).toBeGreaterThan(0);

    const res = await fetch(handle.url);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain("ARM Setup");
    expect(html).toContain("Activation code");
  });

  it("POST /api/redeem runs resolveFn -> runSetupFn and returns the result with rendered guide steps", async () => {
    let capturedRedeemArgs: { token: string; controlPlaneUrl: string } | undefined;
    let capturedSetupArgs: SetupArgs | undefined;
    handle = await startInstallWizardServer({
      resolveFn: async (args) => {
        capturedRedeemArgs = args;
        return {
          controlPlaneUrl: args.controlPlaneUrl,
          token: "catalog-token",
          roleKey: "senior_manager",
          armProxyUrl: "http://localhost:8787",
          subAccountId: "sa_1",
          tenantId: TENANT_ID,
          manifest: makeManifest(),
          pendingApproval: false,
        };
      },
      runSetupFn: async (args) => {
        capturedSetupArgs = args;
        return STUB_RESULT;
      },
    });

    const res = await fetch(new URL("/api/redeem", handle.url), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: "G7NHCF", controlPlaneUrl: "http://localhost:3300" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as SetupResult & { connectionsNeeded: Array<{ guideSteps: string[] }> };
    expect(body.roleKey).toBe("senior_manager");
    expect(capturedRedeemArgs).toEqual({ token: "G7NHCF", controlPlaneUrl: "http://localhost:3300" });
    expect(capturedSetupArgs?.roleKey).toBe("senior_manager");
    expect(body.connectionsNeeded[0]!.guideSteps.length).toBeGreaterThan(0);
  });

  it("POST /api/redeem returns a 400 when token or controlPlaneUrl is missing", async () => {
    handle = await startInstallWizardServer({});
    const res = await fetch(new URL("/api/redeem", handle.url), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: "G7NHCF" }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("BAD_REQUEST");
  });

  it("POST /api/redeem surfaces an ArmClientError as a structured 422, not a stack trace", async () => {
    const { ArmClientError } = await import("../src/errors.js");
    handle = await startInstallWizardServer({
      resolveFn: async () => {
        throw new ArmClientError("TOKEN_EXPIRED", "this setup link has expired");
      },
    });
    const res = await fetch(new URL("/api/redeem", handle.url), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: "STALE1", controlPlaneUrl: "http://localhost:3300" }),
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("TOKEN_EXPIRED");
    expect(body.error.message).toContain("expired");
  });

  it("POST /api/refine wires pain points, folder scan (only when a path is given), and always scans installed tools", async () => {
    let sawFolderScanCall = false;
    handle = await startInstallWizardServer({
      classifyPainPointsFn: (text) => [{ tag: "budget_approval_pain", jobFunctionHint: "senior_manager", matchedKeywords: [text] }],
      scanWorkFolderFn: async () => {
        sawFolderScanCall = true;
        return { filesScanned: 3, extensionCounts: { ".xlsx": 3 }, tags: ["spreadsheet_heavy"] };
      },
      scanInstalledToolsFn: async () => [{ id: "vscode", label: "Visual Studio Code", componentSlug: "vscode" }],
    });

    const res = await fetch(new URL("/api/refine", handle.url), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ painPoints: "budget approvals", folderPath: "/Users/alice/work" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      painPointTags: unknown[];
      folderScan: { tags: string[] };
      installedTools: unknown[];
    };
    expect(body.painPointTags).toHaveLength(1);
    expect(body.folderScan.tags).toEqual(["spreadsheet_heavy"]);
    expect(body.installedTools).toHaveLength(1);
    expect(sawFolderScanCall).toBe(true);
  });

  it("POST /api/refine skips the folder scan when no folderPath is given", async () => {
    let sawFolderScanCall = false;
    handle = await startInstallWizardServer({
      scanWorkFolderFn: async () => {
        sawFolderScanCall = true;
        return { filesScanned: 0, extensionCounts: {}, tags: [] };
      },
      scanInstalledToolsFn: async () => [],
    });
    const res = await fetch(new URL("/api/refine", handle.url), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const body = (await res.json()) as { folderScan?: unknown };
    expect(body.folderScan).toBeUndefined();
    expect(sawFolderScanCall).toBe(false);
  });

  it("POST /api/pick-folder returns the injected picker's result", async () => {
    handle = await startInstallWizardServer({ pickFolderFn: async () => "/Users/alice/Documents/work" });
    const res = await fetch(new URL("/api/pick-folder", handle.url), { method: "POST" });
    const body = (await res.json()) as { path: string | null };
    expect(body.path).toBe("/Users/alice/Documents/work");
  });

  it("returns 404 for an unknown route", async () => {
    handle = await startInstallWizardServer({});
    const res = await fetch(new URL("/api/nonexistent", handle.url), { method: "POST" });
    expect(res.status).toBe(404);
  });
});
