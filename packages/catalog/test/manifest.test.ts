/**
 * Tests for canonical manifests + package version validation (D9).
 *
 * Verifies:
 *   1. A structurally valid package version with known tool refs passes.
 *   2. Ref to an unknown tool id fails.
 *   3. Ref pinning a version the tool never published fails.
 *   4. Empty tools + skills + subagent configs + starter prompts fails.
 *   5. Malformed payloads fail with zod issues.
 *   6. canonicalManifest normalizes camelCase refs to the wire shape.
 */

import { describe, it, expect } from "vitest";
import { canonicalManifest, validatePackageVersion } from "../src/index.js";

const TOOL_ID = "11111111-1111-4111-8111-111111111111";
const PACKAGE_ID = "22222222-2222-4222-8222-222222222222";
const SHA = "a".repeat(64);

const toolsById = new Map<string, Set<string>>([[TOOL_ID, new Set(["1.0.0", "1.1.0"])]]);

function validInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    package_id: PACKAGE_ID,
    version: "1.0.0",
    tools: [{ tool_id: TOOL_ID, tool_version: "1.0.0", scopes: ["invoke"] }],
    skills: ["8d-reporting"],
    subagent_configs: [],
    permissions: ["tool:invoke"],
    model_routing: { default: "gpt-4o-mini" },
    budget_template: { usd_cap_cents: 5000 },
    starter_prompts: [],
    template_refs: [],
    min_agent_version: "0.9.0",
    manifest_sha256: SHA,
    ...overrides,
  };
}

describe("validatePackageVersion", () => {
  it("accepts a valid version with known tool refs", () => {
    const r = validatePackageVersion(validInput(), toolsById);
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it("rejects unknown tool ids", () => {
    const r = validatePackageVersion(
      validInput({
        tools: [
          { tool_id: "99999999-9999-4999-8999-999999999999", tool_version: "1.0.0", scopes: [] },
        ],
      }),
      toolsById,
    );
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("unknown tool"))).toBe(true);
  });

  it("rejects refs pinning versions the tool never published", () => {
    const r = validatePackageVersion(
      validInput({
        tools: [{ tool_id: TOOL_ID, tool_version: "9.9.9", scopes: [] }],
      }),
      toolsById,
    );
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("has no version"))).toBe(true);
  });

  it("rejects packages that ship nothing usable", () => {
    const r = validatePackageVersion(
      validInput({ tools: [], skills: [], subagent_configs: [], starter_prompts: [] }),
      toolsById,
    );
    expect(r.ok).toBe(false);
    expect(r.errors.join("\n")).toMatch(/ships nothing usable/);
  });

  it("rejects malformed payloads with schema issues", () => {
    const r = validatePackageVersion({ nope: true }, toolsById);
    expect(r.ok).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });
});

describe("canonicalManifest", () => {
  it("normalizes camelCase tool refs to the wire shape", () => {
    const m = canonicalManifest({
      tools: [{ toolId: TOOL_ID, toolVersion: "1.0.0", scopes: ["invoke"] }],
      skills: ["a"],
      subagentConfigs: ["s"],
      permissions: [],
      modelRouting: {},
      budgetTemplate: {},
      starterPrompts: [],
      templateRefs: [],
      minAgentVersion: "0.9.0",
    });
    expect(m.tools[0]).toEqual({
      tool_id: TOOL_ID,
      tool_version: "1.0.0",
      scopes: ["invoke"],
    });
    expect(m.subagent_configs).toEqual(["s"]);
    expect(m.min_agent_version).toBe("0.9.0");
  });

  it("passes wire-shaped refs through unchanged", () => {
    const m = canonicalManifest({
      tools: [{ tool_id: TOOL_ID, tool_version: "1.1.0", scopes: [] }],
      skills: [],
      subagentConfigs: [],
      permissions: [],
      modelRouting: {},
      budgetTemplate: {},
      starterPrompts: [],
      templateRefs: [],
      minAgentVersion: "0.0.0",
    });
    expect(m.tools[0]).toEqual({ tool_id: TOOL_ID, tool_version: "1.1.0", scopes: [] });
  });
});
