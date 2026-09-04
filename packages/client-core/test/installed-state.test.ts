import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  readInstalledState,
  writeInstalledState,
  installedStatePath,
  mergeInstalled,
  type InstalledComponentRecord,
} from "../src/installed-state.js";

let home: string;
beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), "arm-lock-"));
});
afterEach(async () => {
  await rm(home, { recursive: true, force: true });
});

function record(over: Partial<InstalledComponentRecord> = {}): InstalledComponentRecord {
  return {
    component_id: "c1",
    slug: "review",
    kind: "skill",
    version: "1.0.0",
    blob_digest: null,
    installed_path: null,
    installed_at: "2026-09-01T00:00:00.000Z",
    ...over,
  };
}

const state = (components: InstalledComponentRecord[]) => ({
  schema: 1 as const,
  tenant_id: "t1",
  sub_account_id: "s1",
  client_version: "1.0.0",
  updated_at: "2026-09-01T00:00:00.000Z",
  components,
});

describe("installed-state lockfile", () => {
  it("returns null on a machine that has never installed anything", async () => {
    expect(await readInstalledState(home)).toBeNull();
  });

  it("round-trips what was written", async () => {
    await writeInstalledState(home, state([record()]));
    const read = await readInstalledState(home);
    expect(read?.components).toHaveLength(1);
    expect(read?.components[0]).toMatchObject({ slug: "review", version: "1.0.0" });
  });

  it("writes to <agentHome>/.arm/, not beside the components", async () => {
    const path = await writeInstalledState(home, state([]));
    expect(path).toBe(join(home, ".arm", "installed.json"));
    expect(installedStatePath(home)).toBe(path);
  });

  it("writes the lockfile 0600 — it names every component on the machine", async () => {
    await writeInstalledState(home, state([record()]));
    const { stat } = await import("node:fs/promises");
    const mode = (await stat(installedStatePath(home))).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it("throws rather than silently reinstalling when the lockfile is corrupt", async () => {
    await mkdir(join(home, ".arm"), { recursive: true });
    await writeFile(installedStatePath(home), "{ not json");
    await expect(readInstalledState(home)).rejects.toThrow(/not valid JSON/);
  });

  it("refuses a lockfile written by a newer client instead of guessing", async () => {
    await mkdir(join(home, ".arm"), { recursive: true });
    await writeFile(installedStatePath(home), JSON.stringify({ schema: 2, tenant_id: "t1" }));
    await expect(readInstalledState(home)).rejects.toThrow(/schema 2.*only understands 1/);
  });

  it("leaves no temp file behind", async () => {
    await writeInstalledState(home, state([record()]));
    const { readdir } = await import("node:fs/promises");
    const files = await readdir(join(home, ".arm"));
    expect(files).toEqual(["installed.json"]);
  });

  it("ends the file with a newline", async () => {
    await writeInstalledState(home, state([record()]));
    expect(await readFile(installedStatePath(home), "utf8")).toMatch(/\n$/);
  });
});

describe("mergeInstalled", () => {
  it("upserts by component_id rather than erasing the rest", () => {
    const prev = [
      record({ component_id: "a", slug: "alpha" }),
      record({ component_id: "b", slug: "beta" }),
    ];
    const merged = mergeInstalled(prev, [
      record({ component_id: "b", slug: "beta", version: "2.0.0" }),
    ]);
    expect(merged).toHaveLength(2);
    expect(merged.find((c) => c.component_id === "b")?.version).toBe("2.0.0");
    expect(merged.find((c) => c.component_id === "a")?.version).toBe("1.0.0");
  });

  it("treats a null previous as a fresh install", () => {
    expect(mergeInstalled(null, [record()])).toHaveLength(1);
  });
});
