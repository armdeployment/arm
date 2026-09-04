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
 *   arm setup                      No arguments — the default, no-terminal
 *                                  path: opens the installation wizard in
 *                                  the default browser (gui-server.ts) and
 *                                  keeps running until it's closed. Nothing
 *                                  is typed at a prompt; the activation
 *                                  code, folder picks, and everything else
 *                                  happen as clicks in that page.
 *   arm setup --cli                Escape hatch to the old terminal-prompt
 *                                  flow (scripted answers, accessibility,
 *                                  no-browser environments) — same A4 path,
 *                                  read from stdin instead of a page.
 *   arm setup --role <key> --tenant-url <url> [...]
 *                                  Advanced/CI path (retained) — direct
 *                                  role-key provisioning, unchanged wire
 *                                  behaviour from D9 Phase 1.6.
 *   arm doctor                     Re-run verification and print the
 *                                  failure taxonomy with fixes.
 *   arm refine [--folder <path>] [--pain-points "<text>"]
 *                                  Optional post-setup step (installation
 *                                  wizard steps 2b–4, docs/solutions/
 *                                  2026-08-25-gtm-market-tiers-and-wizard-
 *                                  plan.md): describe pain points in free
 *                                  text and/or point at a work folder — both
 *                                  processed LOCALLY (A5/Invariant 1: no
 *                                  free text or file content ever leaves
 *                                  this machine, only derived tags print to
 *                                  the terminal). Also scans for already-
 *                                  installed engineering tools. No args:
 *                                  interactive, every step skippable with
 *                                  an empty answer.
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
  scanWorkFolder,
  scanInstalledTools,
  classifyPainPoints,
  startInstallWizardServer,
  openInBrowser,
  runUpdate,
  readInstalledState,
  installedStatePath,
  resolveAgentHome,
  ARM_ERROR_CODES,
  ARM_ERROR_FIXES,
  ArmClientError,
  type SetupArgs,
  type SetupResult,
  type ArmErrorCode,
  type FolderScanResult,
  type DetectedTool,
  type PainPointTag,
  type GuiServerHandle,
  type UpdateResult,
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

export type StartInstallWizardServerFn = typeof startInstallWizardServer;
export type OpenInBrowserFn = typeof openInBrowser;

/** Injectable seams for the GUI path — tests never bind a real port or
 *  shell out to `open`/`start`/`xdg-open`. */
export interface SetupGuiCommandDeps {
  startServerFn?: StartInstallWizardServerFn;
  openBrowserFn?: OpenInBrowserFn;
}

/**
 * `arm setup` with no arguments and no `--cli` flag — the default,
 * no-terminal path (A1: "very easy" adoption breaks the moment setup asks
 * someone to type a command). Starts the wizard server, opens it in the
 * default browser, and returns the handle; the caller is responsible for
 * keeping the process alive for as long as the wizard should stay reachable
 * (main() does this by simply never resolving until the process exits).
 */
export async function runSetupGuiCommand(deps: SetupGuiCommandDeps = {}): Promise<GuiServerHandle> {
  const startServerFn = deps.startServerFn ?? startInstallWizardServer;
  const openBrowserFn = deps.openBrowserFn ?? openInBrowser;

  const handle = await startServerFn({});
  console.log(
    `\nARM Setup is open in your browser: ${handle.url}\n` +
      "If it didn't open automatically, paste that link into any browser.\n" +
      "(Prefer the terminal? Run `arm setup --cli` instead.)\n",
  );
  await openBrowserFn(handle.url);
  return handle;
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
    const tenantUrl =
      envTenantUrl ?? (await promptFn("ARM setup URL (e.g. https://arm.acme.com): "));
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
      throw new Error(
        `"${parsed.setupFile}" is not a valid .armsetup file (expected {version, token, control_plane_url})`,
      );
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

/** Parsed `arm refine` flags — both optional, non-interactive mode when either is set. */
export interface RefineCliArgs {
  folderPath?: string;
  painPoints?: string;
}

export function parseRefineArgs(argv: string[]): RefineCliArgs {
  const values: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === undefined || !flag.startsWith("--") || value === undefined) break;
    values[flag] = value;
  }
  return {
    ...(values["--folder"] !== undefined ? { folderPath: values["--folder"] } : {}),
    ...(values["--pain-points"] !== undefined ? { painPoints: values["--pain-points"] } : {}),
  };
}

