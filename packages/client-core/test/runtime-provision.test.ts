import { describe, it, expect, afterEach } from "vitest";
import { createHash } from "node:crypto";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  detectRuntime,
  provisionRuntime,
  resolveProvisionTarget,
  parseExpectedChecksum,
  bundledRuntimeBinDir,
  type ExecFileFn,
} from "../src/runtime-provision.js";
import { ArmClientError } from "../src/errors.js";

describe("parseExpectedChecksum", () => {
  it("parses a SHASUMS256.txt-style listing", () => {
    const manifest = [
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa  node-v20.18.1-darwin-x64.tar.gz",
      "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb  node-v20.18.1-linux-x64.tar.gz",
    ].join("\n");
    expect(parseExpectedChecksum(manifest, "node-v20.18.1-darwin-x64.tar.gz")).toBe(
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    );
  });

  it("parses a single-hash-only manifest (python-build-standalone's per-asset .sha256)", () => {
    const hash = "c".repeat(64);
    expect(parseExpectedChecksum(`${hash}\n`, "anything.tar.gz")).toBe(hash);
  });

  it("throws (never installs unverified bytes) when the filename isn't listed", () => {
    const manifest = "aaaa...  some-other-file.tar.gz";
    expect(() => parseExpectedChecksum(manifest, "node-v20.18.1-darwin-x64.tar.gz")).toThrow(ArmClientError);
  });
});

describe("resolveProvisionTarget", () => {
  it("picks the right archive extension per platform", () => {
    expect(resolveProvisionTarget("node", "darwin", "arm64").archiveKind).toBe("tar.gz");
    expect(resolveProvisionTarget("node", "win32", "x64").archiveKind).toBe("zip");
    expect(resolveProvisionTarget("python", "linux", "x64").archiveKind).toBe("tar.gz");
  });

  it("targets arm64 vs x64 correctly", () => {
    expect(resolveProvisionTarget("node", "darwin", "arm64").archiveUrl).toContain("darwin-arm64");
    expect(resolveProvisionTarget("node", "darwin", "x64").archiveUrl).toContain("darwin-x64");
  });
});

describe("detectRuntime", () => {
  it("reports present with version when the probe command succeeds", async () => {
    const execFileFn: ExecFileFn = async (command) => {
      if (command === "python3") return { stdout: "Python 3.12.8\n" };
      throw new Error("not found");
    };
    const probe = await detectRuntime("python", { agentHome: "/tmp/nonexistent-agent-home", execFileFn });
    expect(probe.present).toBe(true);
    expect(probe.version).toBe("3.12.8");
  });

  it("reports absent when neither the bundled path nor PATH resolves", async () => {
    const execFileFn: ExecFileFn = async () => {
      throw new Error("command not found");
    };
    const probe = await detectRuntime("node", { agentHome: "/tmp/nonexistent-agent-home", execFileFn });
    expect(probe.present).toBe(false);
    expect(probe.path).toBeUndefined();
  });

  it("prefers a previously-bundled runtime over the system one", async () => {
    const execFileFn: ExecFileFn = async (command) => {
      if (command.includes("runtimes")) return { stdout: "v20.18.1\n" };
      throw new Error("should not check system PATH when bundled is present");
    };
    const probe = await detectRuntime("node", { agentHome: "/home/alice/.arm-agent", execFileFn });
    expect(probe.present).toBe(true);
    expect(probe.path).toContain("runtimes");
  });
});

describe("provisionRuntime", () => {
  const tempDirs: string[] = [];
  afterEach(async () => {
    for (const dir of tempDirs.splice(0)) {
      await rm(dir, { recursive: true, force: true });
    }
  });
  async function makeTempDir(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), "arm-runtime-provision-"));
    tempDirs.push(dir);
    return dir;
  }

  it("skips downloading when the runtime is already present", async () => {
    const agentHome = await makeTempDir();
    const execFileFn: ExecFileFn = async () => ({ stdout: "v20.18.1\n" });
    const fetchFn = (async () => {
      throw new Error("must not fetch when already present");
    }) as unknown as typeof fetch;

    const result = await provisionRuntime("node", { agentHome, execFileFn, fetchFn, platform: "darwin", arch: "arm64" });
    expect(result.provisioned).toBe(false);
  });

  it("downloads, verifies the checksum, extracts, and links the binary when missing", async () => {
    const agentHome = await makeTempDir();
    const archiveBytes = Buffer.from("fake tar.gz bytes for this test");
    const sha256 = createHash("sha256").update(archiveBytes).digest("hex");
    const target = resolveProvisionTarget("node", "linux", "x64");

    let extractedInto: string | undefined;
    const execFileFn: ExecFileFn = async (command, args) => {
      if (command === "tar") {
        extractedInto = args[args.indexOf("-C") + 1];
        // Simulate what `tar -xzf` would produce: the interpreter at its expected relative path.
        const { mkdir: mkdirP, writeFile: writeFileP } = await import("node:fs/promises");
        const { dirname } = await import("node:path");
        const binPath = join(extractedInto!, target.binaryRelPath);
        await mkdirP(dirname(binPath), { recursive: true });
        await writeFileP(binPath, "#!/bin/sh\necho v20.18.1\n");
        return { stdout: "" };
      }
      if (command === "ln") return { stdout: "" };
      throw new Error("not found"); // detectRuntime's initial probe
    };

    const fetchFn = (async (url: string) => {
      if (url === target.checksumManifestUrl) {
        return { ok: true, text: async () => `${sha256}  ${target.archiveFileName}` } as Response;
      }
      if (url === target.archiveUrl) {
        return { ok: true, arrayBuffer: async () => archiveBytes.buffer.slice(archiveBytes.byteOffset, archiveBytes.byteOffset + archiveBytes.byteLength) } as Response;
      }
      throw new Error(`unexpected fetch: ${url}`);
    }) as unknown as typeof fetch;

    const result = await provisionRuntime("node", { agentHome, execFileFn, fetchFn, platform: "linux", arch: "x64" });
    expect(result.provisioned).toBe(true);
    expect(result.path).toBe(join(bundledRuntimeBinDir(agentHome, "node"), "node"));
  });

  it("refuses to install when the downloaded bytes don't match the vendor checksum", async () => {
    const agentHome = await makeTempDir();
    const target = resolveProvisionTarget("python", "darwin", "arm64");
    const execFileFn: ExecFileFn = async () => {
      throw new Error("not found");
    };
    const fetchFn = (async (url: string) => {
      if (url === target.checksumManifestUrl) {
        return { ok: true, text: async () => "0".repeat(64) } as Response;
      }
      if (url === target.archiveUrl) {
        const bytes = Buffer.from("tampered or corrupted bytes");
        return { ok: true, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) } as Response;
      }
      throw new Error(`unexpected fetch: ${url}`);
    }) as unknown as typeof fetch;

    await expect(
      provisionRuntime("python", { agentHome, execFileFn, fetchFn, platform: "darwin", arch: "arm64" }),
    ).rejects.toThrow(/checksum/);
  });

  it("surfaces a clear error when the checksum manifest itself is unreachable", async () => {
    const agentHome = await makeTempDir();
    const execFileFn: ExecFileFn = async () => {
      throw new Error("not found");
    };
    const fetchFn = (async () => ({ ok: false, status: 404 }) as Response) as unknown as typeof fetch;

    await expect(
      provisionRuntime("node", { agentHome, execFileFn, fetchFn, platform: "linux", arch: "x64" }),
    ).rejects.toThrow(/checksum manifest/);
  });
});
