#!/usr/bin/env node
/**
 * Node 22+ Single Executable Application build → arm(.exe)
 * (docs/guides/03-client-downloader.md §7, A7).
 *
 * "Custom downloader" = one signed generic client + a per-user signed setup
 * token — never a per-user compiled binary (A4). This script builds THE ONE
 * generic client binary: it bundles `apps/cli` (which wraps
 * `@arm/client-core` — the same engine `arm setup` always uses) into a
 * single CJS file, then uses Node's built-in Single Executable Application
 * (SEA) support to produce a self-contained `arm`/`arm.exe` with no Node
 * install required on the target machine.
 *
 * Steps:
 *   1. Bundle apps/cli/src/index.ts (+ every @arm/* workspace dependency)
 *      into one CJS file with tsup/esbuild — the SEA blob step needs a
 *      single file with no unresolved bare-specifier imports.
 *   2. Write a sea-config.json and run `node --experimental-sea-config`.
 *   3. Copy the current `node` binary as the executable's base.
 *   4. Inject the SEA blob via `postject` (npx — see README.md).
 *   5. Sign, when credentials are available (see sign() below); otherwise
 *      produce an explicitly `unsigned-dev`-tagged artifact and report the
 *      credential gate — never fabricate a signature (AGENTS.md, guide 03 §7).
 *   6. Publish the SHA256 sum alongside the artifact.
 *
 * Platform-specific INSTALLER packaging (MSI/pkg/deb/rpm) wraps this binary
 * and lives in windows/, macos/, linux/ — this script only produces the
 * raw executable those steps consume.
 */

