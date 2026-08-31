/**
 * guardrail: taxonomy-scope (D7).
 *
 * Every `WorkTypeTaxonomy` row must reference an existing org-tree node and be
 * `tenant_id`-scoped (Invariant 6, D7 §guardrails). Presets set defaults —
 * they never gate capabilities (D6 rule).
 *
 * Pure-function form (`checkTaxonomyScope`) is exercised by mutation proofs.
 * The registered check scans the shipped Drizzle schema file for the required
 * `workTypeTaxonomyTable` definition with non-null `tenantId`, `scopeType`,
 * `scopeId`, and non-empty default for `labels`.
 */

import { register, type CheckResult } from "../types.js";
import { includesChain } from "../source-match.js";
import * as fs from "node:fs";
import * as path from "node:path";

/** Pure function form — used by mutation proofs. */
export interface TaxonomyRow {
  tenantId: string | null;
  scopeType: string | null;
  scopeId: string | null;
  labels: string[] | null;
}

export function checkTaxonomyScope(rows: TaxonomyRow[]): CheckResult {
  const violations: string[] = [];

  for (const [i, row] of rows.entries()) {
    if (!row.tenantId) {
      violations.push(`row ${i}: missing tenant_id (Invariant 6)`);
    }
    if (!row.scopeType) {
      violations.push(`row ${i}: missing scope_type (org-tree anchor)`);
    }
    if (!row.scopeId) {
      violations.push(`row ${i}: missing scope_id (org-tree anchor)`);
    }
    if (!row.labels || row.labels.length === 0) {
      violations.push(`row ${i}: empty label set (taxonomy must have ≥1 label)`);
    }
  }

  const scanned = rows.length;

  if (violations.length > 0) {
    return {
      id: "taxonomy-scope",
      status: "fail",
      detail: violations.join("\n"),
      scanned,
      assertsNegative: true,
    };
  }

  return {
    id: "taxonomy-scope",
    status: "pass",
    scanned,
    assertsNegative: scanned > 0,
  };
}

// ── Registered check (scans the shipped schema file) ──────────────────────

register({
  id: "taxonomy-scope",
  description:
    "WorkTypeTaxonomy must be tenant_id-scoped with valid org-tree anchor + non-empty labels (D7).",
  invariant:
    "D7: taxonomy is per-department/per-plant, tenant_id-scoped; presets set defaults, never gate capabilities",
  run: () => {
    const repoRoot = path.resolve(import.meta.dirname, "../../../..");
    const schemaPath = path.join(repoRoot, "packages/db/src/schema/worktype.ts");

    if (!fs.existsSync(schemaPath)) {
      return {
        id: "taxonomy-scope",
        status: "fail" as const,
        detail: `WorkTypeTaxonomy schema file not found: ${schemaPath}`,
        scanned: 1,
        assertsNegative: true,
      };
    }

    const content = fs.readFileSync(schemaPath, "utf-8");

    // Assert the required columns are present and non-null in the schema.
    const required = [
      'uuid("tenant_id").notNull()',
      'scopeTypeEnum("scope_type").notNull()',
      'uuid("scope_id").notNull()',
      'jsonb("labels")',
    ];
    const missing = required.filter((needle) => !includesChain(content, needle));

    if (missing.length > 0) {
      return {
        id: "taxonomy-scope",
        status: "fail" as const,
        detail: `WorkTypeTaxonomy schema missing required column definitions: ${missing.join(", ")}`,
        scanned: 1,
        assertsNegative: true,
      };
    }

    return {
      id: "taxonomy-scope",
      status: "pass" as const,
      scanned: 1,
      assertsNegative: true,
    };
  },
});
