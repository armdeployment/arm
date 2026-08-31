/**
 * Manifest v2 golden vector (guide 00 §4).
 *
 * `packages/proto` is zod-schemas-only (zero internal imports) — the real
 * canonicalizer/hasher lives in `@arm/catalog` (DB side) and `@arm/client-core`
 * (client side), which the `library` and `client` Wave-1 agents reimplement
 * and test against THIS committed fixture + its expected sha256, so both
 * implementations are proven byte-identical against one shared artifact.
 *
 * This test only proves the fixture is internally consistent: it parses
 * against `packageManifestV2Schema`, its arrays are pre-sorted per the field
 * list's ordering rule, and a local (test-only) reimplementation of the
 * canonicalize-then-sha256 algorithm — the SAME algorithm `@arm/catalog`'s
 * `manifestSha256` already uses (packages/catalog/src/hash.ts: recursively
 * sort object keys, JSON.stringify, sha256 hex; arrays are hashed in the
 * order given, so callers pre-sort them) — reproduces the committed hash.
 * The canonicalizer here is NOT exported from src/ on purpose: it is a test
 * fixture, not a proto "business logic" export.
 */

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { packageManifestV2Schema } from "../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const GOLDEN_MANIFEST: unknown = JSON.parse(
  readFileSync(resolve(__dirname, "fixtures/manifest-v2-golden.json"), "utf8"),
);
const { sha256: GOLDEN_SHA256 } = JSON.parse(
  readFileSync(resolve(__dirname, "fixtures/manifest-v2-golden.sha256.json"), "utf8"),
) as { sha256: string };

/** Mirrors @arm/catalog's canonicalize (packages/catalog/src/hash.ts): object
 *  keys sorted recursively, arrays hashed in the order given (NOT re-sorted
 *  here — the manifest v2 contract requires callers to pre-sort components/
 *  permissions/job_functions before hashing). */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      const v = record[key];
      if (v !== undefined) out[key] = canonicalize(v);
    }
    return out;
  }
  return value;
}

function sha256Of(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex");
}

describe("manifest v2 golden vector (guide 00 §4)", () => {
  it("parses against packageManifestV2Schema", () => {
    const parsed = packageManifestV2Schema.safeParse(GOLDEN_MANIFEST);
    expect(parsed.success).toBe(true);
  });

  it("has exactly the 8 hashed fields, nothing else", () => {
    expect(Object.keys(GOLDEN_MANIFEST as object).sort()).toEqual(
      [
        "budget_template",
        "components",
        "job_functions",
        "manifest_version",
        "min_agent_version",
        "model_routing",
        "permissions",
        "starter_prompts",
      ].sort(),
    );
  });

  it("components are sorted by component_id", () => {
    const { components } = GOLDEN_MANIFEST as { components: { component_id: string }[] };
    const ids = components.map((c) => c.component_id);
    expect(ids).toEqual([...ids].sort());
  });

  it("permissions and job_functions are sorted lexicographically", () => {
    const { permissions, job_functions } = GOLDEN_MANIFEST as {
      permissions: string[];
      job_functions: string[];
    };
    expect(permissions).toEqual([...permissions].sort());
    expect(job_functions).toEqual([...job_functions].sort());
  });

  it("committed sha256 is a well-formed 64-char hex digest", () => {
    expect(GOLDEN_SHA256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("hashes the fixed canonical manifest to the golden constant", () => {
    expect(sha256Of(GOLDEN_MANIFEST)).toBe(GOLDEN_SHA256);
  });

  it("is invariant to top-level key-order permutations", () => {
    const m = GOLDEN_MANIFEST as Record<string, unknown>;
    const permuted = {
      job_functions: m.job_functions,
      min_agent_version: m.min_agent_version,
      components: m.components,
      starter_prompts: m.starter_prompts,
      budget_template: m.budget_template,
      permissions: m.permissions,
      model_routing: m.model_routing,
      manifest_version: m.manifest_version,
    };
    expect(sha256Of(permuted)).toBe(GOLDEN_SHA256);
  });
});
