/**
 * `runUpdate` decides what to install and what to refuse. These tests stub
 * `fetch` so the branching is exercised without a control plane.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { runUpdate } from "../src/update.js";
import { writeInstalledState, readInstalledState } from "../src/installed-state.js";

let home: string;
const realFetch = globalThis.fetch;

const BLOB = Buffer.from("new skill body");
const DIGEST = `sha256:${createHash("sha256").update(BLOB).digest("hex")}`;

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), "arm-upd-"));
  await writeInstalledState(home, {
    schema: 1,
    tenant_id: "t1",
    sub_account_id: "s1",
    client_version: "1.0.0",
    updated_at: "2026-09-01T00:00:00.000Z",
    components: [
      {
        component_id: "c1",
        slug: "review",
        kind: "skill",
        version: "1.0.0",
        blob_digest: null,
        installed_path: join(home, "skills", "review"),
        installed_at: "2026-09-01T00:00:00.000Z",
      },
    ],
  });
});
afterEach(async () => {
  globalThis.fetch = realFetch;
  await rm(home, { recursive: true, force: true });
});

function update(over: Record<string, unknown> = {}) {
  return {
    component_id: "c1",
    slug: "review",
    kind: "skill",
    from_version: "1.0.0",
    to_version: "2.0.0",
    blob_digest: DIGEST,
    changelog: "",
    requires_client_upgrade: false,
    ...over,
  };
}

/** Stub: the check-in endpoint returns `updates`; the blob endpoint returns bytes. */
function stubFetch(updates: unknown[], blob: Buffer = BLOB) {
  globalThis.fetch = vi.fn(async (input: unknown) => {
    const url = String(input);
    if (url.includes("/api/components/check-in")) {
      return new Response(
        JSON.stringify({
          tenant_id: "t1",
          sub_account_id: "s1",
          checked_at: "2026-09-02T00:00:00.000Z",
          updates,
          unknown: [],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    return new Response(blob, { status: 200 });
  }) as unknown as typeof fetch;
}

const args = { agentHome: "", controlPlaneUrl: "http://cp", token: "t", dataPlaneUrl: "http://dp" };

describe("runUpdate", () => {
  it("does nothing on a machine with no lockfile", async () => {
    const empty = await mkdtemp(join(tmpdir(), "arm-empty-"));
    stubFetch([update()]);
    const r = await runUpdate({ ...args, agentHome: empty });
    expect(r.checkedAt).toBeNull();
    expect(r.applied).toEqual([]);
    await rm(empty, { recursive: true, force: true });
  });

  it("installs a newer version and bumps the lockfile", async () => {
    stubFetch([update()]);
    const r = await runUpdate({ ...args, agentHome: home });
    expect(r.applied).toHaveLength(1);
    expect(await readFile(join(home, "skills", "review"), "utf8")).toBe("new skill body");
    const state = await readInstalledState(home);
    expect(state?.components[0]?.version).toBe("2.0.0");
  });

  it("dry-run reports without writing anything", async () => {
    stubFetch([update()]);
    const r = await runUpdate({ ...args, agentHome: home, dryRun: true });
    expect(r.available).toHaveLength(1);
    expect(r.applied).toEqual([]);
    const state = await readInstalledState(home);
    expect(state?.components[0]?.version).toBe("1.0.0");
  });

  it("refuses an update the client is too old for, and says so", async () => {
    stubFetch([update({ requires_client_upgrade: true })]);
    const r = await runUpdate({ ...args, agentHome: home });
    expect(r.applied).toEqual([]);
    expect(r.skipped[0]?.reason).toMatch(/newer ARM client/);
  });

  it("skips callable components rather than writing a bogus file", async () => {
    stubFetch([update({ kind: "mcp", blob_digest: null })]);
    const r = await runUpdate({ ...args, agentHome: home });
    expect(r.applied).toEqual([]);
    expect(r.skipped[0]?.reason).toMatch(/arm setup/);
  });

  it("skips when no artifact cache URL is known, instead of failing silently", async () => {
    stubFetch([update()]);
    const { dataPlaneUrl: _drop, ...noCache } = args;
    const r = await runUpdate({ ...noCache, agentHome: home });
    expect(r.applied).toEqual([]);
    expect(r.skipped[0]?.reason).toMatch(/ARM_DATA_PLANE_URL/);
  });

  it("refuses bytes whose digest does not match — never installs unverified content", async () => {
    stubFetch([update()], Buffer.from("tampered"));
    await expect(runUpdate({ ...args, agentHome: home })).rejects.toThrow(/digest mismatch/);
    // and the lockfile still records the old version
    const state = await readInstalledState(home);
    expect(state?.components[0]?.version).toBe("1.0.0");
  });

  it("leaves the lockfile alone when there is nothing to do", async () => {
    stubFetch([]);
    const before = await readFile(join(home, ".arm", "installed.json"), "utf8");
    const r = await runUpdate({ ...args, agentHome: home });
    expect(r.applied).toEqual([]);
    expect(await readFile(join(home, ".arm", "installed.json"), "utf8")).toBe(before);
  });

  it("sends the inventory, and does not let the server pick the tenant", async () => {
    stubFetch([]);
    await runUpdate({ ...args, agentHome: home });
    const call = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]!;
    const body = JSON.parse((call[1] as { body: string }).body);
    expect(body.sub_account_id).toBe("s1");
    expect(body.components).toHaveLength(1);
    expect(body.components[0].version).toBe("1.0.0");
  });

  it("surfaces a check-in HTTP failure instead of reporting success", async () => {
    globalThis.fetch = vi.fn(
      async () => new Response("nope", { status: 503 }),
    ) as unknown as typeof fetch;
    await expect(runUpdate({ ...args, agentHome: home })).rejects.toThrow(/HTTP 503/);
  });
});
