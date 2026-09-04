import { describe, it, expect } from "vitest";
import { computeUpdatePlan, latestPublishedVersion } from "../src/update-check.js";
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
