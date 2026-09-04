import { describe, it, expect } from "vitest";
import {
  computeUpdatePlan,
  latestPublishedVersion,
  summarizeInstalls,
} from "../src/update-check.js";
import type { ComponentVersion, InstalledComponentRecord } from "@arm/proto";

const SHA = "a".repeat(64);

function version(v: string, over: Partial<ComponentVersion> = {}): ComponentVersion {
  return {
    id: "00000000-0000-4000-8000-000000000000",
    tenant_id: "00000000-0000-4000-8000-0000000000t1",
    component_id: "comp-1",
    version: v,
    manifest: {},
    manifest_sha256: SHA,
    blob_digest: `sha256:${SHA}`,
    blob_size_bytes: 10,
    blob_media_type: "application/zip",
    config_schema: {},
    requires: [],
    changelog: "",
    yanked: false,
    published_at: null,
    published_by: null,
    ...over,
  } as ComponentVersion;
}

function installed(v: string, componentId = "comp-1"): InstalledComponentRecord {
  return {
    component_id: componentId,
    slug: "review-skill",
    kind: "skill",
    version: v,
    blob_digest: `sha256:${SHA}`,
    installed_path: "/home/a/skills/review-skill",
    installed_at: "2026-09-01T00:00:00.000Z",
  };
}

const registry = (versions: ComponentVersion[]) => [
  { id: "comp-1", slug: "review-skill", kind: "skill" as const, versions },
];

describe("latestPublishedVersion", () => {
  it("picks the highest by semver, not lexically", () => {
    // "9.0.0" > "10.0.0" lexically — the bug this guards.
    const v = latestPublishedVersion([version("9.0.0"), version("10.0.0")]);
    expect(v?.version).toBe("10.0.0");
  });

  it("never offers a yanked version", () => {
    const v = latestPublishedVersion([version("1.0.0"), version("2.0.0", { yanked: true })]);
    expect(v?.version).toBe("1.0.0");
  });

  it("returns null when every version is yanked", () => {
    expect(latestPublishedVersion([version("1.0.0", { yanked: true })])).toBeNull();
  });
});

describe("computeUpdatePlan", () => {
  it("offers a strictly newer version", () => {
    const plan = computeUpdatePlan(
      [installed("1.0.0")],
      registry([version("1.0.0"), version("1.2.0")]),
    );
    expect(plan.updates).toHaveLength(1);
    expect(plan.updates[0]).toMatchObject({
      from_version: "1.0.0",
      to_version: "1.2.0",
      slug: "review-skill",
    });
  });

  it("offers nothing when already current", () => {
    const plan = computeUpdatePlan([installed("1.2.0")], registry([version("1.2.0")]));
    expect(plan.updates).toEqual([]);
  });

  it("never downgrades a client that is ahead of the registry", () => {
    const plan = computeUpdatePlan([installed("3.0.0")], registry([version("1.0.0")]));
    expect(plan.updates).toEqual([]);
  });

  it("does not offer a yanked newer version", () => {
    const plan = computeUpdatePlan(
      [installed("1.0.0")],
      registry([version("1.0.0"), version("2.0.0", { yanked: true })]),
    );
    expect(plan.updates).toEqual([]);
  });

  it("reports a component the registry does not publish", () => {
    const plan = computeUpdatePlan([installed("1.0.0", "ghost")], registry([version("1.0.0")]));
    expect(plan.unknown).toEqual(["ghost"]);
    expect(plan.updates).toEqual([]);
  });

  it("reports a component whose every version was yanked", () => {
    const plan = computeUpdatePlan(
      [installed("1.0.0")],
      registry([version("1.0.0", { yanked: true })]),
    );
    expect(plan.unknown).toEqual(["comp-1"]);
  });

  it("flags — but still reports — an update the client is too old to install", () => {
    const versions = [
      version("1.0.0"),
      version("2.0.0", { manifest: { min_client_version: "5.0.0" } }),
    ];
    const plan = computeUpdatePlan([installed("1.0.0")], registry(versions), "1.0.0");
    expect(plan.updates).toHaveLength(1);
    expect(plan.updates[0]!.requires_client_upgrade).toBe(true);
  });

  it("clears the flag when the client is new enough", () => {
    const versions = [
      version("1.0.0"),
      version("2.0.0", { manifest: { min_client_version: "1.5.0" } }),
    ];
    const plan = computeUpdatePlan([installed("1.0.0")], registry(versions), "2.0.0");
    expect(plan.updates[0]!.requires_client_upgrade).toBe(false);
  });

  it("treats an unknown client version as too old, rather than assuming it is fine", () => {
    const versions = [
      version("1.0.0"),
      version("2.0.0", { manifest: { min_client_version: "1.0.0" } }),
    ];
    const plan = computeUpdatePlan([installed("1.0.0")], registry(versions), "");
    expect(plan.updates[0]!.requires_client_upgrade).toBe(true);
  });

  it("survives a malformed min_client_version instead of throwing", () => {
    const versions = [version("1.0.0"), version("2.0.0", { manifest: { min_client_version: 42 } })];
    const plan = computeUpdatePlan([installed("1.0.0")], registry(versions), "1.0.0");
    expect(plan.updates[0]!.requires_client_upgrade).toBe(false);
  });
});

// ── summarizeInstalls (the fleet roll-up behind /library → Installed) ──────

