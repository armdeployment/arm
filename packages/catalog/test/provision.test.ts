/**
 * Tests for seed → package-version provisioning (D10,
 * docs/guides/01-library-artifactory.md §4.4).
 *
 * Verifies:
 *   1. Seed component slugs are resolved through `@arm/artifactory`'s
 *      `resolve()` into the stored camelCase refs
 *      ({ componentId, version, kind, scopes }).
 *   2. A seed slug@version with no Component Registry match throws (M5).
 *   3. All required insert fields are present with seed values copied
 *      through.
 *   4. Round-trip: recomputing manifestSha256(canonicalManifest(built))
 *      equals built.manifestSha256.
 *   5. The stored hash matches the hash of the wire-shaped (snake_case)
 *      manifest v2.
 *   6. Component refs, permissions, and job_functions are sorted before
 *      hashing (the manifest-v2 wire convention).
 */

import { describe, it, expect } from "vitest";
import { buildPackageVersionFromSeed, manifestSha256, canonicalManifest } from "../src/index.js";
import type { ResolvableComponentVersion } from "@arm/artifactory";
import type { WorkPackageSeedInput } from "@arm/db/schema";

const PACKAGE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_ID = "tn-fixture-1";
const CMM_CONNECTOR_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const AVAILABLE_COMPONENTS: ResolvableComponentVersion[] = [
  { componentId: CMM_CONNECTOR_ID, slug: "spc.cmm-connector", version: "2.1.0", yanked: false, tenantId: null, sourceKind: "first_party" },
];

const seed: WorkPackageSeedInput = {
  roleKey: "quality_engineer",
  name: "Quality Engineer",
  family: "quality",
  mode: "copilot",
  description: "8D / PPAP / SPC toolkit",
  approvalRequired: true,
  components: [
    { component: "spc.cmm-connector", componentVersion: "2.1.0", kind: "connector", scopes: ["invoke", "configure"] },
  ],
  jobFunctions: ["quality_engineer"],
  permissions: ["tool:invoke", "resource:read"],
  modelRouting: { default: "gpt-4o-mini", reasoning: "gpt-4o" },
  budgetTemplate: { usd_cap_cents: 15000, period: "monthly" },
  starterPrompts: ["Draft an 8D report for this defect"],
  minAgentVersion: "1.2.0",
};

describe("buildPackageVersionFromSeed", () => {
  it("resolves slug refs through @arm/artifactory's resolve() into insert-ready componentId refs", () => {
    const built = buildPackageVersionFromSeed(seed, PACKAGE_ID, "1.0.0", AVAILABLE_COMPONENTS, TENANT_ID);
    expect(built.components).toEqual([
      { componentId: CMM_CONNECTOR_ID, version: "2.1.0", kind: "connector", scopes: ["invoke", "configure"] },
    ]);
  });

  it("throws when a seed slug@version has no match in the Component Registry", () => {
    expect(() => buildPackageVersionFromSeed(seed, PACKAGE_ID, "1.0.0", [], TENANT_ID)).toThrowError(
      /spc\.cmm-connector/,
    );
    expect(() => buildPackageVersionFromSeed(seed, PACKAGE_ID, "1.0.0", [], TENANT_ID)).toThrowError(
      /Component Registry/,
    );
  });

  it("produces all required insert fields", () => {
    const built = buildPackageVersionFromSeed(seed, PACKAGE_ID, "1.0.0", AVAILABLE_COMPONENTS, TENANT_ID);
    expect(built.packageId).toBe(PACKAGE_ID);
    expect(built.version).toBe("1.0.0");
    expect(built.manifestVersion).toBe(2);
    expect(built.jobFunctions).toEqual(seed.jobFunctions);
    expect(built.permissions).toEqual([...seed.permissions].sort());
    expect(built.modelRouting).toEqual(seed.modelRouting);
    expect(built.budgetTemplate).toEqual(seed.budgetTemplate);
    expect(built.starterPrompts).toEqual(seed.starterPrompts);
    expect(built.minAgentVersion).toBe(seed.minAgentVersion);
    expect(built.manifestSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("round-trips: recomputing the hash from the returned object yields the same value", () => {
    const built = buildPackageVersionFromSeed(seed, PACKAGE_ID, "1.1.0", AVAILABLE_COMPONENTS, TENANT_ID);
    const recomputed = manifestSha256(
      canonicalManifest({
        components: built.components,
        permissions: built.permissions,
        modelRouting: built.modelRouting,
        budgetTemplate: built.budgetTemplate,
        starterPrompts: built.starterPrompts,
        minAgentVersion: built.minAgentVersion,
        jobFunctions: built.jobFunctions,
      }),
    );
    expect(recomputed).toBe(built.manifestSha256);
  });

  it("stores the hash of the wire-shaped manifest v2 over the RESOLVED refs", () => {
    const built = buildPackageVersionFromSeed(seed, PACKAGE_ID, "2.0.0", AVAILABLE_COMPONENTS, TENANT_ID);
    const wire = {
      manifest_version: 2 as const,
      components: [{ component_id: CMM_CONNECTOR_ID, version: "2.1.0", kind: "connector", scopes: ["invoke", "configure"] }],
      permissions: [...seed.permissions].sort(),
      model_routing: seed.modelRouting,
      budget_template: seed.budgetTemplate,
      starter_prompts: seed.starterPrompts,
      min_agent_version: seed.minAgentVersion,
      job_functions: [...seed.jobFunctions].sort(),
    };
    expect(built.manifestSha256).toBe(manifestSha256(wire));
  });

  it("produces different hashes for different content of the same seed", () => {
    const v1 = buildPackageVersionFromSeed(seed, PACKAGE_ID, "1.0.0", AVAILABLE_COMPONENTS, TENANT_ID);
    const v2 = buildPackageVersionFromSeed(
      { ...seed, permissions: [...seed.permissions, "resource:extra"] },
      PACKAGE_ID,
      "1.0.0",
      AVAILABLE_COMPONENTS,
      TENANT_ID,
    );
    expect(v1.manifestSha256).not.toBe(v2.manifestSha256);
  });

  it("sorts components by componentId and permissions/job_functions lexicographically before hashing", () => {
    const multiComponent: WorkPackageSeedInput = {
      ...seed,
      components: [
        { component: "spc.cmm-connector", componentVersion: "2.1.0", kind: "connector", scopes: [] },
      ],
      permissions: ["zeta:perm", "alpha:perm"],
      jobFunctions: ["zeta_role", "alpha_role"],
    };
    const built = buildPackageVersionFromSeed(multiComponent, PACKAGE_ID, "1.0.0", AVAILABLE_COMPONENTS, TENANT_ID);
    expect(built.permissions).toEqual(["alpha:perm", "zeta:perm"]);
    expect(built.jobFunctions).toEqual(["alpha_role", "zeta_role"]);
  });
});
