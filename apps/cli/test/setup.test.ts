/**
 * Smoke tests for `arm setup` / `arm doctor` — parser + routing only, zero
 * network I/O. The setup/token engines themselves are covered by
 * @arm/client-core's test suite.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import {
  parseSetupArgs,
  runSetupCommand,
  runDoctorChecks,
  DEFAULT_PROXY_URL,
} from "../src/index.js";
import type { SetupArgs, SetupResult } from "@arm/client-core";

const STUB_RESULT: SetupResult = {
  online: true,
  healthMessage: "metered round-trip OK (HTTP 200)",
  roleKey: "quality_engineer",
  packageVersion: "1.0.0",
  components: ["jira", "8d-generator"],
  installedPaths: ["/tmp/opencode/skills/8d-generator"],
  connectionsNeeded: [],
  configPath: "/tmp/opencode/config.json",
  envFilePath: "/tmp/opencode/.arm-env",
  budgetHint: "$150/month",
  pendingApproval: false,
  runtimesProvisioned: [],
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("parseSetupArgs", () => {
  it("parses all advanced flags", () => {
    expect(
      parseSetupArgs([
        "--role",
        "quality_engineer",
        "--tenant-url",
        "https://cp.arm.acme.com",
        "--proxy-url",
        "https://data.arm.acme.com",
        "--sub-account-id",
        "sa_123",
        "--tenant-id",
        "99999999-9999-4999-8999-999999999999",
        "--agent-home",
        "/home/alice/.config/opencode",
        "--agent-token",
        "arm_mtr_token",
      ]),
    ).toEqual({
      roleKey: "quality_engineer",
      tenantUrl: "https://cp.arm.acme.com",
      proxyUrl: "https://data.arm.acme.com",
      subAccountId: "sa_123",
      tenantId: "99999999-9999-4999-8999-999999999999",
      agentHome: "/home/alice/.config/opencode",
      agentToken: "arm_mtr_token",
    });
  });

  it("accepts the minimal required advanced flags", () => {
    expect(parseSetupArgs(["--role", "exec_assistant", "--tenant-url", "https://cp"])).toEqual({
      roleKey: "exec_assistant",
      tenantUrl: "https://cp",
    });
  });

  it("parses the --token primary path", () => {
    expect(parseSetupArgs(["--token", "AB12CD", "--tenant-url", "https://cp"])).toEqual({
      token: "AB12CD",
      tenantUrl: "https://cp",
    });
  });

  it("rejects --token without --tenant-url", () => {
    expect(parseSetupArgs(["--token", "AB12CD"])).toBeNull();
  });

  it("rejects a missing required flag", () => {
    expect(parseSetupArgs(["--role", "quality_engineer"])).toBeNull();
    expect(parseSetupArgs(["--tenant-url", "https://cp"])).toBeNull();
  });

  it("rejects malformed flag lists", () => {
    expect(parseSetupArgs(["--role"])).toBeNull();
    expect(parseSetupArgs(["--role", "x", "garbage"])).toBeNull();
    expect(parseSetupArgs([])).toBeNull();
  });

  it("parses --setup-file alone (no --tenant-url needed — the file carries it)", () => {
    expect(parseSetupArgs(["--setup-file", "/tmp/arm-setup.armsetup"])).toEqual({
      setupFile: "/tmp/arm-setup.armsetup",
    });
  });
});

describe("runSetupCommand — advanced (--role) path", () => {
  it("routes to the setup engine with parsed flags + ARM_TOKEN (no network)", async () => {
    vi.stubEnv("ARM_TOKEN", "catalog-token");
    vi.stubEnv("ARM_AGENT_TOKEN", "arm_mtr_env_token");
    const runSetupFn = vi.fn(async () => STUB_RESULT);

    const result = await runSetupCommand(
      ["--role", "quality_engineer", "--tenant-url", "https://cp.arm.acme.com", "--sub-account-id", "sa_123"],
      { runSetupFn },
    );

    expect(runSetupFn).toHaveBeenCalledTimes(1);
    expect(runSetupFn).toHaveBeenCalledWith({
      controlPlaneUrl: "https://cp.arm.acme.com",
      token: "catalog-token",
      roleKey: "quality_engineer",
      armProxyUrl: DEFAULT_PROXY_URL,
      subAccountId: "sa_123",
      tenantId: "pending-assignment",
      agentToken: "arm_mtr_env_token",
    });
    expect(result).toBe(STUB_RESULT);
  });

  it("prefers --agent-token over the ARM_AGENT_TOKEN env var", async () => {
    vi.stubEnv("ARM_TOKEN", "catalog-token");
    vi.stubEnv("ARM_AGENT_TOKEN", "arm_mtr_env_token");
    const runSetupFn = vi.fn(async () => STUB_RESULT);

    await runSetupCommand(
      [
        "--role",
        "x",
        "--tenant-url",
        "https://cp",
        "--tenant-id",
        "99999999-9999-4999-8999-999999999999",
        "--agent-token",
        "arm_mtr_flag_token",
      ],
      { runSetupFn },
    );

    expect(runSetupFn).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "99999999-9999-4999-8999-999999999999",
        agentToken: "arm_mtr_flag_token",
      }),
    );
  });

  it("warns (and still routes) when no agent token is available", async () => {
    vi.stubEnv("ARM_TOKEN", "catalog-token");
    vi.stubEnv("ARM_AGENT_TOKEN", "");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const runSetupFn = vi.fn(async () => STUB_RESULT);

    const result = await runSetupCommand(["--role", "x", "--tenant-url", "https://cp"], { runSetupFn });

    expect(warn).toHaveBeenCalledWith(expect.stringContaining("no agent token"));
    expect(runSetupFn).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "pending-assignment" }));
    const callArgs = (runSetupFn.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect("agentToken" in callArgs).toBe(false);
    expect(result).toBe(STUB_RESULT);
  });

  it("passes --proxy-url and --agent-home through", async () => {
    vi.stubEnv("ARM_TOKEN", "catalog-token");
    const runSetupFn = vi.fn(async () => STUB_RESULT);

    await runSetupCommand(
      ["--role", "x", "--tenant-url", "https://cp", "--proxy-url", "https://proxy", "--agent-home", "/tmp/home"],
      { runSetupFn },
    );

    expect(runSetupFn).toHaveBeenCalledWith(
      expect.objectContaining({ armProxyUrl: "https://proxy", agentHome: "/tmp/home" }),
    );
  });

  it("returns null on malformed flags without invoking the engine", async () => {
    vi.stubEnv("ARM_TOKEN", "catalog-token");
    const runSetupFn = vi.fn(async () => STUB_RESULT);
    expect(await runSetupCommand(["--nope"], { runSetupFn })).toBeNull();
    expect(runSetupFn).not.toHaveBeenCalled();
  });

  it("throws when ARM_TOKEN is missing", async () => {
    vi.stubEnv("ARM_TOKEN", "");
    const runSetupFn = vi.fn(async () => STUB_RESULT);
    await expect(
      runSetupCommand(["--role", "x", "--tenant-url", "https://cp"], { runSetupFn }),
    ).rejects.toThrow(/ARM_TOKEN/);
    expect(runSetupFn).not.toHaveBeenCalled();
  });
});

describe("runSetupCommand — --token (A4 primary) path", () => {
  it("redeems the token and routes the resolved SetupArgs to the engine", async () => {
    const resolved: SetupArgs = {
      controlPlaneUrl: "https://cp.arm.acme.com",
      token: "catalog-token-from-redemption",
      roleKey: "quality_engineer",
      armProxyUrl: "https://data.arm.acme.com",
      subAccountId: "sa_123",
      tenantId: "tn_1",
    };
    const resolveFn = vi.fn(async () => resolved);
    const runSetupFn = vi.fn(async () => STUB_RESULT);

    const result = await runSetupCommand(
      ["--token", "AB12CD", "--tenant-url", "https://cp.arm.acme.com"],
      { resolveFn, runSetupFn },
    );

    expect(resolveFn).toHaveBeenCalledWith({
      token: "AB12CD",
      controlPlaneUrl: "https://cp.arm.acme.com",
    });
    expect(runSetupFn).toHaveBeenCalledWith(resolved);
    expect(result).toBe(STUB_RESULT);
  });

  it("threads --agent-home / --agent-token through to the engine (regression: these were silently dropped on this path)", async () => {
    const resolved: SetupArgs = {
      controlPlaneUrl: "https://cp.arm.acme.com",
      token: "catalog-token-from-redemption",
      roleKey: "quality_engineer",
      armProxyUrl: "https://data.arm.acme.com",
      subAccountId: "sa_123",
      tenantId: "tn_1",
    };
    const resolveFn = vi.fn(async () => resolved);
    const runSetupFn = vi.fn(async () => STUB_RESULT);

    await runSetupCommand(
      [
        "--token", "AB12CD",
        "--tenant-url", "https://cp.arm.acme.com",
        "--agent-home", "/tmp/smoke-agent-home",
        "--agent-token", "arm_mtr_dev_token",
      ],
      { resolveFn, runSetupFn },
    );

    expect(runSetupFn).toHaveBeenCalledWith({
      ...resolved,
      agentHome: "/tmp/smoke-agent-home",
      agentToken: "arm_mtr_dev_token",
    });
  });

  it("does not require ARM_TOKEN for the token path", async () => {
    vi.stubEnv("ARM_TOKEN", "");
    const resolved: SetupArgs = {
      controlPlaneUrl: "https://cp",
      token: "t",
      roleKey: "r",
      armProxyUrl: "https://proxy",
      subAccountId: "sa",
      tenantId: "tn",
    };
    const resolveFn = vi.fn(async () => resolved);
    const runSetupFn = vi.fn(async () => STUB_RESULT);
    const result = await runSetupCommand(["--token", "code12", "--tenant-url", "https://cp"], {
      resolveFn,
      runSetupFn,
    });
    expect(result).toBe(STUB_RESULT);
  });
});

describe("runSetupCommand — --setup-file (.armsetup double-click) path", () => {
  const tempFiles: string[] = [];
  afterEach(async () => {
    const { rm } = await import("node:fs/promises");
    for (const f of tempFiles.splice(0)) await rm(f, { force: true });
  });

  async function writeSetupFile(content: unknown): Promise<string> {
    const { writeFile, mkdtemp } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const dir = await mkdtemp(join(tmpdir(), "arm-cli-setupfile-"));
    const path = join(dir, "arm-setup.armsetup");
    await writeFile(path, JSON.stringify(content));
    tempFiles.push(path);
    return path;
  }

  it("reads {version, token, control_plane_url} from the file and redeems it", async () => {
    const path = await writeSetupFile({ version: 1, token: "ABC123", control_plane_url: "https://cp.arm.acme.com" });
    const resolved: SetupArgs = {
      controlPlaneUrl: "https://cp.arm.acme.com",
      token: "catalog-token",
      roleKey: "quality_engineer",
      armProxyUrl: "https://proxy",
      subAccountId: "sa",
      tenantId: "tn",
    };
    const resolveFn = vi.fn(async () => resolved);
    const runSetupFn = vi.fn(async () => STUB_RESULT);

    const result = await runSetupCommand(["--setup-file", path], { resolveFn, runSetupFn });

    expect(resolveFn).toHaveBeenCalledWith({ token: "ABC123", controlPlaneUrl: "https://cp.arm.acme.com" });
    expect(result).toBe(STUB_RESULT);
  });

  it("threads --agent-home through when set alongside --setup-file", async () => {
    const path = await writeSetupFile({ version: 1, token: "ABC123", control_plane_url: "https://cp.arm.acme.com" });
    const resolved: SetupArgs = {
      controlPlaneUrl: "https://cp.arm.acme.com",
      token: "catalog-token",
      roleKey: "quality_engineer",
      armProxyUrl: "https://proxy",
      subAccountId: "sa",
      tenantId: "tn",
    };
    const resolveFn = vi.fn(async () => resolved);
    const runSetupFn = vi.fn(async () => STUB_RESULT);

    await runSetupCommand(["--setup-file", path, "--agent-home", "/tmp/smoke-agent-home"], {
      resolveFn,
      runSetupFn,
    });

    expect(runSetupFn).toHaveBeenCalledWith({ ...resolved, agentHome: "/tmp/smoke-agent-home" });
  });

  it("throws a clear error when the file doesn't exist", async () => {
    const resolveFn = vi.fn();
    await expect(
      runSetupCommand(["--setup-file", "/nonexistent/path.armsetup"], { resolveFn }),
    ).rejects.toThrow(/could not read setup file/);
    expect(resolveFn).not.toHaveBeenCalled();
  });

  it("throws a clear error when the file isn't a valid .armsetup shape", async () => {
    const path = await writeSetupFile({ nope: true });
    const resolveFn = vi.fn();
    await expect(runSetupCommand(["--setup-file", path], { resolveFn })).rejects.toThrow(
      /not a valid \.armsetup file/,
    );
    expect(resolveFn).not.toHaveBeenCalled();
  });
});

describe("runSetupCommand — interactive (no arguments)", () => {
  it("prompts for an activation code + tenant URL, then redeems + installs", async () => {
    const resolved: SetupArgs = {
      controlPlaneUrl: "https://cp.arm.acme.com",
      token: "catalog-token",
      roleKey: "quality_engineer",
      armProxyUrl: "https://data.arm.acme.com",
      subAccountId: "sa_123",
      tenantId: "tn_1",
    };
    const resolveFn = vi.fn(async () => resolved);
    const runSetupFn = vi.fn(async () => STUB_RESULT);
    const promptFn = vi
      .fn()
      .mockResolvedValueOnce("AB12CD")
      .mockResolvedValueOnce("https://cp.arm.acme.com");

    const result = await runSetupCommand([], { resolveFn, runSetupFn, promptFn });

    expect(promptFn).toHaveBeenCalledTimes(2);
    expect(resolveFn).toHaveBeenCalledWith({
      token: "AB12CD",
      controlPlaneUrl: "https://cp.arm.acme.com",
    });
    expect(result).toBe(STUB_RESULT);
  });

  it("uses ARM_TENANT_URL and skips the URL prompt when set", async () => {
    vi.stubEnv("ARM_TENANT_URL", "https://cp.from-env.com");
    const resolved: SetupArgs = {
      controlPlaneUrl: "https://cp.from-env.com",
      token: "t",
      roleKey: "r",
      armProxyUrl: "https://proxy",
      subAccountId: "sa",
      tenantId: "tn",
    };
    const resolveFn = vi.fn(async () => resolved);
    const runSetupFn = vi.fn(async () => STUB_RESULT);
    const promptFn = vi.fn().mockResolvedValueOnce("AB12CD");

    await runSetupCommand([], { resolveFn, runSetupFn, promptFn });

    expect(promptFn).toHaveBeenCalledTimes(1);
    expect(resolveFn).toHaveBeenCalledWith({
      token: "AB12CD",
      controlPlaneUrl: "https://cp.from-env.com",
    });
  });

  it("returns null without redeeming when the activation code is left blank", async () => {
    const resolveFn = vi.fn();
    const runSetupFn = vi.fn();
    const promptFn = vi.fn().mockResolvedValueOnce("").mockResolvedValueOnce("https://cp");

    const result = await runSetupCommand([], { resolveFn, runSetupFn, promptFn });

    expect(result).toBeNull();
    expect(resolveFn).not.toHaveBeenCalled();
  });
});

describe("runDoctorChecks", () => {
  const servers: Server[] = [];
  afterEach(async () => {
    for (const server of servers.splice(0)) {
      server.close();
      await Promise.race([once(server, "close"), new Promise((r) => setTimeout(r, 250))]);
    }
  });

  it("reports skipped when no proxy URL is known", async () => {
    vi.stubEnv("ARM_PROXY_URL", "");
    const checks = await runDoctorChecks();
    expect(checks.some((c) => c.status === "skipped")).toBe(true);
  });

  it("reports fail with PROXY_UNREACHABLE when the proxy cannot be reached at all", async () => {
    const checks = await runDoctorChecks({ proxyUrl: "http://127.0.0.1:1" });
    const check = checks.find((c) => c.label === "Metered round-trip")!;
    expect(check.status).toBe("fail");
    expect(check.code).toBe("PROXY_UNREACHABLE");
  });

  it("reports fail with NO_AGENT_TOKEN when the proxy is reachable but no agent token was given", async () => {
    const server = createServer((_req, res) => {
      res.statusCode = 200;
      res.end("{}");
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    servers.push(server);
    const proxyUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    const checks = await runDoctorChecks({ proxyUrl });
    const check = checks.find((c) => c.label === "Metered round-trip")!;
    expect(check.status).toBe("fail");
    expect(check.code).toBe("NO_AGENT_TOKEN");
  });

  it("reports ok when the proxy is reachable with an agent token", async () => {
    const server = createServer((_req, res) => {
      res.statusCode = 200;
      res.end("{}");
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    servers.push(server);
    const proxyUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    const checks = await runDoctorChecks({ proxyUrl, agentToken: "arm_mtr_x" });
    const check = checks.find((c) => c.label === "Metered round-trip")!;
    expect(check.status).toBe("ok");
  });
});
