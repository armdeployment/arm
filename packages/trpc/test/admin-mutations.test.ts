/**
 * Admin mutations that used to report success and change nothing.
 *
 * `roles.grant` returned `status: "granted"` and mutated no store — and there
 * was no store to mutate: `roles.list` returns the available presets, so
 * nothing anywhere recorded who actually held one. `agents.create` returned a
 * hardcoded `id: "agt_new"` for an agent that was never created, so the caller
 * got an id it could not look up and two creates returned the same one.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { appRouter, createContext } from "../src/index.js";
import { snapshotAllDemoStores, restoreAllDemoStores } from "../src/demo-mode.js";

const claims = {
  sub: "60000000-0000-4000-8000-000000000001",
  tenant_id: "d9d9d9d9-0000-4000-8000-000000000001",
  email: "admin@acme.com",
};
const caller = () => appRouter.createCaller(createContext({ claims }));

let snapshot: ReturnType<typeof snapshotAllDemoStores>;
beforeEach(() => {
  snapshot = snapshotAllDemoStores();
});
afterEach(() => {
  restoreAllDemoStores(snapshot);
});

describe("roles.grant / revoke", () => {
  const grant = {
    userId: "u_1",
    roleKey: "org_admin",
    scopeType: "org",
    scopeId: "org_acme",
  } as const;

  it("a granted role is visible afterwards", async () => {
    expect((await caller().roles.grants({})).grants).toHaveLength(0);
    await caller().roles.grant(grant);
    const { grants } = await caller().roles.grants({});
    expect(grants).toHaveLength(1);
    expect(grants[0]).toMatchObject({ userId: "u_1", roleKey: "org_admin", scopeId: "org_acme" });
    expect(grants[0]!.grantedBy).toBe(claims.sub);
  });

  it("granting twice does not create a second grant", async () => {
    // A double-clicked button must not produce a row that needs revoking twice.
    await caller().roles.grant(grant);
    await caller().roles.grant(grant);
    expect((await caller().roles.grants({})).grants).toHaveLength(1);
  });

  it("revoking removes it", async () => {
    await caller().roles.grant(grant);
    await caller().roles.revoke({ userId: "u_1", roleKey: "org_admin", scopeId: "org_acme" });
    expect((await caller().roles.grants({})).grants).toHaveLength(0);
  });

  it("REFUSES to revoke a grant that was never made", async () => {
    // An admin who mistypes a scope must not be told the permission is gone.
    await expect(
      caller().roles.revoke({ userId: "u_1", roleKey: "org_admin", scopeId: "typo" }),
    ).rejects.toThrow(/does not hold/);
  });

  it("REFUSES an unknown role rather than recording a meaningless grant", async () => {
    await expect(caller().roles.grant({ ...grant, roleKey: "wizard" })).rejects.toThrow(
      /Unknown role/,
    );
  });

  it("filters grants by user", async () => {
    await caller().roles.grant(grant);
    await caller().roles.grant({ ...grant, userId: "u_2" });
    expect((await caller().roles.grants({ userId: "u_2" })).grants).toHaveLength(1);
  });
});

describe("agents.create", () => {
  const input = {
    name: "line-monitor-b",
    scopeType: "department" as const,
    scopeId: "dept_eng",
    stakeholderUserId: "00000000-0000-4000-8000-0000000000aa",
    type: "claude code",
  };

  it("returns an id that the registry can actually find", async () => {
    const created = await caller().agents.create(input);
    expect(created.id).not.toBe("agt_new");
    const { agents } = await caller().agents.list({ scope: null, status: "all" });
    expect(agents.find((a) => a.id === created.id)?.name).toBe("line-monitor-b");
  });

  it("gives two creates different ids", async () => {
    const a = await caller().agents.create(input);
    const b = await caller().agents.create({ ...input, name: "line-monitor-c" });
    expect(a.id).not.toBe(b.id);
  });

  it("starts at zero spend and unknown task type rather than guessing", async () => {
    const created = await caller().agents.create(input);
    const { agents } = await caller().agents.list({ scope: null, status: "all" });
    const agent = agents.find((a) => a.id === created.id)!;
    expect(agent.monthlySpend).toBe(0);
    expect(agent.taskType).toBe("unknown");
  });

  it("REFUSES a scope that is not in the org tree", async () => {
    await expect(caller().agents.create({ ...input, scopeId: "nowhere" })).rejects.toThrow(
      /Unknown scope/,
    );
  });
});
