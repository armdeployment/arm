/**
 * Tests for canonical manifests v2 + package version validation
 * (docs/guides/01-library-artifactory.md §4).
 *
 * Verifies:
 *   1. A structurally valid package version with known, approved component
 *      refs passes.
 *   2. A ref to an unknown component_version fails.
 *   3. A ref pinning a non-approved component_version fails.
 *   4. A ref pinning a yanked component_version fails.
 *   5. Empty components fails (must ship at least one component).
 *   6. An unknown job_functions[] key fails.
 *   7. Malformed payloads fail with zod issues.
 *   8. canonicalManifest normalizes camelCase refs to the wire shape.
 */

import { describe, it, expect } from "vitest";
import { canonicalManifest, validatePackageVersion, type ComponentVersionLookup } from "../src/index.js";

const COMPONENT_ID = "11111111-1111-4111-8111-111111111111";
const PACKAGE_ID = "22222222-2222-4222-8222-222222222222";
const SHA = "a".repeat(64);
const JOB_FUNCTIONS = new Set(["quality_engineer"]);

const componentVersionsById = new Map<string, ComponentVersionLookup>([
  [`${COMPONENT_ID}@1.0.0`, { reviewStatus: "approved", yanked: false }],
  [`${COMPONENT_ID}@1.1.0`, { reviewStatus: "in_review", yanked: false }],
  [`${COMPONENT_ID}@2.0.0`, { reviewStatus: "approved", yanked: true }],
]);

function validInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    package_id: PACKAGE_ID,
    version: "1.0.0",
    manifest_version: 2,
    components: [{ component_id: COMPONENT_ID, version: "1.0.0", kind: "mcp", scopes: ["invoke"] }],
    permissions: ["tool:invoke"],
    model_routing: { default: "gpt-4o-mini" },
    budget_template: { usd_cap_cents: 5000 },
    starter_prompts: ["hi"],
    min_agent_version: "0.9.0",
    job_functions: ["quality_engineer"],
    manifest_sha256: SHA,
    ...overrides,
  };
}

describe("validatePackageVersion", () => {
  it("accepts a valid version with a known, approved component ref", () => {
    const r = validatePackageVersion(validInput(), componentVersionsById, JOB_FUNCTIONS);
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it("rejects a ref to an unknown component_version", () => {
    const r = validatePackageVersion(
      validInput({ components: [{ component_id: COMPONENT_ID, version: "9.9.9", kind: "mcp", scopes: [] }] }),
      componentVersionsById,
      JOB_FUNCTIONS,
    );
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("unknown component_version"))).toBe(true);
  });

  it("rejects a ref pinning a non-approved component_version", () => {
    const r = validatePackageVersion(
      validInput({ components: [{ component_id: COMPONENT_ID, version: "1.1.0", kind: "mcp", scopes: [] }] }),
      componentVersionsById,
      JOB_FUNCTIONS,
    );
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("not approved"))).toBe(true);
  });

  it("rejects a ref pinning a yanked component_version", () => {
    const r = validatePackageVersion(
      validInput({ components: [{ component_id: COMPONENT_ID, version: "2.0.0", kind: "mcp", scopes: [] }] }),
      componentVersionsById,
      JOB_FUNCTIONS,
    );
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("yanked"))).toBe(true);
  });

  it("rejects packages that ship zero components", () => {
    const r = validatePackageVersion(validInput({ components: [] }), componentVersionsById, JOB_FUNCTIONS);
    expect(r.ok).toBe(false);
    expect(r.errors.join("\n")).toMatch(/ships nothing usable/);
  });

  it("rejects an unknown job_functions key", () => {
    const r = validatePackageVersion(validInput({ job_functions: ["not_a_real_job_function"] }), componentVersionsById, JOB_FUNCTIONS);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("unknown job function"))).toBe(true);
  });

  it("rejects malformed payloads with schema issues", () => {
    const r = validatePackageVersion({ nope: true }, componentVersionsById, JOB_FUNCTIONS);
    expect(r.ok).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });
});

describe("canonicalManifest", () => {
  it("normalizes camelCase component refs to the wire shape", () => {
    const m = canonicalManifest({
      components: [{ componentId: COMPONENT_ID, version: "1.0.0", kind: "mcp", scopes: ["invoke"] }],
      permissions: [],
      modelRouting: {},
      budgetTemplate: {},
      starterPrompts: [],
      minAgentVersion: "0.9.0",
      jobFunctions: ["quality_engineer"],
    });
    expect(m.manifest_version).toBe(2);
    expect(m.components[0]).toEqual({
      component_id: COMPONENT_ID,
      version: "1.0.0",
      kind: "mcp",
      scopes: ["invoke"],
    });
    expect(m.min_agent_version).toBe("0.9.0");
    expect(m.job_functions).toEqual(["quality_engineer"]);
  });

  it("passes wire-shaped refs through unchanged", () => {
    const m = canonicalManifest({
      components: [{ component_id: COMPONENT_ID, version: "1.1.0", kind: "skill", scopes: [] }],
      permissions: [],
      modelRouting: {},
      budgetTemplate: {},
      starterPrompts: [],
      minAgentVersion: "0.0.0",
      jobFunctions: [],
    });
    expect(m.components[0]).toEqual({ component_id: COMPONENT_ID, version: "1.1.0", kind: "skill", scopes: [] });
  });

  it("defaults missing fields to their empty forms", () => {
    const m = canonicalManifest({});
    expect(m).toEqual({
      manifest_version: 2,
      components: [],
      permissions: [],
      model_routing: {},
      budget_template: {},
      starter_prompts: [],
      min_agent_version: "0.0.0",
      job_functions: [],
    });
  });
});
