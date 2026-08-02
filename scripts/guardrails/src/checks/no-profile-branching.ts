/**
 * guardrail: no-profile-branching (D6).
 *
 * Enforces the governing rule from docs/solutions/2026-08-02-d6-industry-profile.md:
 *
 *   "Everything that makes ARM good for manufacturing is a capability every
 *    tenant could have. The profile only ever sets defaults — it never gates
 *    a capability."
 *
 * This check fails if `industryProfile` (or `getProfile`, or profile preset
 * objects) is referenced inside enforcement paths:
 *   - packages/policy
 *   - apps/data-plane/**
 *   - apps/simulation/src/proxy.ts (the simulation proxy)
 *
 * Only these locations may read the profile:
 *   - packages/profiles (the package itself)
 *   - apps/simulation/src/db-init.ts (provisioning / seeding)
 *   - apps/control-plane/web (UI presentation via registry)
 *   - apps/cli (onboarding wizard)
 *
 * Asserts a NEGATIVE (no branching found) → subject to the vacuous-guard rule:
 * if it scans zero files, it is FAIL, not PASS (spec §14.2).
 */

import { register, type CheckResult } from "../types.js";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Paths (relative to repo root) where reading the profile is ALLOWED.
 * Everything else is a violation.
 */
const ALLOWED_PATHS = [
  "packages/profiles/",
  "apps/simulation/src/db-init", // provisioning / seeding
  "apps/control-plane/web/", // UI presentation via registry
  "apps/cli/", // onboarding wizard
  "packages/db/src/schema/org-tree", // schema definition (column)
  "packages/db/src/schema/enums", // enum definition
  "scripts/guardrails/", // this guardrail itself
  "packages/profiles/test", // tests for the profiles package
];

/**
 * Patterns that indicate a profile branch / read.
 * Matching any of these in a non-allowed path is a violation.
 */
const BRANCH_PATTERNS = [
  /\bindustryProfile\b/,
  /\bindustry_profile\b/,
  /\bgetProfile\s*\(/,
  /\btechProfile\b/,
  /\bmanufacturingProfile\b/,
  /\bfinanceProfile\b/,
  /\bholdingProfile\b/,
  /\bprofileId\b/,
  // `if (profile === "manufacturing")` or similar
  /profile\s*===?\s*["'](tech|manufacturing|finance|holding|custom)["']/,
  /["'](tech|manufacturing|finance|holding|custom)["']\s*===?\s*profile/,
];

/** Directories to scan for violations. */
const SCAN_DIRS = [
  "packages/policy/src",
  "packages/auth/src",
  "packages/billing/src",
  "apps/data-plane",
  "apps/simulation/src/proxy.ts",
];

interface Violation {
  file: string;
  line: number;
  match: string;
}

function* walkDir(dir: string): Generator<string> {
  if (!fs.existsSync(dir)) return;
  const stat = fs.statSync(dir);
  if (stat.isFile()) {
    if (dir.endsWith(".ts") || dir.endsWith(".tsx")) yield dir;
    return;
  }
  for (const entry of fs.readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".git" || entry === "dist") continue;
    yield* walkDir(path.join(dir, entry));
  }
}

function isAllowed(filePath: string): boolean {
  const rel = filePath.replace(/^(\.\/)+/, "");
  return ALLOWED_PATHS.some((p) => rel.startsWith(p) || rel.includes(p));
}

/** Pure function form — used by mutation proofs. */
export function checkNoProfileBranching(
  files: { path: string; content: string }[],
): CheckResult {
  const violations: Violation[] = [];

  for (const f of files) {
    if (isAllowed(f.path)) continue;

    const lines = f.content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      // Skip comments and import statements (imports of the profiles package
      // in data-plane code are caught by boundaries check, not this one)
      const trimmed = line.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) {
        continue;
      }

      for (const pattern of BRANCH_PATTERNS) {
        if (pattern.test(line)) {
          violations.push({
            file: f.path,
            line: i + 1,
            match: trimmed.substring(0, 100),
          });
          break; // one violation per line is enough
        }
      }
    }
  }

  const scanned = files.length;

  if (violations.length > 0) {
    return {
      id: "no-profile-branching",
      status: "fail",
      detail: violations
        .map((v) => `${v.file}:${v.line} — "${v.match}"`)
        .join("\n"),
      scanned,
      assertsNegative: true,
    };
  }

  return {
    id: "no-profile-branching",
    status: "pass",
    scanned,
    assertsNegative: true,
  };
}

// ── Registered check (reads real filesystem) ───────────────────────────────

register({
  id: "no-profile-branching",
  description:
    "Industry profile must not be branched on in enforcement paths (D6). Only provisioning + UI presentation may read it.",
  invariant:
    "D6: profile sets defaults, never gates capabilities (docs/solutions/2026-08-02-d6-industry-profile.md)",
  run: () => {
    const repoRoot = path.resolve(import.meta.dirname, "../../../..");

    const files: { path: string; content: string }[] = [];
    for (const dir of SCAN_DIRS) {
      const fullDir = path.join(repoRoot, dir);
      for (const filePath of walkDir(fullDir)) {
        const content = fs.readFileSync(filePath, "utf-8");
        files.push({ path: path.relative(repoRoot, filePath), content });
      }
    }

    // Vacuous-guard enforcement: must scan at least the known enforcement paths
    if (files.length < 5) {
      return {
        id: "no-profile-branching",
        status: "fail" as const,
        detail: `Expected ≥5 enforcement-path files, found ${files.length}. Guard may be scanning the wrong directory.`,
        scanned: files.length,
        assertsNegative: true,
      };
    }

    return checkNoProfileBranching(files);
  },
});