export type ScanWorkFolderFn = typeof scanWorkFolder;
export type ScanInstalledToolsFn = typeof scanInstalledTools;
export type ClassifyPainPointsFn = typeof classifyPainPoints;

/** Injectable seams — same pattern as SetupCommandDeps, so tests never touch
 *  a real filesystem, a real machine's installed apps, or a real TTY. */
export interface RefineCommandDeps {
  scanWorkFolderFn?: ScanWorkFolderFn;
  scanInstalledToolsFn?: ScanInstalledToolsFn;
  classifyPainPointsFn?: ClassifyPainPointsFn;
  promptFn?: PromptFn;
}

export interface RefineResult {
  painPointTags: PainPointTag[];
  folderScan?: FolderScanResult;
  installedTools: DetectedTool[];
}

/**
 * Run the optional post-setup refinement flow. Interactive when neither
 * `--folder` nor `--pain-points` is supplied (prompts for each, empty
 * answer = skip); non-interactive otherwise (only runs the steps whose flag
 * was given). The installed-tools scan always runs — it's a local presence
 * check with no prompt needed and nothing to skip.
 *
 * Nothing this function does reaches the network. `painPoints`/`folderPath`
 * are consumed locally (classifyPainPoints/scanWorkFolder) and never stored
 * — the caller prints only the derived tags, per A5/Invariant 1.
 *
 * Interactive mode asks TWO sequential questions. `defaultPrompt` (used by
 * `arm setup`, which only ever asks one) calls `rl.question()`, which
 * attaches its 'line' listener only once awaited — fine for a single
 * question on a real TTY (input always arrives after the prompt), but with
 * piped/non-TTY stdin that already has both answer lines buffered (common
 * in scripted/CI invocations), the second line can be delivered to the
 * readline interface and silently dropped before the second `question()`
 * call ever attaches its listener, hanging forever. So when no `promptFn`
 * is injected, this function drives one shared readline interface's async
 * iterator directly instead — pulling the next line on demand has no such
 * race, whether that line was already buffered or arrives later.
 */
export async function runRefineCommand(
  argv: string[],
  deps: RefineCommandDeps = {},
): Promise<RefineResult> {
  const scanFolder = deps.scanWorkFolderFn ?? scanWorkFolder;
  const scanTools = deps.scanInstalledToolsFn ?? scanInstalledTools;
  const classify = deps.classifyPainPointsFn ?? classifyPainPoints;

  const parsed = parseRefineArgs(argv);
  const interactive = parsed.folderPath === undefined && parsed.painPoints === undefined;

  let prompt = deps.promptFn;
  let closeSharedInterface: (() => void) | undefined;
  if (interactive && prompt === undefined) {
    const { createInterface } = await import("node:readline/promises");
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const lineIterator = rl[Symbol.asyncIterator]();
    prompt = async (question: string) => {
      process.stdout.write(question);
      const next = await lineIterator.next();
      return next.done ? "" : next.value.trim();
    };
    closeSharedInterface = () => rl.close();
  }

  try {
    let painPoints = parsed.painPoints ?? "";
    if (interactive) {
      painPoints = await prompt!(
        "Describe a work pain point in your own words (optional, stays on this machine — press enter to skip): ",
      );
    }
    const painPointTags = painPoints.trim().length > 0 ? classify(painPoints) : [];

    let folderPath = parsed.folderPath ?? "";
    if (interactive) {
      folderPath = await prompt!(
        "Path to a folder of your everyday work files (optional, only file extensions are read — press enter to skip): ",
      );
    }
    const folderScan =
      folderPath.trim().length > 0 ? await scanFolder(folderPath.trim()) : undefined;

    const installedTools = await scanTools();

    return { painPointTags, ...(folderScan !== undefined ? { folderScan } : {}), installedTools };
  } finally {
    closeSharedInterface?.();
  }
}

/** Friendly human summary of `arm refine` — every line here is exactly what
 *  a caller may transmit; the raw pain-point text and folder contents never
 *  appear because this function never receives them, only derived tags. */
