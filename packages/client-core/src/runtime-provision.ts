/**
 * Bundled runtime provisioning (installation wizard follow-up — MCPs/skills
 * that shell out to `python3`/`node` must not require the employee to have
 * installed those themselves first; A1 "very easy" adoption breaks the
 * moment setup asks someone to stop and go install a language runtime).
 *
 * Two-step story per runtime kind ("python" | "node"):
 *   1. `detectRuntime` — is a usable interpreter already on this machine
 *      (checking a previously-bundled copy first, then PATH)?
 *   2. `provisionRuntime` — if not, download a real, official, portable
 *      build for this OS/arch, verify it against a checksum fetched from
 *      the vendor's own published manifest (never a hardcoded digest — a
 *      stale or invented checksum is worse than none, see AGENTS.md "never
 *      fabricate a credential", which extends to integrity hashes), extract
 *      it under `<agentHome>/runtimes/<kind>/`, and return the resolved
 *      interpreter path.
 *
 * Every network/exec/fs call is injectable so this is unit-testable without
 * a real download (same DI pattern as setup.ts's `runSetup`). See this
 * module's test file for what's verified vs. not — a live end-to-end
 * download+extract across all three OSes needs a real multi-platform run,
 * same caveat `packaging/README.md` already carries for the installer
 * wrapper scripts.
 */

import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, writeFile, rm, access } from "node:fs/promises";
import { join } from "node:path";
import { ArmClientError } from "./errors.js";

const execFileAsync = promisify(execFile);

export type RuntimeKind = "python" | "node";

export interface RuntimeProbe {
  present: boolean;
  /** Absolute path to the interpreter — set only when `present`. */
  path?: string;
  version?: string;
}

/** Injectable seam over `child_process.execFile` for tests. */
export type ExecFileFn = (command: string, args: string[]) => Promise<{ stdout: string }>;

async function defaultExecFile(command: string, args: string[]): Promise<{ stdout: string }> {
  const { stdout } = await execFileAsync(command, args, { timeout: 5_000 });
  return { stdout };
}

/** Where a bundled runtime lives once provisioned — checked first, before PATH. */
export function bundledRuntimeBinDir(agentHome: string, kind: RuntimeKind): string {
  return join(agentHome, "runtimes", kind, "bin");
}

function systemCommandFor(kind: RuntimeKind): string {
  return kind === "python" ? "python3" : "node";
}

function bundledBinaryName(kind: RuntimeKind, platform: NodeJS.Platform): string {
  if (kind === "node") return platform === "win32" ? "node.exe" : "node";
  return platform === "win32" ? "python.exe" : "python3";
}

/**
 * Is a usable runtime already available? Checks the bundled copy under
 * `<agentHome>/runtimes/<kind>/bin` first (so a previous provision is
 * reused instead of re-downloaded), then falls back to whatever `python3`/
 * `node` resolves to on PATH. Never throws — an exec failure just means
 * "not present".
 */
export async function detectRuntime(
  kind: RuntimeKind,
  opts: { agentHome: string; execFileFn?: ExecFileFn; platform?: NodeJS.Platform },
): Promise<RuntimeProbe> {
  const execFileFn = opts.execFileFn ?? defaultExecFile;
  const platform = opts.platform ?? process.platform;

  const bundledPath = join(bundledRuntimeBinDir(opts.agentHome, kind), bundledBinaryName(kind, platform));
  const bundled = await probeCommand(bundledPath, execFileFn);
  if (bundled.present) return bundled;

  return probeCommand(systemCommandFor(kind), execFileFn);
}

async function probeCommand(command: string, execFileFn: ExecFileFn): Promise<RuntimeProbe> {
  try {
    const { stdout } = await execFileFn(command, ["--version"]);
    const version = stdout.trim().replace(/^Python\s+/i, "").replace(/^v/, "");
    return { present: true, path: command, version };
  } catch {
    return { present: false };
  }
}

// ── Download + verify + extract ─────────────────────────────────────────

