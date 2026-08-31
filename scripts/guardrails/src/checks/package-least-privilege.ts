/**
 * guardrail: package-least-privilege (D9).
 *
 * A package's permissions must not exceed its role preset baseline plus
 * explicit per-tenant grants — deny-override applies unchanged (Invariant 3,
 * docs/solutions/2026-08-13-d9-work-packages.md §Consequences → Guardrails).
 * The permission vocabulary is deny-by-default:
 *   - entries must be `resource|tool|org_node:<key>:<verb>` (or the legacy
 *     `org_node:*` delegation form),
 *   - bare wildcard grants (`resource:*`, `tool:*`) are violations,
 *   - duplicates are violations.
 *
 * Pure-function form (`checkLeastPrivilege`) is exercised by mutation proofs.
 * The registered check scans profile presets' `workPackages` blocks for
 * `permissions:` arrays and validates every entry. Files that define
 * `workPackages` but carry zero permission entries, or a repo with no
 * `workPackages` at all, FAIL LOUDLY (spec §14.2 vacuous-guard rule).
 */

import { register, type CheckResult } from "../types.js";
import * as path from "node:path";
import { arraysForKey, profileScans } from "./d9-shared.js";

/**
 * Standard grant form: `resource:<key>:<verb>` | `org_node:<key>:<verb>` |
 * `tool:<key>:<verb>` where the tool verb must be one of the D9 verbs
 * (invoke|configure|publish) and MUST come last — the grammar is key-then-verb
 * across all three namespaces (D9 sub-decision 3, standardized 2026-08-13).
 */
const PERMISSION_FORM =
  /^(resource|org_node):[a-z0-9_.-]+:[a-z_]+$|^tool:[a-z0-9_.-]+:(invoke|configure|publish)$/;

/** Legacy org-wide delegation form — allowed (D8). */
const LEGACY_ORG_STAR = /^org_node:\*$/;

/** Bare wildcard grants — deny-by-default design forbids them. */
const BARE_WILDCARD = /^(resource|tool):\*$/;

/** Pure function form — used by mutation proofs. */
export function checkLeastPrivilege(permissions: string[]): CheckResult {
  const violations: string[] = [];
  const seen = new Set<string>();

  for (const [i, p] of permissions.entries()) {
    const bare = BARE_WILDCARD.test(p);
    const legacy = LEGACY_ORG_STAR.test(p);

    if (bare) {
      violations.push(
        `index ${i}: bare wildcard grant "${p}" — deny-by-default; grant explicit keys only`,
      );
    }
    if (!legacy && !bare && !PERMISSION_FORM.test(p)) {
      violations.push(
        `index ${i}: malformed permission "${p}" (expected resource|tool|org_node:key:verb or legacy org_node:*)`,
      );
    }
    if (seen.has(p)) {
      violations.push(`index ${i}: duplicate permission "${p}"`);
    }
    seen.add(p);
  }

  const scanned = permissions.length;
  if (violations.length > 0) {
    return {
      id: "package-least-privilege",
      status: "fail",
      detail: violations.join("\n"),
      scanned,
      assertsNegative: true,
    };
  }
  return {
    id: "package-least-privilege",
    status: "pass",
    scanned,
    assertsNegative: scanned > 0,
  };
}

// ── Registered check (scans shipped profile presets) ───────────────────────

register({
  id: "package-least-privilege",
  description:
    "Every permission in a profile's workPackages blocks must be an explicit scoped grant (no bare wildcards, no duplicates) — deny-by-default (D9, Invariant 3).",
  invariant:
    "D9: a package's permissions must not exceed its role preset baseline plus explicit per-tenant grants; deny-override applies (Invariant 3)",
  run: () => {
    const repoRoot = path.resolve(import.meta.dirname, "../../../..");
    const scans = profileScans(repoRoot);

    if (scans.length === 0) {
      return {
        id: "package-least-privilege",
        status: "fail" as const,
        detail:
          "No profile preset files found under packages/profiles/src/*.profile.ts — guard scanning the wrong directory.",
        scanned: 0,
        assertsNegative: true,
      };
    }

    const wpScans = scans.filter((s) => s.hasWorkPackages);
    if (wpScans.length === 0) {
      return {
        id: "package-least-privilege",
        status: "fail" as const,
        detail:
          `No 'workPackages' arrays found in ${scans.length} profile preset file(s) ` +
          `(${scans.map((s) => s.file).join(", ")}) — VACUOUS GUARD: asserted over empty input (spec §14.2).`,
        scanned: 0,
        assertsNegative: true,
      };
    }

    const issues: string[] = [];
    let totalEntries = 0;
    for (const s of wpScans) {
      if (s.block === null) {
        issues.push(
          `${s.file}: 'workPackages' present but not an inline array — cannot validate permissions`,
        );
        continue;
      }
      const arrays = arraysForKey(s.block, "permissions");
      if (arrays.length === 0) {
        issues.push(
          `${s.file}: workPackages defined but no 'permissions:' arrays — VACUOUS GUARD: least-privilege unchecked over an empty set (spec §14.2)`,
        );
        continue;
      }
      let fileEntries = 0;
      for (const [arrIdx, perms] of arrays.entries()) {
        fileEntries += perms.length;
        const result = checkLeastPrivilege(perms);
        if (result.status === "fail" && result.detail) {
          issues.push(`${s.file} (permissions array ${arrIdx}):\n${result.detail}`);
        }
      }
      if (fileEntries === 0) {
        issues.push(
          `${s.file}: workPackages defined but every permissions array is empty — VACUOUS GUARD: least-privilege unchecked over an empty set (spec §14.2)`,
        );
      }
      totalEntries += fileEntries;
    }

    if (issues.length > 0) {
      return {
        id: "package-least-privilege",
        status: "fail" as const,
        detail: issues.join("\n"),
        scanned: totalEntries,
        assertsNegative: true,
      };
    }

    return {
      id: "package-least-privilege",
      status: "pass" as const,
      scanned: totalEntries,
      assertsNegative: true,
    };
  },
});
