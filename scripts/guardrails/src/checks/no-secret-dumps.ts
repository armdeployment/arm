/**
 * guardrail: no-secret-dumps (spec §14.1, §12 master-key custody).
 *
 * Scans tracked source for hardcoded provider-key patterns and committed .env
 * dumps. Operates on a provided file list (so mutation proofs can inject a
 * fixture); the registered run walks the repo tree.
 */

import { register, type CheckResult } from "../types.js";

const PATTERNS: { name: string; re: RegExp }[] = [
  { name: "sk-ant (Anthropic)", re: /sk-ant-[A-Za-z0-9_-]{20,}/ },
  { name: "sk- (OpenAI)", re: /sk-[A-Za-z0-9]{40,}/ },
  { name: "AKIA (AWS key id)", re: /AKIA[0-9A-Z]{16}/ },
  { name: "xoxb (Slack)", re: /xoxb-[0-9A-Za-z-]{20,}/ },
  { name: "Bearer token literal", re: /Bearer\s+[A-Za-z0-9._-]{40,}/ },
];

export interface SecretFinding {
  file: string;
  line: number;
  pattern: string;
}

/** Pure function form — used by mutation proofs (§14.2). */
export function checkNoSecretDumps(files: { path: string; content: string }[]): CheckResult {
  const findings: SecretFinding[] = [];
  for (const f of files) {
    const lines = f.content.split("\n");
    lines.forEach((line, i) => {
      for (const p of PATTERNS) {
        if (p.re.test(line)) {
          findings.push({ file: f.path, line: i + 1, pattern: p.name });
        }
      }
    });
  }
  if (findings.length > 0) {
    return {
      id: "no-secret-dumps",
      status: "fail",
      detail: `hardcoded secrets detected: ${findings
        .map((s) => `${s.file}:${s.line} (${s.pattern})`)
        .join(", ")}`,
      scanned: files.length,
      assertsNegative: true,
    };
  }
  return { id: "no-secret-dumps", status: "pass", scanned: files.length, assertsNegative: true };
}

// Dynamic import of node:fs only in the registered run (keeps the pure fn testable).
register({
  id: "no-secret-dumps",
  description: "No hardcoded provider keys or .env dumps in tracked source (spec §12).",
  invariant: "§12",
  run: async () => {
    const { readdirSync, readFileSync, statSync } = await import("node:fs");
    const { join, extname } = await import("node:path");
    const SCAN_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".json", ".env", ".sh", ".yml", ".yaml"]);
    const SKIP = new Set(["node_modules", ".git", "dist", ".turbo", ".next", "coverage"]);
    const files: { path: string; content: string }[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        if (SKIP.has(entry)) continue;
        const p = join(dir, entry);
        const st = statSync(p);
        if (st.isDirectory()) walk(p);
        else if (SCAN_EXT.has(extname(p)) || entry.startsWith(".env")) {
          files.push({ path: p, content: readFileSync(p, "utf8") });
        }
      }
    };
    walk(process.cwd());
    return checkNoSecretDumps(files);
  },
});
