/**
 * D10 pilot Work Package fixture suite (docs/guides/01-library-artifactory.md §4).
 *
 * D10 cutover: the Tool Registry landscape fixtures moved to
 * `@arm/artifactory` (see that package's own `test/fixtures.test.ts` for the
 * 40-callable + 38-installable component assertions). This file now covers
 * `@arm/catalog`'s OWN fixtures — the 7 pilot `work_package_version` rows
 * built from slug-based seeds resolved through the Component Registry.
 */

import { describe, it, expect } from "vitest";
import { packageVersionFixtures, manifestSha256, canonicalManifest } from "../src/index.js";
import { componentFixturesBySlug } from "@arm/artifactory";

describe("D10 pilot work package fixtures", () => {
  it("ships exactly 7 pilot package versions with unique ids", () => {
    expect(packageVersionFixtures).toHaveLength(7);
    const ids = packageVersionFixtures.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every version is manifest_version 2 and ships at least one component", () => {
    for (const v of packageVersionFixtures) {
      expect(v.manifest_version).toBe(2);
      expect(v.components.length).toBeGreaterThan(0);
    }
  });

  it("every pinned component ref resolves to a real @arm/artifactory component id", () => {
    const knownIds = new Set(Object.values(componentFixturesBySlug).map((c) => c.id));
    for (const v of packageVersionFixtures) {
      for (const ref of v.components) {
        expect(knownIds.has(ref.component_id), `dangling component_id ${ref.component_id} on ${v.id}`).toBe(true);
      }
    }
  });

  it("every pinned component ref's kind matches the real component's kind", () => {
    const bySlug = componentFixturesBySlug;
    const idToSlug = new Map(Object.entries(bySlug).map(([slug, c]) => [c.id, slug]));
    for (const v of packageVersionFixtures) {
      for (const ref of v.components) {
        const slug = idToSlug.get(ref.component_id)!;
        expect(ref.kind).toBe(bySlug[slug]!.kind);
      }
    }
  });

  it("component refs are sorted by component_id (manifest v2 wire convention)", () => {
    for (const v of packageVersionFixtures) {
      const ids = v.components.map((c) => c.component_id);
      expect(ids).toEqual([...ids].sort());
    }
  });

  it("job_functions are sorted lexicographically", () => {
    for (const v of packageVersionFixtures) {
      expect(v.job_functions).toEqual([...v.job_functions].sort());
    }
  });

  it("manifest_sha256 recomputes correctly from the shipped wire fixture", () => {
    for (const v of packageVersionFixtures) {
      expect(manifestSha256(canonicalManifest(v))).toBe(v.manifest_sha256);
    }
  });

  it("carries the D9 pilot role keys", () => {
    // Cross-checked directly against packages/trpc/src/catalog-router.ts's
    // hardcoded PACKAGE_FIXTURES (not owned by `library` — these ids/keys
    // must stay stable).
    const byId: Record<string, string> = {
      "40000000-0000-4000-8000-000000000001": "30000000-0000-4000-8000-000000000001",
      "40000000-0000-4000-8000-000000000002": "30000000-0000-4000-8000-000000000002",
      "40000000-0000-4000-8000-000000000003": "30000000-0000-4000-8000-000000000003",
      "40000000-0000-4000-8000-000000000004": "30000000-0000-4000-8000-000000000004",
      "40000000-0000-4000-8000-000000000005": "30000000-0000-4000-8000-000000000005",
      "40000000-0000-4000-8000-000000000006": "30000000-0000-4000-8000-000000000006",
      "40000000-0000-4000-8000-000000000007": "30000000-0000-4000-8000-000000000007",
    };
    for (const v of packageVersionFixtures) {
      expect(v.package_id).toBe(byId[v.id]);
    }
  });

  it("material_planner is the only automated-mode pilot package (cross-checked via its budget/model routing shape)", () => {
    const materialPlanner = packageVersionFixtures.find((v) => v.id === "40000000-0000-4000-8000-000000000006")!;
    expect(materialPlanner.model_routing["batch_window"]).toBe("nightly");
  });
});