function fact(
  subAccount: string,
  v: string,
  componentId = "comp-1",
  lastSeen = "2026-09-01T00:00:00.000Z",
) {
  return {
    sub_account_id: subAccount,
    component_id: componentId,
    version: v,
    last_seen_at: lastSeen,
  };
}

describe("summarizeInstalls", () => {
  it("counts agents, not rows", () => {
    // One agent with three components is one agent, not three.
    const out = summarizeInstalls(
      [
        fact("agent-1", "1.0.0", "comp-1"),
        fact("agent-1", "1.0.0", "comp-2"),
        fact("agent-1", "1.0.0", "comp-3"),
      ],
      registry([version("1.0.0")]),
    );
    expect(out.agents).toBe(1);
    expect(out.installs).toBe(3);
  });

  it("groups the same component across agents and counts each version", () => {
    const out = summarizeInstalls(
      [fact("agent-1", "1.0.0"), fact("agent-2", "1.0.0"), fact("agent-3", "2.0.0")],
      registry([version("1.0.0"), version("2.0.0")]),
    );
    expect(out.components).toHaveLength(1);
    expect(out.components[0]!.installs).toBe(3);
    expect(out.components[0]!.versions).toEqual([
      { version: "2.0.0", count: 1, stale: false },
      { version: "1.0.0", count: 2, stale: true },
    ]);
  });

  it("counts stale machines, not stale versions", () => {
    // Two agents behind on one version is two machines to fix, not one.
    const out = summarizeInstalls(
      [fact("agent-1", "1.0.0"), fact("agent-2", "1.0.0"), fact("agent-3", "2.0.0")],
      registry([version("2.0.0")]),
    );
    expect(out.components[0]!.stale).toBe(2);
    expect(out.stale).toBe(2);
  });

  it("orders versions by semver, not lexically", () => {
    const out = summarizeInstalls(
      [fact("agent-1", "9.0.0"), fact("agent-2", "10.0.0")],
      registry([version("10.0.0")]),
    );
    expect(out.components[0]!.versions.map((v) => v.version)).toEqual(["10.0.0", "9.0.0"]);
  });

  it("never calls an agent ahead of the registry stale", () => {
    // A hand-installed 3.0.0 against a registry at 2.0.0 is not a downgrade
    // to schedule — same rule computeUpdatePlan applies.
    const out = summarizeInstalls([fact("agent-1", "3.0.0")], registry([version("2.0.0")]));
    expect(out.components[0]!.stale).toBe(0);
    expect(out.stale).toBe(0);
  });

  it("ignores yanked versions when deciding what latest is", () => {
    // 2.0.0 was withdrawn, so 1.0.0 is current and nobody is behind.
    const out = summarizeInstalls(
      [fact("agent-1", "1.0.0")],
      registry([version("1.0.0"), version("2.0.0", { yanked: true })]),
    );
    expect(out.components[0]!.latest_version).toBe("1.0.0");
    expect(out.components[0]!.stale).toBe(0);
  });

  it("reports a component the registry no longer publishes instead of dropping it", () => {
    const out = summarizeInstalls(
      [fact("agent-1", "1.0.0", "ghost")],
      registry([version("1.0.0")]),
    );
    expect(out.components).toHaveLength(1);
    expect(out.components[0]!).toMatchObject({
      component_id: "ghost",
      slug: null,
      kind: null,
      latest_version: null,
      in_registry: false,
      installs: 1,
      stale: 0,
    });
  });

  it("distinguishes unknown-to-the-registry from every-version-yanked", () => {
    // Both have no installable version, but only one has a name a human can
    // act on — collapsing them would lose that.
    const out = summarizeInstalls(
      [fact("agent-1", "1.0.0", "comp-1")],
      registry([version("1.0.0", { yanked: true })]),
    );
    expect(out.components[0]!.in_registry).toBe(true);
    expect(out.components[0]!.slug).toBe("review-skill");
    expect(out.components[0]!.latest_version).toBeNull();
  });

  it("sorts most-stale first, then components needing a human", () => {
    const out = summarizeInstalls(
      [
        fact("agent-1", "1.0.0", "comp-1"), // 1 stale
        fact("agent-2", "1.0.0", "ghost"), // no installable version
        fact("agent-3", "2.0.0", "comp-2"), // current
      ],
      [
        { id: "comp-1", slug: "a-skill", kind: "skill" as const, versions: [version("2.0.0")] },
        { id: "comp-2", slug: "b-skill", kind: "skill" as const, versions: [version("2.0.0")] },
      ],
    );
    expect(out.components.map((c) => c.component_id)).toEqual(["comp-1", "ghost", "comp-2"]);
  });

  it("reports the most recent check-in across a component's agents", () => {
    const out = summarizeInstalls(
      [
        fact("agent-1", "1.0.0", "comp-1", "2026-09-01T00:00:00.000Z"),
        fact("agent-2", "1.0.0", "comp-1", "2026-09-03T00:00:00.000Z"),
      ],
      registry([version("1.0.0")]),
    );
    expect(out.components[0]!.last_seen_at).toBe("2026-09-03T00:00:00.000Z");
  });

  it("is empty, not undefined, when nobody has checked in", () => {
    expect(summarizeInstalls([], registry([version("1.0.0")]))).toEqual({
      agents: 0,
      installs: 0,
      stale: 0,
      components: [],
    });
  });
});
