#!/usr/bin/env node
/**
 * @arm/client-core CLI entry (bin: arm-client).
 *
 * Thin headless alias for one-click provisioning — the full interactive CLI
 * lives in apps/cli (`arm setup`); the Desktop wizard uses the same engine.
 * Usage: arm-client --role <key> --tenant-url <url> [--proxy-url <url>]
 *         [--sub-account-id <id>] [--tenant-id <id>] [--agent-home <dir>]
 *         [--agent-token <token>]
 * Requires ARM_TOKEN in the environment. The metered agent token comes from
 * --agent-token or ARM_AGENT_TOKEN (a warning is printed when absent — the
 * setup still completes, but the metered round-trip degrades to a
 * reachability check).
 */

import { runSetup } from "./setup.js";

function parseArgs(argv: string[]): {
  roleKey: string;
  tenantUrl: string;
  proxyUrl?: string;
  subAccountId?: string;
  tenantId?: string;
  agentHome?: string;
  agentToken?: string;
} | null {
  const values: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === undefined || !flag.startsWith("--") || value === undefined) return null;
    values[flag] = value;
  }
  const roleKey = values["--role"];
  const tenantUrl = values["--tenant-url"];
  if (!roleKey || !tenantUrl) return null;
  return {
    roleKey,
    tenantUrl,
    ...(values["--proxy-url"] !== undefined ? { proxyUrl: values["--proxy-url"] } : {}),
    ...(values["--sub-account-id"] !== undefined
      ? { subAccountId: values["--sub-account-id"] }
      : {}),
    ...(values["--tenant-id"] !== undefined ? { tenantId: values["--tenant-id"] } : {}),
    ...(values["--agent-home"] !== undefined ? { agentHome: values["--agent-home"] } : {}),
    ...(values["--agent-token"] !== undefined ? { agentToken: values["--agent-token"] } : {}),
  };
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));
  if (!parsed) {
    console.error(
      "usage: arm-client --role <key> --tenant-url <url> [--proxy-url <url>] [--sub-account-id <id>] [--tenant-id <id>] [--agent-home <dir>] [--agent-token <token>]",
    );
    process.exitCode = 2;
    return;
  }
  const token = process.env["ARM_TOKEN"];
  if (!token) {
    console.error("ARM_TOKEN env var is required");
    process.exitCode = 2;
    return;
  }
  const agentToken = (parsed.agentToken ?? process.env["ARM_AGENT_TOKEN"]) || undefined;
  if (!agentToken) {
    console.warn(
      "arm-client: no agent token (--agent-token / ARM_AGENT_TOKEN) — the metered round-trip will be skipped; re-run with a control-plane minted token to verify metering",
    );
  }
  try {
    const result = await runSetup({
      controlPlaneUrl: parsed.tenantUrl,
      token,
      roleKey: parsed.roleKey,
      armProxyUrl: parsed.proxyUrl ?? "http://localhost:8787",
      subAccountId: parsed.subAccountId ?? "pending-assignment",
      tenantId: parsed.tenantId ?? "pending-assignment",
      ...(parsed.agentHome !== undefined ? { agentHome: parsed.agentHome } : {}),
      ...(agentToken !== undefined ? { agentToken } : {}),
    });
    console.log(
      `arm-client: ${result.roleKey}@${result.packageVersion} → ${result.configPath} (${result.online ? "online" : "proxy offline"})`,
    );
    if (result.envFilePath !== undefined) {
      console.log(`arm-client: agent token env file → ${result.envFilePath}`);
    }
  } catch (err) {
    console.error(`arm-client failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  }
}

if (process.argv[1]?.endsWith("arm-client") || process.argv[1]?.includes("cli-entry")) {
  void main();
}
