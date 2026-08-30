/**
 * Work-folder scan (installation wizard step 3,
 * docs/solutions/2026-08-25-gtm-market-tiers-and-wizard-plan.md).
 *
 * Metadata-only, local-only, opt-in: reads file EXTENSIONS from a directory
 * tree — never file names, never file contents. Maps the resulting
 * extension histogram to structured tags via a static lookup table. No LLM,
 * no network call, nothing here ever needs to leave this machine (this
 * touches spec §13 Open Item 4 — "scope of 'files' resource... only
 * classification tag crossover applies" — this scan only ever reads
 * extensions, and only the derived `tags` are meant to be transmitted
 * anywhere, never `extensionCounts` or any path).
 */

import { readdir } from "node:fs/promises";
import { extname, join } from "node:path";

export interface FolderScanOptions {
  /** Directory recursion limit — bounds cost on a deep tree. Default 4. */
  maxDepth?: number;
  /** Stop scanning once this many files have been seen. Default 5000. */
  maxFiles?: number;
}

export interface FolderScanResult {
  filesScanned: number;
  /** Extension (lowercase, with leading dot) → count. Local-only detail —
   *  callers should transmit `tags` below, not this. */
  extensionCounts: Record<string, number>;
  /** Structured signal tags, threshold-filtered so a single stray file
   *  doesn't skew a recommendation. Safe to transmit — no paths, no names. */
  tags: string[];
}

/** Extension → tag. Extend this table, not the scan logic, to cover more
 *  file types — keeps the scan itself dumb and auditable. */
const EXTENSION_TAGS: Record<string, string> = {
  ".sldprt": "cad_heavy",
  ".sldasm": "cad_heavy",
  ".step": "cad_heavy",
  ".stp": "cad_heavy",
  ".catpart": "cad_heavy",
  ".catproduct": "cad_heavy",
  ".prt": "cad_heavy",
  ".asm": "cad_heavy",
  ".ipt": "cad_heavy",
  ".iam": "cad_heavy",
  ".dwg": "cad_heavy",
  ".dxf": "cad_heavy",
  ".xlsx": "spreadsheet_heavy",
  ".xls": "spreadsheet_heavy",
  ".csv": "spreadsheet_heavy",
  ".pptx": "presentation_heavy",
  ".ppt": "presentation_heavy",
  ".docx": "document_heavy",
  ".doc": "document_heavy",
  ".pdf": "document_heavy",
  ".py": "code_heavy",
  ".ts": "code_heavy",
  ".tsx": "code_heavy",
  ".js": "code_heavy",
  ".java": "code_heavy",
  ".cpp": "code_heavy",
  ".c": "code_heavy",
  ".cs": "code_heavy",
  ".go": "code_heavy",
  ".rs": "code_heavy",
  ".m": "simulation_heavy",
  ".mdl": "simulation_heavy",
  ".slx": "simulation_heavy",
  ".gcode": "cam_heavy",
  ".nc": "cam_heavy",
};

/** Threshold below which a tag is dropped — one stray file shouldn't count. */
const TAG_THRESHOLD = 3;

/** Directories never descended into — noise, not signal, and often huge. */
const IGNORED_DIR_NAMES = new Set(["node_modules", "dist", "build", "__pycache__", ".cache", ".venv"]);

export async function scanWorkFolder(
  rootPath: string,
  options: FolderScanOptions = {},
): Promise<FolderScanResult> {
  const maxDepth = options.maxDepth ?? 4;
  const maxFiles = options.maxFiles ?? 5000;
  const extensionCounts: Record<string, number> = {};
  let filesScanned = 0;

  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > maxDepth || filesScanned >= maxFiles) return;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return; // unreadable (permissions, race, symlink loop) — skip, never throw
    }
    for (const entry of entries) {
      if (filesScanned >= maxFiles) return;
      if (entry.isDirectory()) {
        if (entry.name.startsWith(".") || IGNORED_DIR_NAMES.has(entry.name)) continue;
        await walk(join(dir, entry.name), depth + 1);
      } else if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase();
        if (ext) {
          extensionCounts[ext] = (extensionCounts[ext] ?? 0) + 1;
        }
        filesScanned += 1;
      }
    }
  }

  await walk(rootPath, 0);

  const tagCounts = new Map<string, number>();
  for (const [ext, count] of Object.entries(extensionCounts)) {
    const tag = EXTENSION_TAGS[ext];
    if (tag === undefined) continue;
    tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + count);
  }
  const tags = [...tagCounts.entries()]
    .filter(([, count]) => count >= TAG_THRESHOLD)
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag);

  return { filesScanned, extensionCounts, tags };
}
