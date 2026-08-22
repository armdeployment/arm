-- D10 Adoption events (guide 00 §6, docs/solutions/2026-08-21-d10-adoption-first-restructure.md).
-- Adoption-first funnel telemetry: questionnaire -> setup token -> install ->
-- first metered call -> weekly active. `component_pull_event` tracks
-- artifactory blob fetches (cache-hit accounting for the artifact cache).
-- Both METADATA + AUDIT ONLY (Invariant 1) and partitioned
-- (tenant_id, toYYYYMM(ts)) from day 1 (Invariant 6), same as 0001_init.sql.

CREATE TABLE IF NOT EXISTS activation_event (
  ts               DateTime64(3),
  tenant_id        String,
  org_node_id      String,
  user_ref         String,                       -- pseudonymous id, never an email
  job_function_key LowCardinality(String) DEFAULT '',
  step             Enum('invited','questionnaire_started','questionnaire_completed',
                        'token_issued','downloaded','installed','runtime_ready',
                        'connections_started','connections_completed',
                        'first_metered_call','weekly_active'),
  outcome          Enum('ok','error','abandoned'),
  package_version_id String        DEFAULT '',
  client_version   LowCardinality(String) DEFAULT '',
  error_code       LowCardinality(String) DEFAULT '',
  duration_ms      UInt32 DEFAULT 0
) PARTITION BY (tenant_id, toYYYYMM(ts)) ORDER BY (tenant_id, ts);

CREATE TABLE IF NOT EXISTS component_pull_event (
  ts            DateTime64(3),
  tenant_id     String,
  component_id  String,
  version       String,
  blob_digest   String,
  bytes         UInt64,
  cache_hit     UInt8,
  client_version LowCardinality(String) DEFAULT ''
) PARTITION BY (tenant_id, toYYYYMM(ts)) ORDER BY (tenant_id, ts);