export interface ProvisionTarget {
  /** URL of the archive to download. */
  archiveUrl: string;
  /** URL of the vendor-published checksum manifest covering `archiveUrl`. */
  checksumManifestUrl: string;
  /** Filename (as it appears in the checksum manifest) for `archiveUrl`. */
  archiveFileName: string;
  archiveKind: "tar.gz" | "zip";
  /** Path to the interpreter binary once extracted, relative to the archive root. */
  binaryRelPath: string;
}

/**
 * Real, official, portable-build sources. Node's own tarballs are already
 * relocatable (that's how Node itself is distributed). Python uses
 * astral-sh/python-build-standalone — the same portable-CPython project
 * `uv` is built on. Versions are pinned here (bump deliberately, like any
 * other dependency) so a provisioned runtime is reproducible.
 */
const NODE_VERSION = "20.18.1";
const PYTHON_BUILD_STANDALONE_TAG = "20250106";
const PYTHON_VERSION = "3.12.8";

function nodeTarget(platform: NodeJS.Platform, arch: string): ProvisionTarget {
  const plat = platform === "darwin" ? "darwin" : platform === "win32" ? "win" : "linux";
  const nodeArch = arch === "arm64" ? "arm64" : "x64";
  const ext = platform === "win32" ? "zip" : "tar.gz";
  const fileName = `node-v${NODE_VERSION}-${plat}-${nodeArch}.${ext}`;
  return {
    archiveUrl: `https://nodejs.org/dist/v${NODE_VERSION}/${fileName}`,
    checksumManifestUrl: `https://nodejs.org/dist/v${NODE_VERSION}/SHASUMS256.txt`,
    archiveFileName: fileName,
    archiveKind: ext === "zip" ? "zip" : "tar.gz",
    binaryRelPath: platform === "win32"
      ? `node-v${NODE_VERSION}-${plat}-${nodeArch}/node.exe`
      : `node-v${NODE_VERSION}-${plat}-${nodeArch}/bin/node`,
  };
}

function pythonTarget(platform: NodeJS.Platform, arch: string): ProvisionTarget {
  const pyArch = arch === "arm64" ? "aarch64" : "x86_64";
  const plat = platform === "darwin" ? "apple-darwin" : platform === "win32" ? "pc-windows-msvc-shared" : "unknown-linux-gnu";
  const fileName = `cpython-${PYTHON_VERSION}+${PYTHON_BUILD_STANDALONE_TAG}-${pyArch}-${plat}-install_only.tar.gz`;
  return {
    archiveUrl: `https://github.com/astral-sh/python-build-standalone/releases/download/${PYTHON_BUILD_STANDALONE_TAG}/${fileName}`,
    checksumManifestUrl: `https://github.com/astral-sh/python-build-standalone/releases/download/${PYTHON_BUILD_STANDALONE_TAG}/${fileName}.sha256`,
    archiveFileName: fileName,
    archiveKind: "tar.gz",
    binaryRelPath: platform === "win32" ? "python/python.exe" : "python/bin/python3",
  };
}

export function resolveProvisionTarget(kind: RuntimeKind, platform: NodeJS.Platform, arch: string): ProvisionTarget {
  return kind === "node" ? nodeTarget(platform, arch) : pythonTarget(platform, arch);
}

/** Injectable seams for download/extract — real implementations hit the
 *  network and shell out to `tar`/`Expand-Archive`; tests inject stubs. */
export interface ProvisionIO {
  fetchFn?: typeof fetch;
  execFileFn?: ExecFileFn;
}

/** Parse a vendor checksum manifest (either a plain `<sha256>.sha256` file
 *  or a `SHASUMS256.txt`-style `<sha256>  <filename>` listing) for one
 *  filename's expected digest. Throws if not found — a missing entry means
 *  we cannot verify, and unverified bytes are never installed. */
export function parseExpectedChecksum(manifestText: string, fileName: string): string {
  const trimmed = manifestText.trim();
  // Single-hash-only file (python-build-standalone's per-asset `.sha256`).
  if (/^[0-9a-f]{64}$/i.test(trimmed)) return trimmed.toLowerCase();
  for (const line of trimmed.split("\n")) {
    const match = line.match(/^([0-9a-f]{64})\s+\**(.+)$/i);
    if (match && match[2]?.trim() === fileName) return match[1]!.toLowerCase();
  }
  throw new ArmClientError(
    "DIGEST_MISMATCH",
    `no checksum entry for "${fileName}" in the vendor's published manifest — refusing to install unverified bytes`,
  );
}

