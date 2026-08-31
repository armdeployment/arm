/**
 * guardrail: questionnaire-determinism (D10, guide 00 §9 — STUB, filled by `client`).
 *
 * Polices: the questionnaire→job-function/recommendation mapping module
 * imports nothing outside `@arm/proto`/`@arm/config` (guide 00 §7 — enforced
 * independently here too, not just by `boundaries`, so this guard reads as a
 * standalone determinism proof); and no `fetch`, `Date.now`, `Math.random`,
 * or `crypto.randomUUID` is reachable from it — a pure function of its
 * inputs is the only way `questionnaire_response.recommended_package_version_ids`
 * can be reproduced/audited later.
 *
 * `checkQuestionnaireDeterminism` is the real, testable rule (exercised by
 * the mutation proofs below). The REGISTERED check scans
 * `packages/questionnaire/src/**\/*.ts`, which does not exist yet — `client`
 * (Wave 1, docs/guides/03-client-downloader.md) owns that package. Per spec
 * §14.2 / AGENTS.md ("a lint that scans zero files is red, not green"), this
 * is reported HONESTLY as a vacuous failure until that package exists.
 */

import { register, type CheckResult } from "../types.js";

/** Substrings that indicate a non-deterministic or I/O-bearing call. Matched
 *  as plain substrings (not word-boundary regex) so `SomeClass.fetch(...)`
 *  and `window.fetch(...)` are both caught — false positives are cheap here;
 *  false negatives are not. */
const BANNED_CALLS = ["fetch(", "Date.now(", "Math.random(", "crypto.randomUUID("];

/** Packages the questionnaire mapping module may import — nothing else. */
const ALLOWED_IMPORTS = new Set(["proto", "config"]);

const IMPORT_RE = /(?:import|export)[\s\S]*?from\s+["'](@arm\/[a-z-]+)["']/g;

export interface DeterminismViolation {
  file: string;
  issue: string;
}

/** Pure function form — used by mutation proofs. */
export function checkQuestionnaireDeterminism(
  files: { path: string; content: string }[],
): CheckResult {
  const violations: DeterminismViolation[] = [];
  for (const f of files) {
    for (const call of BANNED_CALLS) {
      if (f.content.includes(call)) {
        violations.push({ file: f.path, issue: `calls non-deterministic/IO primitive "${call}"` });
      }
    }
    for (const m of f.content.matchAll(IMPORT_RE)) {
      const pkg = m[1]!.replace(/^@arm\//, "");
      if (!ALLOWED_IMPORTS.has(pkg)) {
        violations.push({ file: f.path, issue: `imports @arm/${pkg} — only proto/config allowed` });
      }
    }
  }
  if (violations.length > 0) {
    return {
      id: "questionnaire-determinism",
      status: "fail",
      detail: violations.map((v) => `${v.file}: ${v.issue}`).join("; "),
      scanned: files.length,
      assertsNegative: true,
    };
  }
  return {
    id: "questionnaire-determinism",
    status: "pass",
    scanned: files.length,
    assertsNegative: true,
  };
}

register({
  id: "questionnaire-determinism",
  description:
    "The questionnaire mapping module imports only @arm/proto and @arm/config, and calls no fetch/Date.now/Math.random/crypto.randomUUID (D10).",
  invariant: "D10: guide 00 §9 — reproducible/auditable questionnaire recommendations",
  run: async () => {
    const { readdirSync, readFileSync, statSync, existsSync } = await import("node:fs");
    const { join, extname, resolve } = await import("node:path");

    let root = process.cwd();
    for (let i = 0; i < 8 && !existsSync(join(root, "pnpm-workspace.yaml")); i++) {
      const parent = resolve(root, "..");
      if (parent === root) break;
      root = parent;
    }

    const dir = join(root, "packages/questionnaire/src");
    const files: { path: string; content: string }[] = [];
    if (existsSync(dir)) {
      const walk = (d: string, rel: string): void => {
        for (const entry of readdirSync(d)) {
          if (
            entry === "node_modules" ||
            entry === ".git" ||
            entry === "dist" ||
            entry === ".turbo"
          )
            continue;
          const p = join(d, entry);
          const st = statSync(p);
          if (st.isDirectory()) walk(p, `${rel}${entry}/`);
          else if (extname(p) === ".ts") {
            files.push({ path: rel + entry, content: readFileSync(p, "utf8") });
          }
        }
      };
      walk(dir, "packages/questionnaire/src/");
    }
    // packages/questionnaire doesn't exist yet — `client` (Wave 1) owns it.
    // scanned: 0 correctly triggers the vacuous-guard rule (spec §14.2)
    // instead of silently reporting green with nothing checked.
    return checkQuestionnaireDeterminism(files);
  },
});
