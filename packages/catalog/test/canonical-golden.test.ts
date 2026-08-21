/**
 * GOLDEN-VECTOR test for the canonical package manifest (B1).
 *
 * This test is MIRRORED in @arm/client-core with the SAME object + constant
 * (client-side `buildCanonicalManifest` produces the identical snake_case
 * object). If either side changes the canonical field list, the golden
 * constant breaks in BOTH suites — the mechanism that keeps the DB-side
 * hash and the client-side hash provably identical.
 *
 * The constant below was computed ONCE by running the hash fn over the
 * object below (golden vector — do not regenerate). Changing it without a
 * coordinated wire change to @arm/client-core would silently break
 * package-integrity verification for every installed package.
 */

import { describe, it, expect } from "vitest";
import { manifestSha256, canonicalManifest } from "../src/index.js";

/** The fixed canonical manifest object — snake_case, the nine hashed fields. */
const GOLDEN_MANIFEST = {
  tools: [
    { tool_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", tool_version: "2.1.0", scopes: ["invoke", "configure"] },
    { tool_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", tool_version: "1.0.0", scopes: ["read"] },
  ],
  skills: ["8d-reporting", "spc-charting"],
  subagent_configs: ["ppap-reviewer"],
  permissions: ["tool:invoke", "resource:read"],
  model_routing: { default: "gpt-4o-mini", reasoning: "gpt-4o" },
  budget_template: { usd_cap_cents: 15000, period: "monthly" },
  starter_prompts: ["Draft an 8D report for this defect"],
  template_refs: ["8d-template", "ppap-psw"],
  min_agent_version: "1.2.0",
};

// golden vector — do not regenerate
const GOLDEN_SHA256 = "6d88398ed8ffb4c1e0928f45a0d07440a0093b7e07cfd162a31fe0187e1e8f7d";

/** The same content in DB (camelCase) source form — must canonicalize identically. */
const GOLDEN_MANIFEST_CAMEL_SOURCE = {
  tools: [
    { toolId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", toolVersion: "2.1.0", scopes: ["invoke", "configure"] },
    { toolId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", toolVersion: "1.0.0", scopes: ["read"] },
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

describe("canonical manifest golden vector (mirrored in @arm/client-core)", () => {
  it("hashes the fixed canonical manifest to the golden constant", () => {
    expect(manifestSha256(canonicalManifest(GOLDEN_MANIFEST))).toBe(GOLDEN_SHA256);
  });

  it("is invariant to key-order permutations", () => {
    const permuted = {
      min_agent_version: GOLDEN_MANIFEST.min_agent_version,
      tools: GOLDEN_MANIFEST.tools.map((t) => ({
        scopes: t.scopes,
        tool_version: t.tool_version,
        tool_id: t.tool_id,
      })),
      starter_prompts: GOLDEN_MANIFEST.starter_prompts,
      budget_template: GOLDEN_MANIFEST.budget_template,
      skills: GOLDEN_MANIFEST.skills,
      permissions: GOLDEN_MANIFEST.permissions,
      model_routing: GOLDEN_MANIFEST.model_routing,
      template_refs: GOLDEN_MANIFEST.template_refs,
      subagent_configs: GOLDEN_MANIFEST.subagent_configs,
    };
    expect(manifestSha256(permuted)).toBe(GOLDEN_SHA256);
  });

  it("canonicalizes the DB (camelCase) source form to the same hash", () => {
    const canonical = canonicalManifest(GOLDEN_MANIFEST_CAMEL_SOURCE);
    expect(canonical).toEqual(canonicalManifest(GOLDEN_MANIFEST));
    expect(manifestSha256(canonical)).toBe(GOLDEN_SHA256);
  });
});
