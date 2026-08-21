/**
 * Smoke tests for `arm setup` — parser + routing only, zero network I/O.
 * The setup engine itself is covered by @arm/client-core's test suite.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { parseSetupArgs, runSetupCommand, DEFAULT_PROXY_URL } from "../src/index.js";
import type { SetupResult } from "@arm/client-core";

const STUB_RESULT: SetupResult = {
  online: true,
  healthMessage: "metered round-trip OK (HTTP 200)",
  roleKey: "quality_engineer",
  packageVersion: "1.0.0",
  tools: ["jira"],
  skills: ["8d-generator"],
  connectionsNeeded: [],
  configPath: "/tmp/opencode/config.json",
  envFilePath: "/tmp/opencode/.arm-env",
  budgetHint: "$150/month",
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("parseSetupArgs", () => {
  it("parses all flags", () => {
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

  it("accepts the minimal required flags", () => {
    expect(parseSetupArgs(["--role", "exec_assistant", "--tenant-url", "https://cp"])).toEqual({
      roleKey: "exec_assistant",
      tenantUrl: "https://cp",
    });
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
});

describe("runSetupCommand", () => {
  it("routes to the setup engine with parsed flags + ARM_TOKEN (no network)", async () => {
    vi.stubEnv("ARM_TOKEN", "catalog-token");
    vi.stubEnv("ARM_AGENT_TOKEN", "arm_mtr_env_token");
    const engine = vi.fn(async () => STUB_RESULT);

    const result = await runSetupCommand(
      [
        "--role",
        "quality_engineer",
        "--tenant-url",
        "https://cp.arm.acme.com",
        "--sub-account-id",
        "sa_123",
      ],
      engine,
    );

    expect(engine).toHaveBeenCalledTimes(1);
    expect(engine).toHaveBeenCalledWith({
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
    const engine = vi.fn(async () => STUB_RESULT);

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
      engine,
    );

    expect(engine).toHaveBeenCalledWith(
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
    const engine = vi.fn(async () => STUB_RESULT);

    const result = await runSetupCommand(["--role", "x", "--tenant-url", "https://cp"], engine);

    expect(warn).toHaveBeenCalledWith(expect.stringContaining("no agent token"));
    expect(engine).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "pending-assignment" }),
    );
    const callArgs = (engine.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect("agentToken" in callArgs).toBe(false);
    expect(result).toBe(STUB_RESULT);
  });

  it("passes --proxy-url and --agent-home through", async () => {
    vi.stubEnv("ARM_TOKEN", "catalog-token");
    const engine = vi.fn(async () => STUB_RESULT);

    await runSetupCommand(
      [
        "--role",
        "x",
        "--tenant-url",
        "https://cp",
        "--proxy-url",
        "https://proxy",
        "--agent-home",
        "/tmp/home",
      ],
      engine,
    );

    expect(engine).toHaveBeenCalledWith(
      expect.objectContaining({ armProxyUrl: "https://proxy", agentHome: "/tmp/home" }),
    );
  });

  it("returns null on malformed flags without invoking the engine", async () => {
    vi.stubEnv("ARM_TOKEN", "catalog-token");
    const engine = vi.fn(async () => STUB_RESULT);
    expect(await runSetupCommand(["--nope"], engine)).toBeNull();
    expect(engine).not.toHaveBeenCalled();
  });

  it("throws when ARM_TOKEN is missing", async () => {
    vi.stubEnv("ARM_TOKEN", "");
    const engine = vi.fn(async () => STUB_RESULT);
    await expect(
      runSetupCommand(["--role", "x", "--tenant-url", "https://cp"], engine),
    ).rejects.toThrow(/ARM_TOKEN/);
    expect(engine).not.toHaveBeenCalled();
  });
});