export function printRefineSummary(result: RefineResult): void {
  console.log(
    [
      "",
      "ARM Refine — nothing above this summary left your machine",
      "──────────────────────────────────────────────────────────",
    ].join("\n"),
  );

  if (result.painPointTags.length > 0) {
    console.log("\nPain-point signals detected:");
    for (const tag of result.painPointTags) {
      console.log(
        `  • ${tag.tag} → ${tag.jobFunctionHint} (matched: ${tag.matchedKeywords.join(", ")})`,
      );
    }
  } else {
    console.log("\nPain-point signals: none (skipped, or nothing matched)");
  }

  if (result.folderScan) {
    console.log(`\nWork-folder scan: ${result.folderScan.filesScanned} files (extensions only)`);
    console.log(`  Tags: ${result.folderScan.tags.join(", ") || "(none)"}`);
  } else {
    console.log("\nWork-folder scan: skipped");
  }

  if (result.installedTools.length > 0) {
    console.log("\nInstalled tools detected:");
    for (const tool of result.installedTools) {
      console.log(`  • ${tool.label} → ${tool.componentSlug}`);
    }
  } else {
    console.log("\nInstalled tools detected: none of the known set");
  }

  console.log(
    "\nThese are local signals only — nothing here changes your install yet." +
      " Share them with your ARM admin to fine-tune your package.\n",
  );
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
      ...(result.runtimesProvisioned.length > 0
        ? [
            `  Runtimes:   ${result.runtimesProvisioned.join(", ")} (downloaded — not found on this machine)`,
          ]
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
// ── `arm list` / `arm update` ──────────────────────────────────────────────

export interface UpdateFlags {
  agentHome: string;
  controlPlaneUrl: string;
  dataPlaneUrl?: string;
  token: string;
  dryRun: boolean;
}

export function parseUpdateFlags(argv: string[]): UpdateFlags {
  const values: Record<string, string> = {};
  let dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg.startsWith("--")) {
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        values[arg] = next;
        i++;
      }
    }
  }
  return {
    agentHome: resolveAgentHome(values["--agent-home"] ?? process.env["ARM_AGENT_HOME"]),
    controlPlaneUrl:
      values["--tenant-url"] ?? process.env["ARM_CONTROL_PLANE_URL"] ?? "http://localhost:3300",
    ...((values["--data-plane-url"] ?? process.env["ARM_DATA_PLANE_URL"])
      ? { dataPlaneUrl: values["--data-plane-url"] ?? process.env["ARM_DATA_PLANE_URL"]! }
      : {}),
    token: values["--token"] ?? process.env["ARM_AGENT_TOKEN"] ?? "",
    dryRun,
  };
}

export async function runUpdateCommand(flags: UpdateFlags): Promise<UpdateResult> {
  return runUpdate({
    agentHome: flags.agentHome,
    controlPlaneUrl: flags.controlPlaneUrl,
    token: flags.token,
    ...(flags.dataPlaneUrl !== undefined ? { dataPlaneUrl: flags.dataPlaneUrl } : {}),
    dryRun: flags.dryRun,
  });
}

export function printUpdateSummary(result: UpdateResult, dryRun: boolean): void {
  if (result.checkedAt === null) {
    console.log("Nothing installed yet — run `arm setup` first.");
    return;
  }
  if (result.available.length === 0) {
    console.log("Everything is up to date.");
  } else if (dryRun) {
    console.log(`${result.available.length} update(s) available:`);
    for (const u of result.available) {
      console.log(
        `  ${u.slug}  ${u.from_version} → ${u.to_version}${u.changelog ? `  (${u.changelog})` : ""}`,
      );
    }
  }
  for (const u of result.applied) {
    console.log(`  updated ${u.slug}  ${u.from_version} → ${u.to_version}`);
  }
  // Skips are printed, never swallowed: an update that silently did not
  // happen is the exact failure this feature exists to remove.
  for (const { update, reason } of result.skipped) {
    console.log(`  SKIPPED ${update.slug} → ${update.to_version}: ${reason}`);
  }
  if (result.unknown.length > 0) {
    console.log(
      `  ${result.unknown.length} installed component(s) are no longer published by the registry.`,
    );
  }
  if (!dryRun && result.applied.length > 0) {
    console.log("\nRestart your agent to pick up the new versions.");
  }
}

export async function printInstalledInventory(agentHome: string): Promise<void> {
  const state = await readInstalledState(agentHome);
  if (state === null) {
    console.log(`No components installed (no lockfile at ${installedStatePath(agentHome)}).`);
    console.log("Run `arm setup` to install your package.");
    return;
  }
  console.log(`Installed components  (${installedStatePath(agentHome)})`);
  console.log(`  last updated: ${state.updated_at}`);
  if (state.components.length === 0) {
    console.log("  (none)");
    return;
  }
  const width = Math.max(...state.components.map((c) => c.slug.length));
  for (const c of state.components) {
    console.log(`  ${c.slug.padEnd(width)}  ${c.version.padEnd(8)} ${c.kind}`);
  }
}

