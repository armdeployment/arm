/**
 * guardrail: package-integrity (D9).
 *
 * Every package version pins existing tool versions and is content-addressed:
 * `manifest_sha256` covers the canonical manifest JSON so a client can verify
 * a tamper-free config at install and at agent start
 * (docs/solutions/2026-08-13-d9-work-packages.md §Consequences → Guardrails).
 * Any recompute mismatch is red.
 *
 * Pure-function form (`checkPackageIntegrity`) is exercised by mutation proofs.
 * The registered check asserts the DB substrate — nonNull `manifest_sha256` on
 * BOTH `toolVersionTable` and `workPackageVersionTable` — and that the shipped
 * profile presets define `workPackages` blocks whose entries pin semver-ish
 * `toolVersion`s. It ALSO recomputes every shipped @arm/catalog
 * `packageVersionFixtures` manifest hash (via @arm/catalog's own
 * `canonicalManifest` + `manifestSha256`) and rejects tool refs pointing at
 * unknown Tool Registry ids (dangling-ref detection, D9 M5). If profiles
 * haven't landed `workPackages` yet, the registered check FAILS LOUDLY
 * (spec §14.2 vacuous-guard rule).
 */

import { register, type CheckResult } from "../types.js";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { profileScans, SEMVER_ISH, valuesForKey } from "./d9-shared.js";

