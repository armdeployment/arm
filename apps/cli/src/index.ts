/**
 * ARM CLI (spec §9 1.2, D9 Phase 1.6, updated D10 for the A4 token path —
 * docs/guides/03-client-downloader.md §6).
 *
 * Commands:
 *   arm setup --token <jwt|code>   Primary path (A4): redeem a signed setup
 *                                  token or 6-char activation code, then
 *                                  install — no role key, no flags.
 *   arm setup --setup-file <path>  The double-click target: reads
 *                                  {version, token, control_plane_url} from
 *                                  a downloaded .armsetup file (registered
 *                                  by the platform installer) and runs the
 *                                  same A4 path with no terminal input.
 *   arm setup                      No arguments: prints the tenant's
 *                                  /start URL and prompts for an activation
 *                                  code interactively.
 *   arm setup --role <key> --tenant-url <url> [...]
 *                                  Advanced/CI path (retained) — direct
 *                                  role-key provisioning, unchanged wire
 *                                  behaviour from D9 Phase 1.6.
 *   arm doctor                     Re-run verification and print the
 *                                  failure taxonomy with fixes.
 *   arm data-plane install         Register tenant → pull delegate key → render chart → apply.
 *   arm agent init                 Detect agent type → write config → verify metered round-trip.
 *
 * `arm setup` shares its engine with any future platform installer —
 * everything lives in @arm/client-core (roadmap §5: one engine, every shape).
 */

import {
  runSetup,
  resolveFromSetupToken,
  renderGuideSteps,
  verifyMeteredRoundTrip,
  ARM_ERROR_CODES,
  ARM_ERROR_FIXES,
  ArmClientError,
  type SetupArgs,
  type SetupResult,
  type ArmErrorCode,
} from "@arm/client-core";

/** Default data-plane proxy address when --proxy-url is omitted. */
export const DEFAULT_PROXY_URL = "http://localhost:8787";

/** Parsed `arm setup` flags — `token` (A4 primary path), `setupFile` (the
 *  double-click `.armsetup` path, also A4), or `roleKey`+`tenantUrl` (advanced). */
export interface SetupCliArgs {
  roleKey?: string;
  tenantUrl?: string;
  token?: string;
  setupFile?: string;
  proxyUrl?: string;
  subAccountId?: string;
  tenantId?: string;
  agentHome?: string;
  agentToken?: string;
}

/**
 * Parse the `arm setup` flag list. Returns null for malformed or
 * insufficient input so the caller can print usage instead of guessing.
 * A truly empty argv is handled separately by the caller (interactive mode,
 * guide 03 §6) — it never reaches this function's "malformed" path via
 * `runSetupCommand`, but calling it directly with `[]` still yields `null`
 * (no flags parsed).
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
  const token = values["--token"];
  const setupFile = values["--setup-file"];

  if (setupFile === undefined && token === undefined && (!roleKey || !tenantUrl)) return null;
  if (token !== undefined && !tenantUrl) return null; // token path still needs to know where to redeem

  return {
    ...(roleKey !== undefined ? { roleKey } : {}),
    ...(tenantUrl !== undefined ? { tenantUrl } : {}),
    ...(token !== undefined ? { token } : {}),
    ...(setupFile !== undefined ? { setupFile } : {}),
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
export type ResolveFromSetupTokenFn = typeof resolveFromSetupToken;
export type PromptFn = (question: string) => Promise<string>;

/** Injectable seams so tests exercise routing without network I/O or a real TTY. */
export interface SetupCommandDeps {
  runSetupFn?: RunSetupFn;
  resolveFn?: ResolveFromSetupTokenFn;
  promptFn?: PromptFn;
}

async function defaultPrompt(question: string): Promise<string> {
  const { createInterface } = await import("node:readline/promises");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

/** The `.armsetup` companion file's shape (guide 03 §7): `{version, token,
 *  control_plane_url}`. Registered to the client's file handler by the
 *  platform installer (packaging/windows/arm.wxs, packaging/macos/…) so a
 *  double-click runs setup with no terminal (A4/A7). */
interface ArmSetupFile {
  version: number;
  token: string;
  control_plane_url: string;
}

function isArmSetupFile(value: unknown): value is ArmSetupFile {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { version?: unknown }).version === "number" &&
    typeof (value as { token?: unknown }).token === "string" &&
    typeof (value as { control_plane_url?: unknown }).control_plane_url === "string"
  );
}