import { execFileSync, execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  chmodSync,
  rmSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { platform as osPlatform } from "node:os";

const execFileAsync = promisify(execFile);

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..");
const CLI_ENTRY = join(REPO_ROOT, "apps/cli/src/index.ts");
const BUILD_DIR = join(HERE, ".build");
const DIST_DIR = join(HERE, "dist");
const BUNDLE_PATH = join(BUILD_DIR, "arm-cli-bundle.cjs");
const SEA_CONFIG_PATH = join(BUILD_DIR, "sea-config.json");
const BLOB_PATH = join(BUILD_DIR, "arm.blob");

const EXE_NAME = osPlatform() === "win32" ? "arm.exe" : "arm";
const OUT_PATH = join(DIST_DIR, EXE_NAME);

function log(msg) {
  console.log(`[build-sea] ${msg}`);
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/** Bundle apps/cli into a single, dependency-free CJS file. Uses the root
 *  workspace's hoisted `tsup` (no network fetch needed in a normal
 *  `pnpm install`ed checkout). */
function bundleCli() {
  log(`bundling ${CLI_ENTRY} -> ${BUNDLE_PATH}`);
  mkdirSync(BUILD_DIR, { recursive: true });
  execFileSync(
    "npx",
    [
      "--yes",
      "tsup",
      CLI_ENTRY,
      "--format",
      "cjs",
      "--platform",
      "node",
      "--target",
      "node22",
      "--out-dir",
      BUILD_DIR,
      "--minify",
      "--no-splitting",
      "--no-dts",
      "--clean",
    ],
    { cwd: REPO_ROOT, stdio: "inherit" },
  );
  // tsup's cjs-format output extension depends on the entry's nearest
  // package.json ("type": "module" -> .cjs, otherwise .js) — accept either.
  const candidate = [join(BUILD_DIR, "index.cjs"), join(BUILD_DIR, "index.js")].find(existsSync);
  if (!candidate) {
    throw new Error(`tsup did not produce the expected bundle in ${BUILD_DIR}`);
  }
  copyFileSync(candidate, BUNDLE_PATH);
}

/** Write the sea-config.json Node's `--experimental-sea-config` consumes. */
function writeSeaConfig() {
  writeFileSync(
    SEA_CONFIG_PATH,
    JSON.stringify(
      {
        main: BUNDLE_PATH,
        output: BLOB_PATH,
        disableExperimentalSEAWarning: true,
      },
      null,
      2,
    ),
  );
}

function generateBlob() {
  log("generating SEA blob");
  execFileSync(process.execPath, ["--experimental-sea-config", SEA_CONFIG_PATH], {
    cwd: BUILD_DIR,
    stdio: "inherit",
  });
  if (!existsSync(BLOB_PATH)) {
    throw new Error(`SEA blob was not produced at ${BLOB_PATH}`);
  }
}

function copyNodeBinary() {
  mkdirSync(DIST_DIR, { recursive: true });
  log(`copying node binary -> ${OUT_PATH}`);
  copyFileSync(process.execPath, OUT_PATH);
  chmodSync(OUT_PATH, 0o755);
}

/** macOS: an ad-hoc-signed binary must have its existing signature removed
 *  before injection (codesign requirement). No-op elsewhere. */
function removeMacSignatureIfNeeded() {
  if (osPlatform() !== "darwin") return;
  try {
    execFileSync("codesign", ["--remove-signature", OUT_PATH], { stdio: "ignore" });
  } catch {
    // no existing signature to remove — fine
  }
}

/** Inject the SEA blob via postject (fetched on demand via npx — see
 *  README.md; not vendored so the repo never carries a network-fetched
 *  binary tool in source control). */
async function injectBlob() {
  log("injecting SEA blob via postject");
  const args = [
    "--yes",
    "postject",
    OUT_PATH,
    "NODE_SEA_BLOB",
    BLOB_PATH,
    "--sentinel-fuse",
    "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2",
  ];
  if (osPlatform() === "darwin") {
    args.push("--macho-segment-name", "NODE_SEA");
  }
  await execFileAsync("npx", args, { cwd: REPO_ROOT });
}

/**
 * Sign the executable when credentials are available; otherwise mark it
 * `unsigned-dev` and report the gate explicitly (AGENTS.md: never fabricate
 * a credential; run the non-credentialed checks and report the gap).
 * Real EV/notarization signing for the wrapped MSI/pkg installers happens
 * in windows/sign.ps1 and macos/notarize.sh — this only ad-hoc-signs the
 * raw macOS binary so it can run locally (Gatekeeper requires SOME
 * signature to execute at all on Apple Silicon, even in dev).
 */
function sign() {
  if (osPlatform() === "darwin") {
    const identity = process.env["ARM_MACOS_SIGN_IDENTITY"];
    if (identity) {
      execFileSync("codesign", ["--sign", identity, "--force", "--options", "runtime", OUT_PATH], {
        stdio: "inherit",
      });
      return { signed: true, note: `signed with identity "${identity}"` };
    }
    execFileSync("codesign", ["--sign", "-", OUT_PATH], { stdio: "inherit" });
    return {
      signed: false,
      note: "ad-hoc signed only (ARM_MACOS_SIGN_IDENTITY not set) — CREDENTIAL GATE: real distribution needs a notarized Developer ID signature (see macos/notarize.sh)",
    };
  }
  if (osPlatform() === "win32") {
    return {
      signed: false,
      note: "CREDENTIAL GATE: Windows EV signing runs separately in windows/sign.ps1 (needs ARM_WINDOWS_CERT_THUMBPRINT / a HW token) — this build produced an unsigned arm.exe",
    };
  }
  return {
    signed: false,
    note: "Linux binaries are not code-signed; package integrity is carried by the deb/rpm's detached GPG signature (see linux/README).",
  };
}

async function main() {
  rmSync(DIST_DIR, { recursive: true, force: true });
  bundleCli();
  writeSeaConfig();
  generateBlob();
  copyNodeBinary();
  removeMacSignatureIfNeeded();
  await injectBlob();
  const signResult = sign();

  const digest = sha256File(OUT_PATH);
  writeFileSync(join(DIST_DIR, `${EXE_NAME}.sha256`), `${digest}  ${EXE_NAME}\n`);

  log(`built ${OUT_PATH}`);
  log(`sha256: ${digest}`);
  log(signResult.signed ? `signed: yes (${signResult.note})` : `signed: NO — ${signResult.note}`);
  if (!signResult.signed) {
    console.log(`\n[build-sea] artifact tag: unsigned-dev\n`);
  }
}

main().catch((err) => {
  console.error(`[build-sea] FAILED: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
