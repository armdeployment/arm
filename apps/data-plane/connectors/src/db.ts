/**
 * ARM DB Connector — proxy strategy (spec §6.2, §9 1.4).
 *
 * ARM data-plane brokers every database query. The master connection string
 * lives in the tenant vault; per-call policy + query audit is applied before
 * forwarding to the target DB (Postgres, MySQL, Snowflake).
 *
 * Stub mode: validates query shape, audits it, returns fixture results.
 * Real mode: opens a scoped connection, executes the query, audits the call.
 */

export type DBType = "postgres" | "mysql" | "snowflake";

/** Thrown by connector paths that are declared but have no implementation. */
export class NotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotConfiguredError";
  }
}

export interface DBQueryRequest {
  agentId: string;
  tenantId: string;
  dbType: DBType;
  database: string;
  query: string;
  params?: unknown[];
  maxRows?: number;
  classificationClearance: "public" | "internal" | "confidential" | "restricted";
}

export interface DBQueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  truncated: boolean;
  auditId: string;
}

/**
 * Proxies a DB query through ARM's policy enforcement.
 *
 * Production flow:
 *   1. Validate agent has a grant for this DB resource
 *   2. Apply classification-aware query filtering (e.g., confidential columns redacted)
 *   3. Open a connection from the tenant's connection pool
 *   4. Execute the query with a timeout + row limit
 *   5. Audit: log the query (not the result) to access_audit_event
 *
 * NOT CONFIGURED — throws. See the note in the body: an empty result set with
 * an invented audit id is indistinguishable from a query that ran and found
 * nothing, which is the wrong thing for a path that exists to enforce policy.
 */
export async function proxyDBQuery(req: DBQueryRequest): Promise<DBQueryResult> {
  // This used to return `columns: ["id","name","value"], rows: []` with an
  // `auditId` it invented — a value implying an audit record exists when none
  // was written. A fabricated audit id is worse than no audit id: it survives
  // into logs and incident reviews as evidence of something that never
  // happened.
  //
  // The real implementation needs a tenant connection pool and the Policy
  // Engine, neither of which this app has: enforcement lives in the control
  // plane and the data-plane boundary (proto/config/client-core) keeps it
  // out of here. Until the pool exists, refusing is the honest answer.
  throw new NotConfiguredError(
    "DB query proxying is not configured: it needs a tenant connection pool and Policy " +
      "Engine enforcement (classification-aware column redaction, grant validation, and an " +
      `access_audit_event write). Refusing rather than returning an empty result set and a ` +
      `fabricated audit id for agent '${req.agentId}'.`,
  );
}