export async function runDoctorChecks(
  opts: {
    proxyUrl?: string;
    agentToken?: string;
    agentHome?: string;
    controlPlaneUrl?: string;
  } = {},
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

  // Component freshness. A dry-run check-in: `doctor` reports, it never
  // installs — an employee running a diagnostic should not have their agent
  // change underneath them. `arm update` is the command that acts.
  //
  // Failing to reach the control plane is reported as `skipped`, not `fail`:
  // being offline is not a broken install, and a red cross here would train
  // people to ignore the report.
  const agentHome = resolveAgentHome(opts.agentHome ?? process.env["ARM_AGENT_HOME"]);
  const controlPlaneUrl = opts.controlPlaneUrl ?? process.env["ARM_CONTROL_PLANE_URL"];
  if (!controlPlaneUrl) {
    checks.push({
      label: "Component versions",
      status: "skipped",
      detail: "no control plane URL known (set ARM_CONTROL_PLANE_URL)",
    });
  } else {
    try {
      const result = await runUpdate({
        agentHome,
        controlPlaneUrl,
        token: opts.agentToken ?? process.env["ARM_AGENT_TOKEN"] ?? "",
        dryRun: true,
      });
      if (result.checkedAt === null) {
        checks.push({
          label: "Component versions",
          status: "skipped",
          detail: "nothing installed yet — run `arm setup`",
        });
      } else if (result.available.length === 0) {
        checks.push({ label: "Component versions", status: "ok", detail: "all up to date" });
      } else {
        checks.push({
          label: "Component versions",
          status: "fail",
          detail:
            `${result.available.length} update(s) available ` +
            `(${result.available.map((u) => `${u.slug} ${u.from_version}→${u.to_version}`).join(", ")}) ` +
            "— run `arm update`",
        });
      }
    } catch (err) {
      checks.push({
        label: "Component versions",
        status: "skipped",
        detail: `could not reach the control plane: ${err instanceof Error ? err.message : String(err)}`,
      });
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
      const setupArgs = args.slice(3);

      // No flags at all — the default, no-terminal path (A1). Opens the
      // wizard in a browser and stays alive for as long as it's open; the
      // process is meant to be closed by the user (Ctrl+C, or the platform
      // installer that launched it tearing it down), not to exit on its own.
      if (setupArgs.length === 0) {
        try {
          await runSetupGuiCommand();
          await new Promise(() => {}); // keep listening until the process is killed
        } catch (err) {
          console.error(
            `arm setup: could not start the installation wizard: ${err instanceof Error ? err.message : String(err)}`,
          );
          process.exitCode = 1;
        }
        break;
      }

      // Explicit escape hatch back to the old terminal-prompt flow.
      const cliArgs = setupArgs[0] === "--cli" ? setupArgs.slice(1) : setupArgs;

      try {
        const result = await runSetupCommand(cliArgs);
        if (!result) {
          console.log(`
ARM Setup — one-click employee provisioning
────────────────────────────────────────────
  Default:  arm setup                       (opens the wizard in your browser)
  Terminal: arm setup --cli                 (the old interactive prompt)

  Primary:  arm setup --token <jwt-or-6-char-code> --tenant-url <url>
            arm setup --setup-file <path-to.armsetup>  (double-click target)

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

    case "update": {
      const flags = parseUpdateFlags(args.slice(3));
      const result = await runUpdateCommand(flags);
      printUpdateSummary(result, flags.dryRun);
      break;
    }

    case "list": {
      await printInstalledInventory(resolveAgentHome(process.env["ARM_AGENT_HOME"]));
      break;
    }

    case "refine": {
      const result = await runRefineCommand(args.slice(3));
      printRefineSummary(result);
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
  arm setup                Opens the installation wizard in your browser — no terminal typing
  arm setup --cli          Terminal-prompt fallback (scripted answers, no browser available)
  arm doctor                Re-run verification and print the failure taxonomy
  arm list                 Show installed components and their versions
  arm update               Check the registry and install newer component versions
  arm update --dry-run     Report what would change, install nothing
  arm refine               Optional: pain points + work-folder + installed-tools scan (local-only)
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
