/**
 * Golden-vector test for the canonical manifest v2 contract (guide 00 §4,
 * guide 03 §5). The control plane (@arm/catalog, owned by the `library`
 * Wave-1 agent) hashes the snake_case canonical manifest v2 object; the
 * client must build the byte-identical object or every integrity check
 * fails. Both sides are tested against the SAME committed fixture at
 * packages/proto/test/fixtures/manifest-v2-golden.json (+ its expected
 * sha256) so drift is caught without either package importing the other
 * (the dependency-direction guardrail forbids it).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { buildCanonicalManifest, verifyManifestIntegrity, manifestSha256 } from "../src/index.js";
import type { WorkPackageVersion } from "../src/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = resolve(here, "../../proto/test/fixtures");

const GOLDEN_MANIFEST = JSON.parse(
  readFileSync(resolve(FIXTURE_DIR, "manifest-v2-golden.json"), "utf8"),
) as {
  manifest_version: 2;
  components: { component_id: string; version: string; kind: string; scopes: string[] }[];
  permissions: string[];
  model_routing: Record<string, unknown>;
  budget_template: Record<string, unknown>;
  starter_prompts: string[];
  min_agent_version: string;
  job_functions: string[];
};

const GOLDEN_SHA256 = (
  JSON.parse(readFileSync(resolve(FIXTURE_DIR, "manifest-v2-golden.sha256.json"), "utf8")) as {
    sha256: string;
  }
).sha256;

/** The wire-shaped (proto snake_case) version carrying the golden fields, fed
 *  in DELIBERATELY UNSORTED order to prove buildCanonicalManifest re-sorts
 *  rather than trusting DB/wire order. */
function goldenWireVersion(): WorkPackageVersion {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    package_id: "33333333-3333-4333-8333-333333333333",
    version: "1.0.0",
    manifest_version: 2,
    // reversed from the golden fixture's sorted order
    components: [...GOLDEN_MANIFEST.components].reverse() as WorkPackageVersion["components"],
    permissions: [...GOLDEN_MANIFEST.permissions].reverse(),
    model_routing: GOLDEN_MANIFEST.model_routing,
    budget_template: GOLDEN_MANIFEST.budget_template,
    starter_prompts: GOLDEN_MANIFEST.starter_prompts,
    min_agent_version: GOLDEN_MANIFEST.min_agent_version,
    job_functions: [...GOLDEN_MANIFEST.job_functions].reverse(),
    manifest_sha256: GOLDEN_SHA256,
  };
}

describe("canonical manifest v2 golden vector (shared with @arm/catalog)", () => {
  it("buildCanonicalManifest re-sorts unsorted input into the golden canonical object", () => {
    expect(buildCanonicalManifest(goldenWireVersion())).toEqual(GOLDEN_MANIFEST);
  });

  it("manifestSha256 of the golden canonical object equals the committed golden hash", () => {
    expect(manifestSha256(GOLDEN_MANIFEST)).toBe(GOLDEN_SHA256);
  });

  it("verifyManifestIntegrity accepts the golden wire version", () => {
    expect(verifyManifestIntegrity(goldenWireVersion())).toBe(true);
  });

  it("golden hash changes when any field drifts", () => {
    expect(manifestSha256({ ...GOLDEN_MANIFEST, job_functions: ["different"] })).not.toBe(
      GOLDEN_SHA256,
    );
    expect(
      manifestSha256({ ...GOLDEN_MANIFEST, budget_template: { monthly_usd_cap: 999 } }),
    ).not.toBe(GOLDEN_SHA256);
  });
});
