/**
 * Golden-vector test for the canonical manifest contract (D9 §package-integrity).
 *
 * The control plane (@arm/catalog) hashes the snake_case canonical manifest;
 * the client must build the identical snake_case object or every integrity
 * check fails (B1). This test embeds a fixed canonical manifest, hashes it
 * once with `manifestSha256`, and hardcodes the resulting hex as the expected
 * constant — mirroring @arm/catalog's golden vector. Any drift in
 * `buildCanonicalManifest` or `manifestSha256` fails loud here.
 */

import { describe, it, expect } from "vitest";
import { buildCanonicalManifest, verifyManifestIntegrity } from "../src/manifest.js";
import { manifestSha256 } from "../src/hash.js";
import type { WorkPackageVersion } from "../src/manifest.js";

/**
 * The fixed canonical manifest object — snake_case, the nine hashed fields.
 * MUST be byte-identical to the vector embedded in
 * @arm/catalog's packages/catalog/test/canonical-golden.test.ts.
 */
const GOLDEN_CANONICAL = {
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

/**
 * Precomputed sha256 hex of the golden canonical manifest above
 * (computed once via manifestSha256; hardcoded so this test detects
 * canonicalization drift without trusting the function under test).
 * MUST match the constant in @arm/catalog's mirror test.
 */
const GOLDEN_SHA256 = "6d88398ed8ffb4c1e0928f45a0d07440a0093b7e07cfd162a31fe0187e1e8f7d";

/** The wire-shaped (proto snake_case) version carrying the golden fields. */
function goldenWireVersion(): WorkPackageVersion {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    package_id: "33333333-3333-4333-8333-333333333333",
    version: "1.0.0",
    tools: GOLDEN_CANONICAL.tools,
    skills: GOLDEN_CANONICAL.skills,
    subagent_configs: GOLDEN_CANONICAL.subagent_configs,
    permissions: GOLDEN_CANONICAL.permissions,
    model_routing: GOLDEN_CANONICAL.model_routing,
    budget_template: GOLDEN_CANONICAL.budget_template,
    starter_prompts: GOLDEN_CANONICAL.starter_prompts,
    template_refs: GOLDEN_CANONICAL.template_refs,
    min_agent_version: GOLDEN_CANONICAL.min_agent_version,
    manifest_sha256: GOLDEN_SHA256,
  };
}

describe("canonical manifest golden vector", () => {
  it("buildCanonicalManifest produces the snake_case canonical object", () => {
    expect(buildCanonicalManifest(goldenWireVersion())).toEqual(GOLDEN_CANONICAL);
  });

  it("manifestSha256 of the canonical object equals the hardcoded golden hash", () => {
    expect(manifestSha256(GOLDEN_CANONICAL)).toBe(GOLDEN_SHA256);
  });

  it("verifyManifestIntegrity accepts the golden wire version", () => {
    expect(verifyManifestIntegrity(goldenWireVersion())).toBe(true);
  });

  it("golden hash changes when any field drifts", () => {
    expect(
      manifestSha256({ ...GOLDEN_CANONICAL, skills: ["different-skill"] }),
    ).not.toBe(GOLDEN_SHA256);
    expect(
      manifestSha256({ ...GOLDEN_CANONICAL, budget_template: { monthly_usd_cap: 999 } }),
    ).not.toBe(GOLDEN_SHA256);
  });
});
