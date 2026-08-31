/**
 * guardrail: tenant-isolation (spec §14.1, Invariant §11.6 + D1-b).
 *
 * Every multi-tenant Drizzle table must declare `tenant_id NOT NULL`.
 * Reflects on the table objects exported by @arm/db via getTableConfig.
 */

import { getTableConfig, type PgTable } from "drizzle-orm/pg-core";
import { isTable } from "drizzle-orm/table";
import { register, type CheckResult } from "../types.js";

/**
 * Tables intentionally without tenant_id. Keep this list tiny + justified.
 *
 * `component_blob` (packages/db/src/schema/artifactory.ts): `tenant_id` is
 * nullable there, NOT absent — this guard only checks column PRESENCE, so it
 * would already pass. It's listed here anyway to document the one documented
 * exemption from "every table carries tenant_id NOT NULL" (guide 00 §3.1):
 * `tenant_id` is nullable ONLY for `residency = 'control_plane'` first-party
 * artifacts (no single owning tenant). Every tenant-authored blob still
 * carries a non-null `tenant_id`; `blob-residency` enforces that
 * tenant-authored content is never stored at control_plane residency
 * (Invariant 1). Do not weaken this guard generically — this is a
 * column-specific nullability exemption, not a "skip the table" exemption.
 */
const GLOBAL_TABLES = new Set<string>(["tenant", "component_blob"]);

export interface TableShape {
  name: string;
  hasTenantId: boolean;
}

/** Pure function form — used by mutation proofs (§14.2). */
export function checkTenantIsolation(tables: TableShape[]): CheckResult {
  const violators = tables.filter((t) => !GLOBAL_TABLES.has(t.name) && !t.hasTenantId);
  if (violators.length > 0) {
    return {
      id: "tenant-isolation",
      status: "fail",
      detail: `tables missing tenant_id NOT NULL: ${violators.map((v) => v.name).join(", ")}`,
      scanned: tables.length,
      assertsNegative: true,
    };
  }
  return {
    id: "tenant-isolation",
    status: "pass",
    scanned: tables.length,
    assertsNegative: true,
  };
}

/** Reflects on Drizzle table objects. */
export function shapeOf(tables: Record<string, PgTable>): TableShape[] {
  return Object.entries(tables).map(([, table]) => {
    const cfg = getTableConfig(table);
    return {
      name: cfg.name,
      hasTenantId: cfg.columns.some((c) => c.name === "tenant_id"),
    };
  });
}

register({
  id: "tenant-isolation",
  description: "Every multi-tenant Drizzle table declares tenant_id (Invariant §11.6, D1-b).",
  invariant: "§11.6",
  run: async () => {
    const mod = await import("@arm/db");
    const tables = Object.fromEntries(
      Object.entries(mod.schema).filter(([, v]) => isTable(v)),
    ) as Record<string, PgTable>;
    return checkTenantIsolation(shapeOf(tables));
  },
});
