/**
 * Shared filesystem/text scan helpers for the D9 guardrails (package-integrity,
 * package-least-privilege, tool-endpoint-scope, package-drift).
 *
 * No check logic lives here — only the repo-scan plumbing. The D9 registered
 * checks scan the shipped profile presets (packages/profiles/src/*.profile.ts)
 * for `workPackages: WorkPackageSeed[]` blocks. Those blocks are seeded by
 * parallel work; until they land, the registered checks FAIL LOUDLY
 * (spec §14.2: a negative asserted over an empty input set is red, not green).
 */

import * as fs from "node:fs";
import * as path from "node:path";

/** Semver-ish version gate: `\d+.\d+.\d+` with optional pre-release/build suffix. */
export const SEMVER_ISH = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

export interface ProfileScan {
  /** Path relative to repo root, e.g. "packages/profiles/src/tech.profile.ts". */
  file: string;
  content: string;
  /** True if the file mentions a `workPackages:` key. */
  hasWorkPackages: boolean;
  /** Text of the inline `workPackages: [...]` array, or null if it is not an inline array. */
  block: string | null;
}

/** Read every `packages/profiles/src/*.profile.ts` file. */
export function profileScans(repoRoot: string): ProfileScan[] {
  const dir = path.join(repoRoot, "packages/profiles/src");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".profile.ts"))
    .map((f) => {
      const file = `packages/profiles/src/${f}`;
      const content = fs.readFileSync(path.join(repoRoot, file), "utf-8");
      return {
        file,
        content,
        hasWorkPackages: /\bworkPackages\s*:/.test(content),
        block: extractBlock(content, "workPackages"),
      };
    });
}

/**
 * Extract the inline array literal following `key:` (bracket-balanced).
 * Returns null when the key is absent or not followed by an inline array.
 */
export function extractBlock(content: string, key: string): string | null {
  const idx = content.search(new RegExp(`\\b${key}\\s*:`));
  if (idx === -1) return null;
  const open = content.indexOf("[", idx);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < content.length; i++) {
    const c = content[i]!;
    if (c === "[") depth++;
    else if (c === "]") {
      depth--;
      if (depth === 0) return content.slice(open, i + 1);
    }
  }
  return null; // unbalanced — treat as not an inline array
}

/** All string-literal values assigned to `key: "value"` in `text`. */
export function valuesForKey(text: string, key: string): string[] {
  const re = new RegExp(`\\b${key}\\s*:\\s*["']([^"']+)["']`, "g");
  return Array.from(text.matchAll(re), (m) => m[1] ?? "");
}

/** Per-occurrence entries of every `key: [...]` array in `text` (one array per element). */
export function arraysForKey(text: string, key: string): string[][] {
  const re = new RegExp(`\\b${key}\\s*:\\s*\\[([^\\]]*)\\]`, "g");
  const out: string[][] = [];
  for (const m of text.matchAll(re)) {
    const body = m[1] ?? "";
    out.push(Array.from(body.matchAll(/["']([^"']+)["']/g), (q) => q[1] ?? ""));
  }
  return out;
}
