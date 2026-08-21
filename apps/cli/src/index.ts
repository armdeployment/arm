/**
 * ARM CLI (spec §9 1.2, D9 Phase 1.6).
 *
 * Commands:
 *   arm data-plane install   Register tenant → pull delegate key → render chart → apply.
 *   arm agent init           Detect agent type → write config → verify metered round-trip.
 *   arm setup                One-click employee provisioning: fetch the role's work-package
 *                            manifest from the control plane, verify integrity, write the
 *                            opencode config (env-var credential references only), and
 *                            verify a metered round-trip through the ARM proxy.
 *
 * `arm setup` shares its engine with the ARM Desktop wizard — everything
 * lives in @arm/client-core (roadmap §5: one engine, three shapes).
 */

import { runSetup, renderGuideSteps, type SetupArgs, type SetupResult } from "@arm/client-core";

/** Default data-plane proxy address when --proxy-url is omitted. */
export const DEFAULT_PROXY_URL = "http://localhost:8787";

/** Parsed `arm setup` flags. */
export interface SetupCliArgs {
  roleKey: string;
  tenantUrl: string;
  proxyUrl?: string;
  subAccountId?: string;
  tenantId?: string;
  agentHome?: string;
  agentToken?: string;
}

/**
 * Parse the `arm setup` flag list. Returns null for malformed input so the
 * caller can print usage instead of guessing.
 */
export function parseSetupArgs(argv: string[]): SetupCliArgs | null {
  const values: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === undefined || !flag.startsWith("--") || value === undefined) {
      return null;
    }
    values[flag] = value;
  }
  const roleKey = values["--role"];
  const tenantUrl = values["--tenant-url"];
  if (!roleKey || !tenantUrl) {
    return null;
  }
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

export type RunSetupFn = (args: SetupArgs) => Promise<SetupResult>;

/**
 * Route `arm setup` to the client-core engine. The run function is injectable
 * so tests (and the Desktop wizard) can exercise routing without network I/O.
 * Returns null when flags are malformed; throws when ARM_TOKEN is missing.
 *
 * The metered agent token comes from `--agent-token` or the ARM_AGENT_TOKEN
 * env var (short-lived, minted by the control plane — never written into the
 * config JSON). A warning is printed when absent: setup still completes, but
 * the metered round-trip degrades to a reachability check.
 */
export async function runSetupCommand(
  args: string[],
  runSetupFn: RunSetupFn = runSetup,
): Promise<SetupResult | null> {
  const parsed = parseSetupArgs(args);
  if (!parsed) {
    return null;
  }
  const token = process.env["ARM_TOKEN"];
  if (!token) {
    throw new Error("ARM_TOKEN env var is required for `arm setup`");
  }
  const agentToken = (parsed.agentToken ?? process.env["ARM_AGENT_TOKEN"]) || undefined;
  if (!agentToken) {
    console.warn(
      "arm setup: no agent token (--agent-token / ARM_AGENT_TOKEN) — the metered round-trip will be skipped; re-run with a control-plane minted token to verify metering",
    );
  }
  return runSetupFn({
    controlPlaneUrl: parsed.tenantUrl,
    token,
    roleKey: parsed.roleKey,
    armProxyUrl: parsed.proxyUrl ?? DEFAULT_PROXY_URL,
    subAccountId: parsed.subAccountId ?? "pending-assignment",
    tenantId: parsed.tenantId ?? "pending-assignment",
    ...(parsed.agentHome !== undefined ? { agentHome: parsed.agentHome } : {}),
    ...(agentToken !== undefined ? { agentToken } : {}),
  });
}

/** Friendly human summary of a completed setup — role, tools, connections. */
export function printSetupSummary(result: SetupResult): void {
  console.log(
    [
      "",
      `ARM Setup ${result.online ? "Complete — Online" : "Complete — Proxy Offline"}`,
      "──────────────────────────────────────────────────────",
      `  Role:       ${result.roleKey}`,
      `  Package:    ${result.roleKey}@${result.packageVersion}`,
      `  Budget:     ${result.budgetHint}`,
      `  Config:     ${result.configPath}`,
      ...(result.envFilePath !== undefined
        ? [`  Env file:   ${result.envFilePath} (ARM_AGENT_TOKEN, 0o600)`]
        : []),
      `  Tools:      ${result.tools.join(", ") || "(none)"}`,
      `  Skills:     ${result.skills.join(", ") || "(none)"}`,
    ].join("\n"),
  );

  if (result.connectionsNeeded.length > 0) {
    console.log("\nConnections needed:");
    for (const entry of result.connectionsNeeded) {
      console.log(`  • ${entry.toolName} (${entry.authMethod})`);
      console.log(`    Scopes: ${entry.requiredScopes.join(", ") || "(none)"}`);
      for (const step of renderGuideSteps(entry)) {
        console.log(`    ${step}`);
      }
    }
  } else {
    console.log("\nConnections needed: none");
  }

  console.log(`\n  Health: ${result.healthMessage}\n`);
}

export async function main(args: string[]): Promise<void> {
  const cmd = args[2] ?? "help";

  switch (cmd) {
    case "setup": {
      try {
        const result = await runSetupCommand(args.slice(3));
        if (!result) {
          console.log(`
ARM Setup — one-click employee provisioning (D9 Phase 1.6)
──────────────────────────────────────────────────────────
  Fetch the role's work-package manifest, verify integrity,
  write the opencode config, and verify a metered round-trip.

  Usage: arm setup --role <key> --tenant-url <url>
         [--proxy-url <url>] [--sub-account-id <id>] [--tenant-id <id>]
         [--agent-home <dir>] [--agent-token <token>]

  Requires ARM_TOKEN (control-plane catalog access).
  Agent token: --agent-token or ARM_AGENT_TOKEN (control-plane minted,
  short-lived; written to <agent-home>/.arm-env with mode 0600).
          `);
        } else {
          printSetupSummary(result);
        }
      } catch (err) {
        console.error(`arm setup failed: ${err instanceof Error ? err.message : String(err)}`);
      }
      break;
    }

    case "data-plane":
      console.log(`
ARM Data Plane Installer (spec §9 1.2)
──────────────────────────────────────
  1. Register tenant with control plane
  2. Pull delegate key
  3. Render Helm chart with tenant config
  4. Apply to cluster

  Usage: arm data-plane install [--tenant-id <id>] [--provider <aws|gcp|azure>]
  Stub: real installation lands with Helm chart packaging.
      `);
      break;

    case "agent":
      console.log(`
ARM Agent Init (spec §8.1)
─────────────────────────
  Detect agent type → write config → verify metered round-trip.

  Supported agent types: opencode, claude code, copilot, Pi
  Discovery: /.well-known/arm-agent

  Usage: arm agent init [--type <type>] [--tenant-id <id>]
  Stub: real onboarding lands with data-plane proxy.
      `);
      break;

    default:
      console.log(`
ARM CLI — Agent Resource Management
───────────────────────────────────
  arm setup                One-click role provisioning (D9 Phase 1.6)
  arm data-plane install   Install data plane in customer VPC
  arm agent init           Onboard an agent to ARM
  arm help                 Show this help
      `);
  }
}

// Run from command line
if (process.argv[1]?.endsWith("arm") || process.argv[1]?.includes("cli")) {
  void main(process.argv);
}
