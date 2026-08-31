/**
 * GOLDEN-VECTOR test for the canonical package manifest v2
 * (docs/guides/00-shared-contracts.md §4, docs/guides/01-library-artifactory.md §4.5).
 *
 * Reads the SHARED fixture committed by the `contracts` (Wave 0) agent at
 * `packages/proto/test/fixtures/manifest-v2-golden.json` (+ its
 * `.sha256.json` companion) rather than hand-copying a local constant — this
 * is what proves `@arm/catalog`'s `canonicalManifest`/`manifestSha256`
 * produce byte-identical output to `@arm/client-core`'s
 * `buildCanonicalManifest` (both sides read the SAME fixture + expected
 * hash; `packages/proto/test/manifest-v2-golden.test.ts` proves the fixture
 * itself is internally consistent). If either side's canonicalizer diverges
 * from the fixture, that side's suite goes red — the fixture wins (guide 01
 * §4, coordination note).
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { manifestSha256, canonicalManifest, packageManifestV2Schema } from "../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROTO_FIXTURES_DIR = resolve(__dirname, "../../proto/test/fixtures");

const GOLDEN_MANIFEST: unknown = JSON.parse(
  readFileSync(resolve(PROTO_FIXTURES_DIR, "manifest-v2-golden.json"), "utf8"),
);
const { sha256: GOLDEN_SHA256 } = JSON.parse(
  readFileSync(resolve(PROTO_FIXTURES_DIR, "manifest-v2-golden.sha256.json"), "utf8"),
) as { sha256: string };

describe("canonical manifest v2 golden vector (shared with @arm/proto + @arm/client-core)", () => {
  it("the golden fixture parses against packageManifestV2Schema", () => {
    expect(packageManifestV2Schema.safeParse(GOLDEN_MANIFEST).success).toBe(true);
  });

  it("@arm/catalog's canonicalManifest + manifestSha256 hash the golden fixture to the golden constant", () => {
    expect(manifestSha256(canonicalManifest(GOLDEN_MANIFEST as Record<string, unknown>))).toBe(
      GOLDEN_SHA256,
    );
  });

  it("is invariant to top-level key-order permutations", () => {
    const m = GOLDEN_MANIFEST as Record<string, unknown>;
    const permuted = {
      job_functions: m["job_functions"],
      min_agent_version: m["min_agent_version"],
      components: m["components"],
      starter_prompts: m["starter_prompts"],
      budget_template: m["budget_template"],
      permissions: m["permissions"],
      model_routing: m["model_routing"],
      manifest_version: m["manifest_version"],
    };
    expect(manifestSha256(canonicalManifest(permuted as Record<string, unknown>))).toBe(
      GOLDEN_SHA256,
    );
  });

  it("canonicalizes the DB (camelCase) source form to the same hash", () => {
    const m = GOLDEN_MANIFEST as {
      components: { component_id: string; version: string; kind: string; scopes: string[] }[];
      permissions: string[];
      model_routing: Record<string, unknown>;
      budget_template: Record<string, unknown>;
      starter_prompts: string[];
      min_agent_version: string;
      job_functions: string[];
    };
    const camelSource = {
      components: m.components.map((c) => ({
        componentId: c.component_id,
        version: c.version,
        kind: c.kind,
        scopes: c.scopes,
      })),
      permissions: m.permissions,
      modelRouting: m.model_routing,
      budgetTemplate: m.budget_template,
      starterPrompts: m.starter_prompts,
      minAgentVersion: m.min_agent_version,
      jobFunctions: m.job_functions,
    };
    const canonical = canonicalManifest(camelSource);
    expect(canonical).toEqual(canonicalManifest(GOLDEN_MANIFEST as Record<string, unknown>));
    expect(manifestSha256(canonical)).toBe(GOLDEN_SHA256);
  });
});
