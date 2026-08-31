/**
 * guardrail: safe-render (spec §14.1, LLM trust boundary).
 *
 * No unescaped rendering of agent/resource/model string fields in the web app.
 * LLM-adjacent strings (agent names, resource refs, model names) could carry
 * XSS payloads if rendered with `dangerouslySetInnerHTML` or similar. This
 * check scans the web app source for unsafe rendering patterns.
 *
 * Forbidden patterns:
 *   - dangerouslySetInnerHTML
 *   - .innerHTML =
 *   - eval(
 *   - document.write(
 *
 * React/Tailwind text content by default is safe (auto-escaped). This guard
 * catches the explicit escape hatches.
 */

import { register, type CheckResult } from "../types.js";

const FORBIDDEN_PATTERNS: { name: string; re: RegExp }[] = [
  { name: "dangerouslySetInnerHTML", re: /dangerouslySetInnerHTML/ },
  { name: "innerHTML assignment", re: /\.innerHTML\s*=/ },
  { name: "eval()", re: /\beval\s*\(/ },
  { name: "document.write()", re: /document\.write\s*\(/ },
];

export interface UnsafeRenderFinding {
  file: string;
  line: number;
  pattern: string;
}

/** Pure function form — used by mutation proofs (§14.2). */
export function checkSafeRender(files: { path: string; content: string }[]): CheckResult {
  const findings: UnsafeRenderFinding[] = [];
  for (const f of files) {
    const lines = f.content.split("\n");
    lines.forEach((line, i) => {
      for (const p of FORBIDDEN_PATTERNS) {
        if (p.re.test(line)) {
          findings.push({ file: f.path, line: i + 1, pattern: p.name });
        }
      }
    });
  }
  if (findings.length > 0) {
    return {
      id: "safe-render",
      status: "fail",
      detail: `unsafe rendering detected: ${findings
        .map((s) => `${s.file}:${s.line} (${s.pattern})`)
        .join(", ")}`,
      scanned: files.length,
      assertsNegative: true,
    };
  }
  return { id: "safe-render", status: "pass", scanned: files.length, assertsNegative: true };
}

register({
  id: "safe-render",
  description:
    "No unescaped rendering of LLM-adjacent strings in the web app (XSS guard, spec §14.1).",
  invariant: "§14.1",
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
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        if (
          entry === "node_modules" ||
          entry === ".git" ||
          entry === "dist" ||
          entry === ".turbo" ||
          entry === ".next"
        )
          continue;
        const p = join(dir, entry);
        const st = statSync(p);
        if (st.isDirectory()) walk(p);
        else if (extname(p) === ".ts" || extname(p) === ".tsx") {
          files.push({ path: p, content: readFileSync(p, "utf8") });
        }
      }
    };
    // ONLY scan the web app source — never the guardrail source (which contains
    // the patterns literally by definition).
    const webRoot = join(root, "apps/control-plane/web/src");
    if (existsSync(webRoot)) {
      walk(webRoot);
    }
    return checkSafeRender(files);
  },
});
