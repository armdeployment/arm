/**
 * Guide 04 §7: "A content honesty test — grep the content modules for a
 * committed list of banned patterns ... and fail if one appears."
 *
 * This reads every .ts file under src/content (source text, not rendered
 * output) and scans it against src/content/banned-patterns.ts. It also
 * fails loudly if the content directory is empty or the pattern list is
 * empty, per the "vacuous guard" rule (AGENTS.md, docs/arm-spec.md §14.2) —
 * a check that can't fail supplies false confidence.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { bannedPatterns } from "../src/content/banned-patterns";
import { simulationRunStats, fixtureDashboardStats } from "../src/content/simulation-data";

const CONTENT_DIR = join(__dirname, "..", "src", "content");

// banned-patterns.ts itself necessarily contains every banned string (it's
// the pattern list) and types.ts/link-allowlist.ts carry no marketing copy —
// exclude them so the scan checks actual page copy, not its own guardrail.
const EXCLUDED = new Set(["banned-patterns.ts", "types.ts", "link-allowlist.ts"]);

function contentFiles(): string[] {
  return readdirSync(CONTENT_DIR)
    .filter((f) => f.endsWith(".ts") && !EXCLUDED.has(f))
    .map((f) => join(CONTENT_DIR, f));
}

describe("content honesty — no fabricated customers, testimonials, or logos", () => {
  it("has a non-empty banned-pattern list (a vacuous guard is not a guard)", () => {
    expect(bannedPatterns.length).toBeGreaterThan(0);
  });

  it("scans a non-empty set of content files (fails loudly if src/content is empty)", () => {
    const files = contentFiles();
    expect(files.length).toBeGreaterThan(0);
  });

  it("contains none of the banned patterns", () => {
    const files = contentFiles();
    const hits: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8").toLowerCase();
      for (const pattern of bannedPatterns) {
        if (text.includes(pattern.toLowerCase())) {
          hits.push(`${file}: "${pattern}"`);
        }
      }
    }
    expect(hits, `Banned pattern(s) found:\n${hits.join("\n")}`).toEqual([]);
  });

  it("every Stat carries a source (rule 7: no unlabeled numbers)", () => {
    // Statically verified by the Stat type (source: string is required),
    // plus a runtime check on the stat arrays that exist today.
    for (const stat of [...simulationRunStats, ...fixtureDashboardStats]) {
      expect(stat.source, `Stat "${stat.label}" has no source`).toBeTruthy();
      expect(stat.source.length).toBeGreaterThan(5);
    }
  });
});
