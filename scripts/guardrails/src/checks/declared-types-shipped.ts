/**
 * guardrail: declared-types-shipped.
 *
 * A package that ships JS must ship the declarations it advertises.
 *
 * Ten packages under packages/* point `types` (and, for @arm/db, a `./schema`
 * subpath) at a `.d.ts` inside dist/. Two separate tools produce that dist:
 * tsup writes the JS, and a second `tsc --project tsconfig.build.json` pass
 * writes the declarations. Nothing structurally ties the two together, and
 * they have come apart before:
 *
 *   tsup cleans dist/ on every run. `tsconfig.build.tsbuildinfo` used to live
 *   OUTSIDE dist/, so it survived that clean. tsc then read a build-info file
 *   describing outputs that no longer existed, concluded it was up to date,
 *   emitted nothing, and exited 0. The build "succeeded" with a dist/ that had
 *   index.js and no index.d.ts. Turbo cached that as a good build. Consumers
 *   failed much later and much further away with TS7016 "implicitly has an
 *   'any' type", pointing at the importer rather than the package.
 *
 * The cause is fixed (tsBuildInfoFile now lives in dist/, so the clean takes
 * the state with the outputs) and `|| true` no longer swallows a tsc failure.
 * But both of those are conventions in ten package.json files, and neither
 * catches the shape of the bug: a toolchain that exits 0 having emitted
 * nothing. Only looking at the artifact does.
 *
 * The check reads each package.json's declared entry points and, for every one
 * whose JS exists on disk, asserts the sibling .d.ts exists and is non-empty.
 * Entries whose JS is absent are simply not built yet and are skipped —
 * `pnpm guardrails` only forces a build of @arm/guardrails' own dependencies,
 * so a subset being unbuilt is normal and is not evidence of anything.
 */

import { register, type CheckResult } from "../types.js";
import * as fs from "node:fs";
import * as path from "node:path";

/** One `types`/`default` pair declared by a package.json exports entry. */
export interface DeclaredEntry {
  /** e.g. "@arm/db#./schema" — package plus subpath, for the failure message. */
  entry: string;
  /** Whether the JS artifact this entry points at exists on disk. */
  jsBuilt: boolean;
  /** Whether the .d.ts exists AND has content. */
  typesShipped: boolean;
}

/** Pure function form — used by mutation proofs. */
export function checkDeclaredTypesShipped(entries: DeclaredEntry[]): CheckResult {
  const built = entries.filter((e) => e.jsBuilt);
  const violations = built
    .filter((e) => !e.typesShipped)
    .map(
      (e) =>
        `${e.entry}: JS is built but its declared .d.ts is missing or empty — ` +
        `consumers will fail with TS7016 far from here`,
    );

  if (violations.length > 0) {
    return {
      id: "declared-types-shipped",
      status: "fail",
      detail: violations.join("\n"),
      scanned: built.length,
      assertsNegative: true,
    };
  }

  // Nothing built at all means the guard verified nothing. §14.2: a guard that
  // cannot fail is worse than no guard, so say so rather than passing green.
  if (built.length === 0) {
    return {
      id: "declared-types-shipped",
      status: "fail",
      detail:
        "no package under packages/* has a built dist/ — nothing to verify. " +
        "Run `pnpm build` first; a green result here would be vacuous.",
      scanned: 0,
      assertsNegative: true,
    };
  }

  return {
    id: "declared-types-shipped",
    status: "pass",
    scanned: built.length,
    assertsNegative: true,
  };
}

/**
 * Collects every `{ types, default }` pair a package.json declares, from both
 * the top-level `types`/`main` fields and each `exports` subpath.
 */
export function collectDeclaredEntries(
  pkgName: string,
  pkgJson: Record<string, unknown>,
  exists: (relPath: string) => boolean,
  hasContent: (relPath: string) => boolean,
): DeclaredEntry[] {
  const pairs: Array<{ subpath: string; types: string; js: string }> = [];

  const exportsField = pkgJson.exports;
  if (exportsField && typeof exportsField === "object") {
    for (const [subpath, cond] of Object.entries(exportsField as Record<string, unknown>)) {
      if (!cond || typeof cond !== "object") continue;
      const c = cond as Record<string, unknown>;
      const types = c.types;
      const js = c.default ?? c.import ?? c.require;
      if (typeof types === "string" && typeof js === "string") {
        pairs.push({ subpath, types, js });
      }
    }
  }

  // Fall back to the flat fields for packages that predate an exports map.
  if (pairs.length === 0) {
    const types = pkgJson.types ?? pkgJson.typings;
    const js = pkgJson.main;
    if (typeof types === "string" && typeof js === "string") {
      pairs.push({ subpath: ".", types, js });
    }
  }

  return (
    pairs
      // Only dist-backed entries are at risk; src-backed packages are consumed
      // as TypeScript and have no separate declaration step to lose.
      .filter((p) => p.types.includes("dist/"))
      .map((p) => ({
        entry: p.subpath === "." ? pkgName : `${pkgName}#${p.subpath}`,
        jsBuilt: exists(p.js),
        typesShipped: exists(p.types) && hasContent(p.types),
      }))
  );
}

register({
  id: "declared-types-shipped",
  description:
    "Every dist-backed package that has built its JS also ships the .d.ts its package.json advertises.",
  invariant: "build artifacts match their declared entry points",
  run: () => {
    const repoRoot = path.resolve(import.meta.dirname, "../../../..");
    const packagesDir = path.join(repoRoot, "packages");

    const entries: DeclaredEntry[] = [];
    for (const dir of fs.readdirSync(packagesDir).sort()) {
      const pkgPath = path.join(packagesDir, dir, "package.json");
      if (!fs.existsSync(pkgPath)) continue;
      const pkgJson = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as Record<string, unknown>;
      const name = typeof pkgJson.name === "string" ? pkgJson.name : dir;
      const resolve = (rel: string) => path.join(packagesDir, dir, rel);
      entries.push(
        ...collectDeclaredEntries(
          name,
          pkgJson,
          (rel) => fs.existsSync(resolve(rel)),
          (rel) => {
            try {
              return fs.statSync(resolve(rel)).size > 0;
            } catch {
              return false;
            }
          },
        ),
      );
    }

    return checkDeclaredTypesShipped(entries);
  },
});
