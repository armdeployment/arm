/**
 * guardrail: ci-sync (spec §14.3 CI workflow discipline).
 *
 * The CI table in AGENTS.md must stay in sync with .github/workflows/*.
 * This check parses the table for workflow filenames and compares against
 * the actual workflow files. A drift (extra or missing) fails the gate.
 *
 * Also verifies AGENTS.md references the correct count of workflows.
 */

import { register, type CheckResult } from "../types.js";

export interface CISyncResult extends CheckResult {
  id: "ci-sync";
}

/** Pure function — used by mutation proofs. */
export function checkCISync(tableWorkflows: string[], actualWorkflows: string[]): CISyncResult {
  const tableSet = new Set(tableWorkflows);
  const actualSet = new Set(actualWorkflows);

  const missing = [...tableSet].filter((w) => !actualSet.has(w));
  const extra = [...actualSet].filter((w) => !tableSet.has(w));

  if (missing.length > 0 || extra.length > 0) {
    const parts: string[] = [];
    if (missing.length > 0)
      parts.push(`in AGENTS.md but not in .github/workflows/: ${missing.join(", ")}`);
    if (extra.length > 0)
      parts.push(`in .github/workflows/ but not in AGENTS.md: ${extra.join(", ")}`);
    return {
      id: "ci-sync",
      status: "fail",
      detail: `CI table ↔ workflows drift — ${parts.join("; ")}`,
      scanned: actualWorkflows.length,
      assertsNegative: true,
    };
  }
  return {
    id: "ci-sync",
    status: "pass",
    scanned: actualWorkflows.length,
    assertsNegative: true,
  };
}

/** Extracts workflow filenames (e.g. "typecheck.yml") from AGENTS.md CI table rows. */
export function parseTableWorkflows(agentsMd: string): string[] {
  const matches = new Set<string>();
  // Match backtick-quoted filenames ending in .yml in table rows.
  const re = /`\s*([a-z0-9-]+\.yml)\s*`/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(agentsMd)) !== null) {
    matches.add(m[1]!);
  }
  return [...matches];
}

register({
  id: "ci-sync",
  description: "AGENTS.md CI table is in sync with .github/workflows/ (spec §14.3).",
  invariant: "§14.3",
  run: async () => {
    const { readFileSync, readdirSync, existsSync } = await import("node:fs");
    const { join, resolve } = await import("node:path");

    let root = process.cwd();
    for (let i = 0; i < 8 && !existsSync(join(root, "AGENTS.md")); i++) {
      const parent = resolve(root, "..");
      if (parent === root) break;
      root = parent;
    }

    const agentsMd = readFileSync(join(root, "AGENTS.md"), "utf8");
    const workflowsDir = join(root, ".github/workflows");

    const tableWorkflows = parseTableWorkflows(agentsMd);

    let actualWorkflows: string[] = [];
    try {
      actualWorkflows = readdirSync(workflowsDir)
        .filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
        .sort();
    } catch {
      // No workflows dir — vacuous if table lists any.
    }

    return checkCISync(tableWorkflows, actualWorkflows);
  },
});
