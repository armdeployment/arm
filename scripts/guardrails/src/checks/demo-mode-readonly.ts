/**
 * guardrail: demo-mode-readonly (D10, guide 04's ARM_DEMO mechanism).
 *
 * Polices: every `packages/trpc/src/*.ts` router file that defines at least
 * one `.mutation(...)` procedure must also import and use `isDemoMode` from
 * `./demo-mode.js` — the structural guard (packages/trpc/src/demo-mode.ts)
 * that snapshots every registered store before a mutation resolver runs and
 * restores it after, when ARM_DEMO=1. A router that defines a mutation
 * without wiring the guard is the one way the "guaranteed read-only" demo
 * promise (apps/public/src/content/demo.ts's hero copy) can silently stop
 * being true — this check exists so that failure is loud, not silent.
 *
 * This is a heuristic (import + usage substring match, not a full call-graph
 * proof that the guard actually wraps every mutation's execution) — false
 * positives are cheap here; false negatives are not (same tradeoff
 * questionnaire-determinism's BANNED_CALLS scan makes). The real end-to-end
 * proof that the guard actually reverts a mutation lives in
 * packages/trpc/test/demo-mode.test.ts, which exercises the real appRouter.
 */

import { register, type CheckResult } from "../types.js";

export interface DemoModeViolation {
  file: string;
  issue: string;
}

const DEMO_GUARD_IMPORT_RE = /from\s+["']\.\/demo-mode\.js["']/;

/** Pure function form — used by mutation proofs. */
export function checkDemoModeReadonly(files: { path: string; content: string }[]): CheckResult {
  const violations: DemoModeViolation[] = [];
  for (const f of files) {
    if (!f.content.includes(".mutation(")) continue; // no mutations, nothing to guard
    const importsGuard = DEMO_GUARD_IMPORT_RE.test(f.content) && f.content.includes("isDemoMode");
    if (!importsGuard) {
      violations.push({
        file: f.path,
        issue:
          "defines a .mutation(...) procedure but never imports/uses isDemoMode from ./demo-mode.js — " +
          "ARM_DEMO's guaranteed-read-only promise would not cover this router",
      });
    }
  }
  if (violations.length > 0) {
    return {
      id: "demo-mode-readonly",
      status: "fail",
      detail: violations.map((v) => `${v.file}: ${v.issue}`).join("; "),
      scanned: files.length,
      assertsNegative: true,
    };
  }
  return {
    id: "demo-mode-readonly",
    status: "pass",
    scanned: files.length,
    assertsNegative: true,
  };
}

register({
  id: "demo-mode-readonly",
  description:
    "Every packages/trpc/src router file defining a mutation also wires the ARM_DEMO guaranteed-read-only guard (isDemoMode from ./demo-mode.js).",
  invariant: "D10: guide 04's ARM_DEMO mechanism — a public demo deployment never persists a visitor's write",
  run: async () => {
    const { readdirSync, readFileSync, statSync, existsSync } = await import("node:fs");
    const { join, extname, resolve } = await import("node:path");

    let root = process.cwd();
    for (let i = 0; i < 8 && !existsSync(join(root, "pnpm-workspace.yaml")); i++) {
      const parent = resolve(root, "..");
      if (parent === root) break;
      root = parent;
    }

    const dir = join(root, "packages/trpc/src");
    const files: { path: string; content: string }[] = [];
    if (existsSync(dir)) {
      for (const entry of readdirSync(dir)) {
        const p = join(dir, entry);
        if (statSync(p).isDirectory()) continue;
        if (extname(p) !== ".ts" || entry === "demo-mode.ts") continue;
        files.push({ path: `packages/trpc/src/${entry}`, content: readFileSync(p, "utf8") });
      }
    }
    return checkDemoModeReadonly(files);
  },
});
