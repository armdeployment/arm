/**
 * Check-in round trip: the client reports its inventory, the server records it
 * and answers with what is stale. Fixture mode, matching library-router.test.ts.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { createContext, appRouter } from "../src/index.js";
import type { ARMClaims } from "@arm/auth";
import { componentFixturesBySlug, FIXTURE_TENANT_ID } from "@arm/artifactory";

const claims: ARMClaims = { sub: "user_01", tenant_id: FIXTURE_TENANT_ID, email: "eng@acme.com" };
const otherTenant: ARMClaims = {
  sub: "user_02",
  tenant_id: "11111111-0000-4000-8000-000000000002",
  email: "eng@other.com",
};
const caller = (c: ARMClaims | null) => appRouter.createCaller(createContext({ claims: c }));

const SUB = "sub_account_alpha";

/** Any shipped fixture component, at its published 1.0.0. */
function pickComponent() {
  const component = componentFixturesBySlug["cmms"]!;
  return { component, lowest: "1.0.0" };
}

function record(componentId: string, slug: string, kind: string, version: string) {
  return {
    component_id: componentId,
    slug,
    kind: kind as "skill",
    version,
    blob_digest: null,
    installed_path: null,
    installed_at: "2026-09-01T00:00:00.000Z",
  };
}

beforeEach(async () => {
  // Converge to empty so each test starts from a known inventory.
  await caller(claims).library.checkIn({ subAccountId: SUB, components: [] });
});

describe("library.checkIn", () => {
  it("requires an authenticated tenant", async () => {
    await expect(
      caller(null).library.checkIn({ subAccountId: SUB, components: [] }),
    ).rejects.toThrowError(/No authenticated tenant context/);
  });

  it("records what the client reports, readable back via listInstalls", async () => {
    const { component, lowest } = pickComponent();
    await caller(claims).library.checkIn({
      subAccountId: SUB,
      clientVersion: "1.0.0",
      components: [record(component.id, component.slug, component.kind, lowest)],
    });
    const r = await caller(claims).library.listInstalls({ subAccountId: SUB });
    expect(r.installs).toHaveLength(1);
    expect(r.installs[0]).toMatchObject({
      componentId: component.id,
      version: lowest,
      clientVersion: "1.0.0",
    });
  });

  it("converges: a component dropped from the report is removed, not left as a phantom", async () => {
    const { component, lowest } = pickComponent();
    await caller(claims).library.checkIn({
      subAccountId: SUB,
      components: [record(component.id, component.slug, component.kind, lowest)],
    });
    await caller(claims).library.checkIn({ subAccountId: SUB, components: [] });
    const r = await caller(claims).library.listInstalls({ subAccountId: SUB });
    expect(r.installs).toEqual([]);
  });

  it("offers an update when the registry publishes something newer", async () => {
    // Every shipped fixture has exactly one version, so publish a real newer
    // one rather than skipping the assertion when none exists — a test that
    // opts out on the fixtures it actually runs against proves nothing.
    const component = componentFixturesBySlug["jira"]!;
    await caller(claims).library.publishVersion({
      componentId: component.id,
      version: "2.5.0",
      manifest: { note: "newer" },
      changelog: "adds a thing",
    });
    const r = await caller(claims).library.checkIn({
      subAccountId: SUB,
      components: [record(component.id, component.slug, component.kind, "1.0.0")],
    });
    const update = r.updates.find((u) => u.component_id === component.id);
    expect(update).toMatchObject({ from_version: "1.0.0", to_version: "2.5.0", slug: "jira" });
  });

  it("offers nothing once the client is on the newest version", async () => {
    const component = componentFixturesBySlug["github"]!;
    await caller(claims).library.publishVersion({
      componentId: component.id,
      version: "3.0.0",
      manifest: {},
    });
    const r = await caller(claims).library.checkIn({
      subAccountId: SUB,
      components: [record(component.id, component.slug, component.kind, "3.0.0")],
    });
    expect(r.updates).toEqual([]);
  });

  it("reports an unknown component instead of silently ignoring it", async () => {
    const r = await caller(claims).library.checkIn({
      subAccountId: SUB,
      components: [record("00000000-0000-4000-8000-00000000dead", "ghost", "skill", "1.0.0")],
    });
    expect(r.unknown).toEqual(["00000000-0000-4000-8000-00000000dead"]);
  });

  it("scopes inventory by tenant — another tenant cannot read this agent's installs", async () => {
    const { component, lowest } = pickComponent();
    await caller(claims).library.checkIn({
      subAccountId: SUB,
      components: [record(component.id, component.slug, component.kind, lowest)],
    });
    const r = await caller(otherTenant).library.listInstalls({ subAccountId: SUB });
    expect(r.installs).toEqual([]);
  });

  it("takes the tenant from the context, not the payload", async () => {
    const { component, lowest } = pickComponent();
    const r = await caller(claims).library.checkIn({
      subAccountId: SUB,
      components: [record(component.id, component.slug, component.kind, lowest)],
    });
    expect(r.tenant_id).toBe(FIXTURE_TENANT_ID);
  });
});
