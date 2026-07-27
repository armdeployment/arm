-- ARM ClickHouse event-ledger schema (spec §4.2).
-- Non-negotiable: partitioned by (tenant_id, toYYYYMM(ts)) from day 1 (Invariant 6).
-- NOTE: ARM-the-control-plane stores metadata/audit ONLY here (Invariant 1).
-- Prompt bodies and resource content never reach this store.

CREATE TABLE IF NOT EXISTS token_usage_event (
  ts              DateTime64(3),
  tenant_id       String,
  sub_account_id  String,
  agent_id        String,
  priority_tier   LowCardinality(String),
  model_id        String,
  input_tokens    UInt64,
  output_tokens   UInt64,
  cost_usd        Decimal(12,6),
  source          Enum('proxy','gateway','plugin','billing_api')
) PARTITION BY (tenant_id, toYYYYMM(ts))
  ORDER BY (tenant_id, ts);

CREATE TABLE IF NOT EXISTS access_audit_event (
  ts            DateTime64(3),
  tenant_id     String,
  agent_id      String,
  resource_id   String,
  action        String,
  decision      Enum('allow','deny','jit_grant'),
  reason        String,
  connector     String
) PARTITION BY (tenant_id, toYYYYMM(ts))
  ORDER BY (tenant_id, ts);
