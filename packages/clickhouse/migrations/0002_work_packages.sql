-- D9 Work Packages: token_usage_event gains package-attribution + agentic-health columns.
-- All additive and NULL/default-safe: un-packaged (bare-agent) traffic is unaffected.

ALTER TABLE token_usage_event
  ADD COLUMN IF NOT EXISTS package_id Nullable(String) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS package_version_id Nullable(String) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS steps UInt16 DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tool_calls UInt16 DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cache_read_tokens UInt64 DEFAULT 0,
  ADD COLUMN IF NOT EXISTS semantic_cache_hit UInt8 DEFAULT 0;