/**
 * Route `arm setup` to the client-core engine. Four paths:
 *   1. No arguments — interactive: prompt for an activation code (+ the
 *      tenant URL, if ARM_TENANT_URL isn't set), then redeem + install
 *      (A4 primary path, no role key, no flags, no config file).
 *   2. `--token <jwt|code>` — the same A4 path, non-interactive.
 *   3. `--setup-file <path>` — the double-click `.armsetup` path: same A4
 *      path, reading `{version, token, control_plane_url}` from the file
 *      the platform installer registered as its file handler.
 *   4. `--role <key> --tenant-url <url>` — the advanced/CI path, unchanged
 *      wire behaviour from D9 Phase 1.6 (requires ARM_TOKEN).
 * Returns null when flags are malformed; throws on hard failures.
 */
export async function runSetupCommand(
  args: string[],
  deps: SetupCommandDeps = {},
): Promise<SetupResult | null> {
  const runSetupFn = deps.runSetupFn ?? runSetup;
  const resolveFn = deps.resolveFn ?? resolveFromSetupToken;
  const promptFn = deps.promptFn ?? defaultPrompt;

  if (args.length === 0) {
    const envTenantUrl = process.env["ARM_TENANT_URL"];
    if (envTenantUrl) {
      console.log(
        `\nOpen ${envTenantUrl.replace(/\/+$/, "")}/start to get your setup link, or enter the 6-character activation code your admin gave you below.\n`,
      );
    } else {
      console.log(
        "\nAsk your IT team for your company's ARM setup link, or enter your activation code and company ARM URL below.\n",
      );
    }
    const code = await promptFn("Activation code: ");
    const tenantUrl = envTenantUrl ?? (await promptFn("ARM setup URL (e.g. https://arm.acme.com): "));
    if (!code.trim() || !tenantUrl.trim()) {
      console.error("arm setup: an activation code and a setup URL are required");
      return null;
    }
    const resolved = await resolveFn({ token: code.trim(), controlPlaneUrl: tenantUrl.trim() });
    return runSetupFn(resolved);
  }

  const parsed = parseSetupArgs(args);
  if (!parsed) {
    return null;
  }

  if (parsed.setupFile !== undefined) {
    const { readFile } = await import("node:fs/promises");
    let raw: unknown;
    try {
      raw = JSON.parse(await readFile(parsed.setupFile, "utf8"));
    } catch (err) {
      throw new Error(
        `could not read setup file "${parsed.setupFile}": ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    if (!isArmSetupFile(raw)) {
      throw new Error(`"${parsed.setupFile}" is not a valid .armsetup file (expected {version, token, control_plane_url})`);
    }
    const resolved = await resolveFn({ token: raw.token, controlPlaneUrl: raw.control_plane_url });
    return runSetupFn({
      ...resolved,
      ...(parsed.agentHome !== undefined ? { agentHome: parsed.agentHome } : {}),
      ...(parsed.agentToken !== undefined ? { agentToken: parsed.agentToken } : {}),
    });
  }

  if (parsed.token !== undefined) {
    const resolved = await resolveFn({ token: parsed.token, controlPlaneUrl: parsed.tenantUrl! });
    return runSetupFn({
      ...resolved,
      ...(parsed.agentHome !== undefined ? { agentHome: parsed.agentHome } : {}),
      ...(parsed.agentToken !== undefined ? { agentToken: parsed.agentToken } : {}),
    });
  }

  // Advanced/CI path — direct role-key provisioning.
  const token = process.env["ARM_TOKEN"];
  if (!token) {
    throw new Error("ARM_TOKEN env var is required for `arm setup --role` (advanced path)");
  }
  const agentToken = (parsed.agentToken ?? process.env["ARM_AGENT_TOKEN"]) || undefined;
  if (!agentToken) {
    console.warn(
      "arm setup: no agent token (--agent-token / ARM_AGENT_TOKEN) — the metered round-trip will be skipped; re-run with a control-plane minted token to verify metering",
    );
  }
  return runSetupFn({
    controlPlaneUrl: parsed.tenantUrl!,
    token,
    roleKey: parsed.roleKey!,
    armProxyUrl: parsed.proxyUrl ?? DEFAULT_PROXY_URL,
    subAccountId: parsed.subAccountId ?? "pending-assignment",
    tenantId: parsed.tenantId ?? "pending-assignment",
    ...(parsed.agentHome !== undefined ? { agentHome: parsed.agentHome } : {}),
    ...(agentToken !== undefined ? { agentToken } : {}),
  });
}

/** Friendly human summary of a completed setup — role, components, connections. */
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
      `  Components: ${result.components.join(", ") || "(none)"}`,
      ...(result.installedPaths.length > 0
        ? [`  Installed:  ${result.installedPaths.join(", ")}`]
        : []),
    ].join("\n"),
  );

  if (result.pendingApproval) {
    console.log(
      "\nYour agent is installed; tool access is waiting on your manager's approval (A6).",
    );
  }

  if (result.connectionsNeeded.length > 0) {
    console.log("\nConnections needed:");
    for (const entry of result.connectionsNeeded) {
      console.log(`  • ${entry.componentName} (${entry.authMethod})`);
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

/** One `arm doctor` diagnostic result. */
export interface DoctorCheck {
  label: string;
  status: "ok" | "fail" | "skipped";
  detail: string;
  code?: ArmErrorCode;
}

/**
 * Re-run verification and report the failure taxonomy with fixes (guide 03
 * §6). Without a persisted session, `doctor` checks what it can reach: the
 * metered round-trip (when a proxy URL + agent token are available) — then
 * always prints the full failure-code reference so a user can self-serve
 * from a plain-language fix.
 */
export async function runDoctorChecks(
  opts: { proxyUrl?: string; agentToken?: string } = {},
): Promise<DoctorCheck[]> {
  const checks: DoctorCheck[] = [];
  const proxyUrl = opts.proxyUrl ?? process.env["ARM_PROXY_URL"];
  const agentToken = opts.agentToken ?? process.env["ARM_AGENT_TOKEN"];

  if (!proxyUrl) {
    checks.push({
      label: "Metered round-trip",
      status: "skipped",
      detail: "no proxy URL known (pass --proxy-url or set ARM_PROXY_URL)",
    });
  } else {
    const health = await verifyMeteredRoundTrip(proxyUrl, agentToken);
    if (health.online) {
      checks.push({ label: "Metered round-trip", status: "ok", detail: health.message });
    } else {
      const code: ArmErrorCode =
        health.message === "agent token required for metered call"
          ? "NO_AGENT_TOKEN"
          : "PROXY_UNREACHABLE";
      checks.push({ label: "Metered round-trip", status: "fail", detail: health.message, code });
    }
  }

  return checks;
}

/** Print doctor check results, then the full failure-code reference. */
export function printDoctorReport(checks: DoctorCheck[]): void {
  console.log("\nARM Doctor");
  console.log("──────────");
  for (const check of checks) {
    const marker = check.status === "ok" ? "✓" : check.status === "fail" ? "✗" : "—";
    console.log(`  ${marker} ${check.label}: ${check.detail}`);
    if (check.code) {
      console.log(`      fix: ${ARM_ERROR_FIXES[check.code]}`);
    }
  }
  console.log("\nFailure code reference:");
  for (const code of ARM_ERROR_CODES) {
    console.log(`  ${code}\n    ${ARM_ERROR_FIXES[code]}`);
  }
  console.log("");
}

export async function main(args: string[]): Promise<void> {
  const cmd = args[2] ?? "help";

  switch (cmd) {
    case "setup": {
      try {
        const result = await runSetupCommand(args.slice(3));
        if (!result) {
          console.log(`
ARM Setup — one-click employee provisioning
────────────────────────────────────────────
  Primary:  arm setup --token <jwt-or-6-char-code> --tenant-url <url>
            arm setup --setup-file <path-to.armsetup>  (double-click target)
            arm setup                 (interactive — prompts for a code)

  Advanced: arm setup --role <key> --tenant-url <url>
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
        const code = err instanceof ArmClientError ? err.code : undefined;
        console.error(`arm setup failed: ${err instanceof Error ? err.message : String(err)}`);
        if (code) {
          console.error(`  fix: ${ARM_ERROR_FIXES[code]}`);
        }
        process.exitCode = 1;
      }
      break;
    }

    case "doctor": {
      const checks = await runDoctorChecks();
      printDoctorReport(checks);
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
  arm setup                One-click provisioning (token/activation code, or --role advanced)
  arm doctor                Re-run verification and print the failure taxonomy
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