/** Download the archive, verify it against the vendor-published checksum,
 *  extract it, and return the resolved interpreter path. Never trusts a
 *  hardcoded digest — always fetches the vendor's own manifest first. */
export async function provisionRuntime(
  kind: RuntimeKind,
  opts: { agentHome: string; platform?: NodeJS.Platform; arch?: string } & ProvisionIO,
): Promise<{ path: string; provisioned: boolean }> {
  const platform = opts.platform ?? process.platform;
  const arch = opts.arch ?? process.arch;
  const fetchFn = opts.fetchFn ?? fetch;
  const execFileFn = opts.execFileFn ?? defaultExecFile;

  const existing = await detectRuntime(kind, { agentHome: opts.agentHome, execFileFn, platform });
  if (existing.present) return { path: existing.path!, provisioned: false };

  const target = resolveProvisionTarget(kind, platform, arch);
  const destDir = join(opts.agentHome, "runtimes", kind);
  await mkdir(destDir, { recursive: true });

  const manifestRes = await fetchFn(target.checksumManifestUrl);
  if (!manifestRes.ok) {
    throw new ArmClientError(
      "PROXY_UNREACHABLE",
      `could not fetch the checksum manifest for ${kind} at ${target.checksumManifestUrl} (HTTP ${manifestRes.status})`,
    );
  }
  const expectedSha256 = parseExpectedChecksum(await manifestRes.text(), target.archiveFileName);

  const archiveRes = await fetchFn(target.archiveUrl);
  if (!archiveRes.ok) {
    throw new ArmClientError(
      "PROXY_UNREACHABLE",
      `could not download ${kind} runtime from ${target.archiveUrl} (HTTP ${archiveRes.status})`,
    );
  }
  const archiveBytes = Buffer.from(await archiveRes.arrayBuffer());
  const actualSha256 = createHash("sha256").update(archiveBytes).digest("hex");
  if (actualSha256 !== expectedSha256) {
    throw new ArmClientError(
      "DIGEST_MISMATCH",
      `${kind} runtime download for ${target.archiveFileName} does not match the vendor-published checksum ` +
        `(expected ${expectedSha256}, got ${actualSha256}) — refusing to install`,
    );
  }

  const archivePath = join(destDir, target.archiveFileName);
  await writeFile(archivePath, archiveBytes);
  await extractArchive(archivePath, destDir, target.archiveKind, execFileFn);
  await rm(archivePath, { force: true });

  const extractedBinaryPath = join(destDir, target.binaryRelPath);
  const binDir = bundledRuntimeBinDir(opts.agentHome, kind);
  await mkdir(binDir, { recursive: true });
  const linkedPath = join(binDir, bundledBinaryName(kind, platform));
  await linkOrCopy(extractedBinaryPath, linkedPath, execFileFn, platform);

  return { path: linkedPath, provisioned: true };
}

async function extractArchive(
  archivePath: string,
  destDir: string,
  kind: "tar.gz" | "zip",
  execFileFn: ExecFileFn,
): Promise<void> {
  if (kind === "tar.gz") {
    // `tar` ships by default on macOS, Linux, and Windows 10 1803+ (bsdtar).
    await execFileFn("tar", ["-xzf", archivePath, "-C", destDir]);
    return;
  }
  // Windows zip path — PowerShell's Expand-Archive ships with every
  // supported Windows version, no extra install required.
  await execFileFn("powershell", [
    "-NoProfile",
    "-Command",
    `Expand-Archive -Path '${archivePath}' -DestinationPath '${destDir}' -Force`,
  ]);
}

async function linkOrCopy(
  source: string,
  dest: string,
  execFileFn: ExecFileFn,
  platform: NodeJS.Platform,
): Promise<void> {
  try {
    await access(dest);
    return; // already linked from a previous provision
  } catch {
    // fall through to create it
  }
  if (platform === "win32") {
    await execFileFn("cmd", ["/c", "copy", "/Y", source, dest]);
  } else {
    await execFileFn("ln", ["-sf", source, dest]);
  }
}
