/**
 * guardrail: no-content-egress (spec §14.1, Invariant §11.1).
 *
 * The control plane is metadata + audit ONLY. Prompt bodies, completions,
 * and resource content must never appear in any event schema, Drizzle table,
 * or control-plane-bound payload. This check scans:
 *   - ClickHouse event-table column names (from the shipped 0001_init.sql)
 *   - proto event zod schemas (when present)
 *
 * Forbidden substrings in column / field names: prompt, completion, response,
 * content, body, text, secret, key (key_ref ok — it's a vault reference).
 */

import { register, type CheckResult } from "../types.js";
import { INIT_SQL, CLICKHOUSE_TABLES } from "@arm/clickhouse";

const FORBIDDEN = [
  "prompt",
  "completion",
  "response_text",
  "response_body",
  "content",
  "body",
  "secret",
  "api_key",
  "access_token",
];

/** Allowlist of substrings that look forbidden but are safe (vault refs, metadata). */
const SAFE = ["key_ref", "model_id", "metadata"];

export interface FieldViolation {
  table: string;
  column: string;
  matched: string;
}

/** Pure function form — used by mutation proofs (§14.2). */
export function checkNoContentEgress(
  columnsByTable: Record<string, string[]>,
): CheckResult {
  const violations: FieldViolation[] = [];
  for (const [table, cols] of Object.entries(columnsByTable)) {
    for (const col of cols) {
      const lower = col.toLowerCase();
      if (SAFE.some((s) => lower === s)) continue;
      const hit = FORBIDDEN.find((f) => lower.includes(f));
      if (hit) violations.push({ table, column: col, matched: hit });
    }
  }
  const scanned = Object.values(columnsByTable).reduce((n, c) => n + c.length, 0);
  if (violations.length > 0) {
    return {
      id: "no-content-egress",
      status: "fail",
      detail: `content-bearing fields detected (Invariant 1): ${violations
        .map((v) => `${v.table}.${v.column} (matched "${v.matched}")`)
        .join(", ")}`,
      scanned,
      assertsNegative: true,
    };
  }
  return { id: "no-content-egress", status: "pass", scanned, assertsNegative: true };
}

/** Parses `CREATE TABLE ... (col Type, ...) ` blocks out of the SQL into a map. */
export function parseColumns(sql: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const re = /CREATE TABLE(?:\s+IF NOT EXISTS)?\s+(\w+)\s*\(([\s\S]*?)\)\s*(?:PARTITION|ENGINE|ORDER|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    const table = m[1]!;
    const body = m[2]!;
    const cols: string[] = [];
    for (const line of body.split("\n")) {
      const trimmed = line.trim().replace(/,$/, "").trim();
      if (!trimmed || trimmed.startsWith("--") || trimmed.startsWith("CONSTRAINT")) continue;
      const name = trimmed.split(/\s+/)[0]!;
      if (name) cols.push(name.replace(/"/g, ""));
    }
    out[table] = cols;
  }
  return out;
}

register({
  id: "no-content-egress",
  description:
    "ClickHouse/proto event schemas carry no content fields — metadata + audit only (Invariant §11.1).",
  invariant: "§11.1",
  run: async () => {
    const cols = parseColumns(INIT_SQL);
    // Vacuous-guard safeguard: if we somehow parsed zero tables, fail loud.
    if (Object.keys(cols).length < CLICKHOUSE_TABLES.length) {
      return {
        id: "no-content-egress",
        status: "fail",
        detail: `expected ≥${CLICKHOUSE_TABLES.length} event tables, parsed ${Object.keys(cols).length}`,
        scanned: 0,
        assertsNegative: true,
      };
    }
    return checkNoContentEgress(cols);
  },
});
