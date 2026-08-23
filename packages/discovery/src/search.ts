/**
 * Internal discovery search — Postgres FTS + pg_trgm (guide 01 §6.1).
 *
 * `buildComponentSearchSql`/`buildWorkPackageSearchSql` are pure functions
 * that produce the parameterized SQL text for a real Postgres connection —
 * "Search infra: Postgres only... do not add a search service." They assume
 * a generated `tsvector` column (`search_vector`) + GIN index on
 * `component(name, slug, description)` / `work_package(name, description)`,
 * plus a `pg_trgm` index on `slug` for fuzzy matching.
 *
 * ⚠ KNOWN GAP (reported, not silently worked around): that DDL — the
 * generated column + GIN/pg_trgm indexes — belongs in
 * `packages/db/src/schema/artifactory.ts` and `catalog.ts`, both FROZEN
 * (Wave 0 `contracts` ownership; guide 01 §6.1 conflicts with the file-
 * ownership table here). This package cannot add it. The SQL text below is
 * written against the column name `search_vector` the DDL would create; a
 * follow-up PR from the `contracts` owner needs to land the migration
 * before this query runs against a real database. See the D12 solution
 * record for the flagged blocker.
 *
 * `searchInMemory` is the pure, fully unit-testable REFERENCE
 * implementation used by tests and by `library-router.ts` today — the same
 * "no live DB, fixture-driven" pattern every other router/package in this
 * repo already follows (`packages/trpc/src/index.ts`'s own header: "FIXTURE
 * DATA... TODO(1.1): replace with real Postgres/ClickHouse queries"). Its
 * ranking/filtering semantics mirror the SQL: substring/trigram-ish match on
 * name/slug/description, filtered by kind/jobFunction/classification/mode.
 */

import type {
  ComponentKind,
  ComponentReviewStatus,
  ComponentSourceKind,
  WorkPackageMode,
} from "@arm/proto";

/**
 * Every field is `| undefined` in addition to optional — zod's `.optional()`
 * infers exactly this shape (`prop?: T | undefined`), and callers like
 * `library-router.ts` pass a zod-parsed input straight through, so this
 * type needs to accept that under `exactOptionalPropertyTypes: true`.
 */
export interface SearchInput {
  q?: string | undefined;
  kinds?: ComponentKind[] | undefined;
  jobFunction?: string | undefined;
  classification?: "public" | "internal" | "confidential" | "restricted" | undefined;
  mode?: WorkPackageMode | undefined;
  cursor?: string | undefined;
  limit?: number | undefined;
}

export const DEFAULT_SEARCH_LIMIT = 20;

// ── SQL query builder (real Postgres, guide 01 §6.1) ────────────────────────

export interface BuiltQuery {
  sql: string;
  params: unknown[];
}

/** Builds the parameterized `component` search query. */
export function buildComponentSearchSql(tenantId: string, input: SearchInput): BuiltQuery {
  const params: unknown[] = [tenantId];
  const where: string[] = ["tenant_id = $1", "review_status = 'approved'"];

  if (input.q) {
    params.push(input.q);
    const qIdx = params.length;
    where.push(`(search_vector @@ plainto_tsquery('english', $${qIdx}) OR slug % $${qIdx})`);
  }
  if (input.kinds && input.kinds.length > 0) {
    params.push(input.kinds);
    where.push(`kind = ANY($${params.length})`);
  }
  if (input.classification) {
    params.push(input.classification);
    where.push(`data_classification = $${params.length}`);
  }
  if (input.jobFunction) {
    params.push(input.jobFunction);
    where.push(
      `EXISTS (SELECT 1 FROM component_job_function cjf JOIN job_function jf ON jf.id = cjf.job_function_id ` +
        `WHERE cjf.component_id = component.id AND jf.key = $${params.length})`,
    );
  }

  const limit = input.limit ?? DEFAULT_SEARCH_LIMIT;
  params.push(limit);
  const rankExpr = input.q
    ? `ts_rank(search_vector, plainto_tsquery('english', $2))`
    : `0`;
  const sql =
    `SELECT id, slug, name, description, kind, data_classification, source_kind, ${rankExpr} AS rank ` +
    `FROM component WHERE ${where.join(" AND ")} ORDER BY rank DESC, slug ASC LIMIT $${params.length}`;
  return { sql, params };
}

