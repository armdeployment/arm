/**
 * guardrail: boundaries (spec §14.1, AGENTS.md dependency direction).
 *
 * Enforces the workspace DAG:
 *   proto → config → {db, clickhouse, policy, billing, auth} → trpc → apps/*
 *
 * Plus the data-plane trust boundary (AGENTS.md):
 *   data-plane apps import proto/config ONLY — never control-plane-only packages
 *   (db, trpc, policy, auth, billing).
 *
 * Scans static `import ... from "@arm/..."` statements in source files.
 */

import { register, type CheckResult } from "../types.js";

/** Layer rank: a package may only import packages at a STRICTLY LOWER rank. */
const LAYER: Record<string, number> = {
  proto: 0,
  profiles: 0,
  classifier: 1, // depends on proto only (leaf, beside config)
  config: 1,
  db: 2,
  clickhouse: 2,
  policy: 2,
  billing: 2,
  auth: 2,
  trpc: 3,
};

/** Packages forbidden to data-plane apps regardless of layer (AGENTS.md trust boundary). */
const CONTROL_PLANE_ONLY = new Set(["db", "trpc", "policy", "auth", "billing"]);

export interface BoundaryViolation {
  from: string;
  to: string;
  reason: "back-edge" | "data-plane-imports-control";
}

const IMPORT_RE = /(?:import|export)[\s\S]*?from\s+["'](@arm\/[a-z-]+)["']/g;

function pkgDir(path: string): { area: string; pkg: string } | null {
  // packages/db/...        -> area=packages, pkg=db
  // apps/control-plane/api -> area=apps, pkg=control-plane/api
  const m = path.match(/^(?:\.\.\/|\.\/|packages\/|apps\/)([^/]+(?:\/[^/]+)?)/);
  if (!m) return null;
  if (path.includes("packages/")) return { area: "packages", pkg: m[1]!.split("/")[0]! };
  if (path.includes("apps/")) {
    const parts = m[1]!.split("/");
    return { area: "apps", pkg: parts.slice(0, 2).join("/") };
  }
  return null;
}

function importedPkg(spec: string): string {
  // "@arm/db" -> "db"; "@arm-app/cli" ignored (app cross-imports not via @arm)
  return spec.replace(/^@arm\//, "");
}

/** Pure function form — used by mutation proofs. */
export function checkBoundaries(files: { path: string; content: string }[]): CheckResult {
  const violations: BoundaryViolation[] = [];
  for (const f of files) {
    const loc = pkgDir(f.path);
    if (!loc) continue;
    const isDataPlane = loc.area === "apps" && loc.pkg.startsWith("data-plane/");
    for (const m of f.content.matchAll(IMPORT_RE)) {
      const to = importedPkg(m[1]!);
      if (!LAYER.hasOwnProperty(to)) continue; // not a workspace layer package
      if (loc.area === "packages") {
        const fromPkg = loc.pkg;
        if (fromPkg === to) continue; // self (shouldn't happen via @arm)
        if ((LAYER[to] ?? 99) >= (LAYER[fromPkg] ?? 99)) {
          violations.push({ from: `packages/${fromPkg}`, to, reason: "back-edge" });
        }
      } else if (isDataPlane && CONTROL_PLANE_ONLY.has(to)) {
        violations.push({ from: loc.pkg, to, reason: "data-plane-imports-control" });
      }
    }
  }
  if (violations.length > 0) {
    return {
      id: "boundaries",
      status: "fail",
      detail: violations
        .map((v) => `${v.from} -> @arm/${v.to} (${v.reason})`)
        .join(", "),
      scanned: files.length,
      assertsNegative: true,
    };
  }
  return { id: "boundaries", status: "pass", scanned: files.length, assertsNegative: true };
}

register({
  id: "boundaries",
  description: "Workspace dependency direction + data-plane trust boundary (AGENTS.md).",
  invariant: "§14.3",
  run: async () => {
    const { readdirSync, readFileSync, statSync, existsSync } = await import("node:fs");
    const { join, extname, resolve } = await import("node:path");

    // Resolve repo root (cwd may be a package dir under turbo/pnpm).
    let root = process.cwd();
    for (let i = 0; i < 8 && !existsSync(join(root, "pnpm-workspace.yaml")); i++) {
      const parent = resolve(root, "..");
      if (parent === root) break;
      root = parent;
    }

    const files: { path: string; content: string }[] = [];
    const walk = (dir: string, rel: string): void => {
      for (const entry of readdirSync(dir)) {
        if (entry === "node_modules" || entry === ".git" || entry === "dist" || entry === ".turbo") continue;
        const p = join(dir, entry);
        const st = statSync(p);
        if (st.isDirectory()) walk(p, `${rel}${entry}/`);
        else if (extname(p) === ".ts" || extname(p) === ".tsx") {
          files.push({ path: rel + entry, content: readFileSync(p, "utf8") });
        }
      }
    };
    for (const area of ["packages", "apps"]) {
      const areaRoot = join(root, area);
      try {
        walk(areaRoot, `${area}/`);
      } catch {
        // area may not exist yet in a partial checkout — not a failure of this guard
      }
    }
    return checkBoundaries(files);
  },
});
