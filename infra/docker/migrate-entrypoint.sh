#!/bin/sh
# ARM schema migration — Postgres then ClickHouse.
#
# `set -e` matters here: without it a failed drizzle push would be followed by
# the ClickHouse step and the Job would exit 0, reporting a successful
# migration that half happened. A Helm pre-install hook that lies about
# success is worse than no hook.
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "migrate: DATABASE_URL is not set — refusing to run a partial migration." >&2
  exit 1
fi
if [ -z "${CLICKHOUSE_URL:-}" ]; then
  echo "migrate: CLICKHOUSE_URL is not set — refusing to run a partial migration." >&2
  exit 1
fi

echo "==> Postgres schema (drizzle-kit push)"
pnpm --filter @arm/db exec drizzle-kit push --force

echo "==> ClickHouse migrations"
node scripts/dev/apply-clickhouse-migrations.mjs

if [ "${ARM_SEED_ON_MIGRATE:-0}" = "1" ]; then
  # Off by default. Seeding writes the demo tenant's catalog, library and
  # adoption fixtures — useful for a sandbox or a first look, and exactly what
  # you do not want re-run against a populated production database.
  echo "==> Seeding demo fixtures (ARM_SEED_ON_MIGRATE=1)"
  node scripts/dev/seed-postgres-catalog.mjs
  node scripts/dev/seed-postgres-library.mjs
  node scripts/dev/seed-clickhouse-adoption.mjs
fi

echo "==> Migration complete"