/** Builds the parameterized `work_package` search query. */
export function buildWorkPackageSearchSql(tenantId: string, input: SearchInput): BuiltQuery {
  const params: unknown[] = [tenantId];
  const where: string[] = ["tenant_id = $1"];

  if (input.q) {
    params.push(input.q);
    where.push(`(search_vector @@ plainto_tsquery('english', $${params.length}) OR role_key % $${params.length})`);
  }
  if (input.mode) {
    params.push(input.mode);
    where.push(`mode = $${params.length}`);
  }
  if (input.jobFunction) {
    params.push(input.jobFunction);
    where.push(
      `EXISTS (SELECT 1 FROM work_package_job_function wpjf JOIN job_function jf ON jf.id = wpjf.job_function_id ` +
        `WHERE wpjf.package_id = work_package.id AND jf.key = $${params.length})`,
    );
  }

  const limit = input.limit ?? DEFAULT_SEARCH_LIMIT;
  params.push(limit);
  const rankExpr = input.q ? `ts_rank(search_vector, plainto_tsquery('english', $2))` : `0`;
  const sql =
    `SELECT id, role_key, name, description, mode, ${rankExpr} AS rank ` +
    `FROM work_package WHERE ${where.join(" AND ")} ORDER BY rank DESC, role_key ASC LIMIT $${params.length}`;
  return { sql, params };
}

// ── Pure in-memory reference implementation (tests + router) ───────────────

export interface SearchableComponentRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  kind: ComponentKind;
  jobFunctions: string[];
  dataClassification: "public" | "internal" | "confidential" | "restricted";
  sourceKind: ComponentSourceKind;
  reviewStatus: ComponentReviewStatus;
  installCount: number;
}

export interface SearchableWorkPackageRow {
  id: string;
  roleKey: string;
  name: string;
  description: string;
  mode: WorkPackageMode;
  jobFunctions: string[];
  installCount: number;
}

export interface SearchResultItem {
  type: "component" | "work_package";
  id: string;
  slug: string;
  name: string;
  description: string;
}

export interface SearchResult {
  items: SearchResultItem[];
  nextCursor: string | null;
}

function matchesQuery(q: string | undefined, haystacks: string[]): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return haystacks.some((h) => h.toLowerCase().includes(needle));
}

/** Pure, deterministic in-memory search over supplied rows — the reference
 *  implementation the SQL above is written to match. Approved components
 *  only (mirrors `WHERE review_status = 'approved'`); work packages have no
 *  review gate of their own. Deterministic ordering: name match first, then
 *  slug ascending. */
export function searchInMemory(
  components: readonly SearchableComponentRow[],
  workPackages: readonly SearchableWorkPackageRow[],
  input: SearchInput,
): SearchResult {
  const limit = input.limit ?? DEFAULT_SEARCH_LIMIT;

  let compResults = components.filter((c) => c.reviewStatus === "approved");
  if (input.kinds && input.kinds.length > 0) compResults = compResults.filter((c) => input.kinds!.includes(c.kind));
  if (input.classification) compResults = compResults.filter((c) => c.dataClassification === input.classification);
  if (input.jobFunction) compResults = compResults.filter((c) => c.jobFunctions.includes(input.jobFunction!));
  compResults = compResults.filter((c) => matchesQuery(input.q, [c.name, c.slug, c.description]));

  let wpResults = workPackages.slice();
  if (input.mode) wpResults = wpResults.filter((w) => w.mode === input.mode);
  if (input.jobFunction) wpResults = wpResults.filter((w) => w.jobFunctions.includes(input.jobFunction!));
  wpResults = wpResults.filter((w) => matchesQuery(input.q, [w.name, w.roleKey, w.description]));

  const items: SearchResultItem[] = [
    ...compResults.map((c): SearchResultItem => ({ type: "component", id: c.id, slug: c.slug, name: c.name, description: c.description })),
    ...wpResults.map((w): SearchResultItem => ({ type: "work_package", id: w.id, slug: w.roleKey, name: w.name, description: w.description })),
  ].sort((a, b) => a.slug.localeCompare(b.slug));

  const start = input.cursor ? Number(input.cursor) : 0;
  const page = items.slice(start, start + limit);
  const nextCursor = start + limit < items.length ? String(start + limit) : null;
  return { items: page, nextCursor };
}