/**
 * Canonical JSON: recursively sorted keys, no whitespace. Deterministic across
 * key insertion order — the same canonicalization @arm/catalog applies before
 * hashing. Implemented locally so the pure `checkPackageIntegrity` mutation
 * proofs stay self-contained; the registered fixture verification uses
 * @arm/catalog's own `canonicalManifest` + `manifestSha256` (loaded at run
 * time via dynamic import).
 */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`);
  return `{${entries.join(",")}}`;
}

/** sha256 hex over the canonical JSON form — mirrors `manifest_sha256` semantics. */
export function sha256Canonical(value: unknown): string {
  return createHash("sha256").update(canonicalize(value), "utf-8").digest("hex");
}

/** A versioned manifest as shipped: the declared hash + the raw manifest JSON. */
export interface VersionedManifest {
  manifestSha256: string;
  manifestJson: unknown;
}

/** Pure function form — used by mutation proofs. */
export function checkPackageIntegrity(versions: VersionedManifest[]): CheckResult {
  const violations: string[] = [];

  for (const [i, v] of versions.entries()) {
    const actual = sha256Canonical(v.manifestJson);
    if (actual !== v.manifestSha256) {
      violations.push(
        `index ${i}: manifest_sha256 mismatch — declared ${v.manifestSha256}, recomputed ${actual} (canonical JSON)`,
      );
    }
  }

  const scanned = versions.length;
  if (violations.length > 0) {
    return {
      id: "package-integrity",
      status: "fail",
      detail: violations.join("\n"),
      scanned,
      assertsNegative: true,
    };
  }
  return {
    id: "package-integrity",
    status: "pass",
    scanned,
    assertsNegative: scanned > 0,
  };
}

// ── Shipped fixture verification (real @arm/catalog wire rows) ─────────────

/** Tool ref in the shipped wire-shaped (snake_case) package version fixtures. */
export interface CatalogFixtureToolRef {
  tool_id: string;
  tool_version: string;
  scopes?: string[];
}

/** A wire-shaped package version fixture as @arm/catalog ships it. */
export interface CatalogVersionFixture {
  manifest_sha256: string;
  tools?: CatalogFixtureToolRef[];
}

/** Hash tooling contract: the canonicalizer + digest used to recompute hashes. */
export interface ManifestHashTools {
  canonicalManifest: (source: unknown) => unknown;
  manifestSha256: (value: unknown) => string;
}

/**
 * Pure function form over the shipped @arm/catalog fixture shape. Recomputes
 * each fixture's `manifest_sha256` through the provided canonicalizer + digest
 * (the registered check passes @arm/catalog's own `canonicalManifest` +
 * `manifestSha256`), and rejects tool refs pointing at unknown Tool Registry
 * ids (dangling-ref detection, D9 M5). Exercised by mutation proofs.
 */
export function verifyFixtureIntegrity(
  fixtures: CatalogVersionFixture[],
  hashTools: ManifestHashTools,
  knownToolIds?: ReadonlySet<string>,
): CheckResult {
  const violations: string[] = [];

  for (const [i, f] of fixtures.entries()) {
    const actual = hashTools.manifestSha256(hashTools.canonicalManifest(f));
    if (actual !== f.manifest_sha256) {
      violations.push(
        `index ${i}: fixture manifest_sha256 mismatch — declared ${f.manifest_sha256}, recomputed ${actual} (canonical JSON)`,
      );
    }
    for (const [j, ref] of (f.tools ?? []).entries()) {
      if (knownToolIds !== undefined && !knownToolIds.has(ref.tool_id)) {
        violations.push(
          `index ${i}: tools[${j}].tool_id "${ref.tool_id}" not in the Tool Registry id set (dangling ref — M5)`,
        );
      }
    }
  }

  const scanned = fixtures.length;
  if (violations.length > 0) {
    return {
      id: "package-integrity",
      status: "fail",
      detail: violations.join("\n"),
      scanned,
      assertsNegative: true,
    };
  }
  return {
    id: "package-integrity",
    status: "pass",
    scanned,
    assertsNegative: scanned > 0,
  };
}

// ── Registered check (scans shipped schema + profile presets + fixtures) ───

register({
  id: "package-integrity",
  description:
    "Package/tool manifests are content-addressed: nonNull manifest_sha256 on both version tables; profile workPackages pin semver-ish tool versions; shipped @arm/catalog packageVersionFixtures rehash clean and their tool refs resolve (no dangling refs) (D9).",
  invariant:
    "D9: every package version pins existing tool versions; templates/skills are content-addressed (sha256); no dangling references (docs/solutions/2026-08-13-d9-work-packages.md)",
  run: async () => {
    const repoRoot = path.resolve(import.meta.dirname, "../../../..");
    const schemaPath = path.join(repoRoot, "packages/db/src/schema/catalog.ts");
    const scans = profileScans(repoRoot);

    if (scans.length === 0) {
      return {
        id: "package-integrity",
        status: "fail" as const,
        detail:
          "No profile preset files found under packages/profiles/src/*.profile.ts — guard scanning the wrong directory.",
        scanned: 0,
        assertsNegative: true,
      };
    }

    // ── DB substrate: manifest_sha256 nonNull on BOTH version tables ────────
    const tableIssues: string[] = [];
    if (!fs.existsSync(schemaPath)) {
      tableIssues.push(`catalog schema file not found: ${schemaPath}`);
    } else {
      const schema = fs.readFileSync(schemaPath, "utf-8");
      const needle = 'text("manifest_sha256").notNull()';
      const shaCount = schema.split(needle).length - 1;
      if (!schema.includes("export const toolVersionTable")) {
        tableIssues.push("toolVersionTable missing from catalog.ts");
      }
      if (!schema.includes("export const workPackageVersionTable")) {
        tableIssues.push("workPackageVersionTable missing from catalog.ts");
      }
      if (shaCount < 2) {
        tableIssues.push(
          `nonNull manifest_sha256 asserted on ${shaCount} table(s) — required on both toolVersionTable and workPackageVersionTable`,
        );
      }
    }

    // ── Profile presets: workPackages blocks with pinned tool versions ──────
    const wpScans = scans.filter((s) => s.hasWorkPackages);
    if (wpScans.length === 0) {
      return {
        id: "package-integrity",
        status: "fail" as const,
        detail:
          `No 'workPackages' arrays found in ${scans.length} profile preset file(s) ` +
          `(${scans.map((s) => s.file).join(", ")}) — VACUOUS GUARD: asserted over empty input (spec §14.2).`,
        scanned: 0,
        assertsNegative: true,
      };
    }

    const blockIssues: string[] = [];
    for (const s of wpScans) {
      if (s.block === null) {
        blockIssues.push(`${s.file}: 'workPackages' present but not an inline array — cannot verify tool pins`);
        continue;
      }
      const toolsCount = (s.block.match(/\btools\s*:/g) ?? []).length;
      const toolVersions = valuesForKey(s.block, "toolVersion");
      const nonSemver = toolVersions.filter((v) => !SEMVER_ISH.test(v));
      if (toolsCount === 0) {
        blockIssues.push(`${s.file}: workPackages entries missing 'tools' field (no pinned tool versions)`);
      }
      if (toolVersions.length === 0) {
        blockIssues.push(`${s.file}: no 'toolVersion' pins found in workPackages`);
      } else if (nonSemver.length > 0) {
        blockIssues.push(`${s.file}: non-semver toolVersion pin(s): ${nonSemver.join(", ")}`);
      }
    }

    if (tableIssues.length > 0 || blockIssues.length > 0) {
      return {
        id: "package-integrity",
        status: "fail" as const,
        detail: [...tableIssues, ...blockIssues].join("\n"),
        scanned: wpScans.length,
        assertsNegative: true,
      };
    }

    // ── Shipped fixture rows: recompute real hashes + dangling-ref scan ─────
    let fixturesScanned = 0;
    try {
      const catalog = await import("@arm/catalog");
      const hashTools: ManifestHashTools = {
        canonicalManifest: catalog.canonicalManifest as ManifestHashTools["canonicalManifest"],
        manifestSha256: catalog.manifestSha256,
      };
      const knownToolIds = new Set(Object.values(catalog.toolIdFixtures));
      const fixtureCheck = verifyFixtureIntegrity(
        catalog.packageVersionFixtures,
        hashTools,
        knownToolIds,
      );
      fixturesScanned = fixtureCheck.scanned;
      if (fixtureCheck.status === "fail") {
        return {
          id: "package-integrity",
          status: "fail" as const,
          detail: fixtureCheck.detail ?? "shipped fixture verification failed",
          scanned: wpScans.length + fixturesScanned,
          assertsNegative: true,
        };
      }
    } catch (err) {
      return {
        id: "package-integrity",
        status: "fail" as const,
        detail: `@arm/catalog fixture verification unavailable: ${String(err)}`,
        scanned: wpScans.length,
        assertsNegative: true,
      };
    }

    return {
      id: "package-integrity",
      status: "pass" as const,
      scanned: wpScans.length + fixturesScanned,
      assertsNegative: true,
    };
  },
});
