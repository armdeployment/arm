import { describe, it, expect, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scanWorkFolder } from "../src/folder-scan.js";

describe("scanWorkFolder", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    for (const dir of tempDirs.splice(0)) {
      await rm(dir, { recursive: true, force: true });
    }
  });

  async function makeTempDir(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), "arm-folder-scan-"));
    tempDirs.push(dir);
    return dir;
  }

  it("tags cad_heavy once the extension count clears the threshold", async () => {
    const dir = await makeTempDir();
    for (let i = 0; i < 4; i++) {
      await writeFile(join(dir, `part${i}.sldprt`), "not real cad data");
    }
    const result = await scanWorkFolder(dir);
    expect(result.filesScanned).toBe(4);
    expect(result.extensionCounts[".sldprt"]).toBe(4);
    expect(result.tags).toContain("cad_heavy");
  });

  it("drops a tag below the threshold — one stray file is not a signal", async () => {
    const dir = await makeTempDir();
    await writeFile(join(dir, "one.sldprt"), "x");
    const result = await scanWorkFolder(dir);
    expect(result.extensionCounts[".sldprt"]).toBe(1);
    expect(result.tags).not.toContain("cad_heavy");
  });

  it("never reads file contents — corrupt/binary content never throws", async () => {
    const dir = await makeTempDir();
    await writeFile(join(dir, "a.xlsx"), Buffer.from([0x00, 0xff, 0x10, 0x00]));
    await writeFile(join(dir, "b.xlsx"), Buffer.from([0x00, 0xff, 0x10, 0x00]));
    await writeFile(join(dir, "c.xlsx"), Buffer.from([0x00, 0xff, 0x10, 0x00]));
    const result = await scanWorkFolder(dir);
    expect(result.tags).toContain("spreadsheet_heavy");
  });

  it("recurses into subdirectories up to maxDepth", async () => {
    const dir = await makeTempDir();
    const nested = join(dir, "a", "b", "c");
    await mkdir(nested, { recursive: true });
    for (let i = 0; i < 4; i++) {
      await writeFile(join(nested, `f${i}.py`), "x");
    }
    const shallow = await scanWorkFolder(dir, { maxDepth: 1 });
    expect(shallow.filesScanned).toBe(0);

    const deep = await scanWorkFolder(dir, { maxDepth: 5 });
    expect(deep.filesScanned).toBe(4);
    expect(deep.tags).toContain("code_heavy");
  });

  it("skips ignored directories like node_modules", async () => {
    const dir = await makeTempDir();
    const nodeModules = join(dir, "node_modules", "pkg");
    await mkdir(nodeModules, { recursive: true });
    for (let i = 0; i < 5; i++) {
      await writeFile(join(nodeModules, `f${i}.js`), "x");
    }
    const result = await scanWorkFolder(dir);
    expect(result.filesScanned).toBe(0);
  });

  it("respects maxFiles as a hard cap", async () => {
    const dir = await makeTempDir();
    for (let i = 0; i < 10; i++) {
      await writeFile(join(dir, `f${i}.txt`), "x");
    }
    const result = await scanWorkFolder(dir, { maxFiles: 3 });
    expect(result.filesScanned).toBeLessThanOrEqual(3);
  });

  it("returns an empty result for an unreadable/missing directory rather than throwing", async () => {
    const result = await scanWorkFolder("/definitely/does/not/exist/on/this/machine");
    expect(result.filesScanned).toBe(0);
    expect(result.tags).toEqual([]);
  });

  it("ignores extensionless and unmapped extensions", async () => {
    const dir = await makeTempDir();
    await writeFile(join(dir, "README"), "x");
    await writeFile(join(dir, "notes.xyz123"), "x");
    const result = await scanWorkFolder(dir);
    expect(result.tags).toEqual([]);
  });
});
