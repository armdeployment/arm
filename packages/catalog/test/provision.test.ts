/**
 * Tests for seed → package-version provisioning (D9).
 *
 * Verifies:
 *   1. Seed tool slugs are resolved through the slug→id map into the stored
 *      camelCase refs ({ toolId, toolVersion, scopes }).
 *   2. A seed slug missing from the map throws with a clear message (M5).
 *   3. All required insert fields are present with seed values copied through.
 *   4. Round-trip: recomputing manifestSha256(canonicalManifest(built)) equals
 *      built.manifestSha256 — the hash covers the INSERT-READY (resolved)
 *      refs, not the slug seeds (B1).
 *   5. The stored hash matches the hash of the wire-shaped (snake_case)
 *      manifest.
 */

import { describe, it, expect } from "vitest";
import {
  buildPackageVersionFromSeed,
  manifestSha256,
  canonicalManifest,
} from "../src/index.js";
import type { WorkPackageSeedInput } from "@arm/db/schema";

const PACKAGE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TOOL_IDS_BY_SLUG: Record<string, string> = {
  "spc.cmm-connector": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
};

const seed: WorkPackageSeedInput = {
  roleKey: "quality_engineer",
  name: "Quality Engineer",
  family: "quality",
  mode: "copilot",
  description: "8D / PPAP / SPC toolkit",
  tools: [
    {
      tool: "spc.cmm-connector",
      toolVersion: "2.1.0",
      scopes: ["invoke", "configure"],
    },
  ],
  skills: ["8d-reporting", "spc-charting"],
  subagentConfigs: ["ppap-reviewer"],
  permissions: ["tool:invoke", "resource:read"],
  modelRouting: { default: "gpt-4o-mini", reasoning: "gpt-4o" },
  budgetTemplate: { usd_cap_cents: 15000, period: "monthly" },
  starterPrompts: ["Draft an 8D report for this defect"],
  templateRefs: ["8d-template", "ppap-psw"],
  minAgentVersion: "1.2.0",
};

describe("buildPackageVersionFromSeed", () => {
  it("resolves slug refs through the map into insert-ready toolId refs", () => {
    const built = buildPackageVersionFromSeed(seed, PACKAGE_ID, "1.0.0", TOOL_IDS_BY_SLUG);
    expect(built.tools).toEqual([
      {
        toolId: TOOL_IDS_BY_SLUG["spc.cmm-connector"],
        toolVersion: "2.1.0",
        scopes: ["invoke", "configure"],
      },
    ]);
  });

  it("throws when a seed slug is missing from the slug→id map", () => {
    expect(() =>
      buildPackageVersionFromSeed(seed, PACKAGE_ID, "1.0.0", {}),
    ).toThrowError(/spc\.cmm-connector/);
    expect(() =>
      buildPackageVersionFromSeed(seed, PACKAGE_ID, "1.0.0", {}),
    ).toThrowError(/toolIdsBySlug/);
  });

  it("produces all required insert fields", () => {
    const built = buildPackageVersionFromSeed(seed, PACKAGE_ID, "1.0.0", TOOL_IDS_BY_SLUG);
    expect(built.packageId).toBe(PACKAGE_ID);
    expect(built.version).toBe("1.0.0");
    expect(built.skills).toEqual(seed.skills);
    expect(built.subagentConfigs).toEqual(seed.subagentConfigs);
    expect(built.permissions).toEqual(seed.permissions);
    expect(built.modelRouting).toEqual(seed.modelRouting);
    expect(built.budgetTemplate).toEqual(seed.budgetTemplate);
    expect(built.starterPrompts).toEqual(seed.starterPrompts);
    expect(built.templateRefs).toEqual(seed.templateRefs);
    expect(built.minAgentVersion).toBe(seed.minAgentVersion);
    expect(built.manifestSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("round-trips: recomputing the hash from the returned object yields the same value", () => {
    const built = buildPackageVersionFromSeed(seed, PACKAGE_ID, "1.1.0", TOOL_IDS_BY_SLUG);
    const recomputed = manifestSha256(
      canonicalManifest({
        tools: built.tools,
        skills: built.skills,
        subagentConfigs: built.subagentConfigs,
        permissions: built.permissions,
        modelRouting: built.modelRouting,
        budgetTemplate: built.budgetTemplate,
        starterPrompts: built.starterPrompts,
        templateRefs: built.templateRefs,
        minAgentVersion: built.minAgentVersion,
      }),
    );
    expect(recomputed).toBe(built.manifestSha256);
  });

  it("stores the hash of the wire-shaped manifest over the RESOLVED refs", () => {
    const built = buildPackageVersionFromSeed(seed, PACKAGE_ID, "2.0.0", TOOL_IDS_BY_SLUG);
    const wire = {
      tools: [
        {
          tool_id: TOOL_IDS_BY_SLUG["spc.cmm-connector"],
          tool_version: "2.1.0",
          scopes: ["invoke", "configure"],
        },
      ],
      skills: seed.skills,
      subagent_configs: seed.subagentConfigs,
      permissions: seed.permissions,
      model_routing: seed.modelRouting,
      budget_template: seed.budgetTemplate,
      starter_prompts: seed.starterPrompts,
      template_refs: seed.templateRefs,
      min_agent_version: seed.minAgentVersion,
    };
    expect(built.manifestSha256).toBe(manifestSha256(wire));
  });

  it("produces different hashes for different versions of the same seed", () => {
    const v1 = buildPackageVersionFromSeed(seed, PACKAGE_ID, "1.0.0", TOOL_IDS_BY_SLUG);
    const v2 = buildPackageVersionFromSeed(
      { ...seed, skills: [...seed.skills, "vda-6-3-audit"] },
      PACKAGE_ID,
      "1.0.0",
      TOOL_IDS_BY_SLUG,
    );
    expect(v1.manifestSha256).not.toBe(v2.manifestSha256);
  });
});
