#!/usr/bin/env node
/**
 * Apply packages/clickhouse/migrations/*.sql against a live ClickHouse
 * instance (Wave 3 DB wiring, docs/solutions/2026-08-21-
 * d10-adoption-first-restructure.md §8).
 *
 * ClickHouse's HTTP interface rejects multi-statement bodies, so each
 * migration file (each has 1-2 CREATE TABLE statements) must be split and
 * sent one statement at a time — and the split must not break on a `;`
 * that appears inside a `--` comment (0001_init.sql's `work_type` column
 * comment has one: "enforcement-ready; NULL until resolved").
 *
 * Usage: CLICKHOUSE_URL=http://arm:arm_dev_password@localhost:8123 \
 *          node scripts/dev/apply-clickhouse-migrations.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, "..", "..", "packages", "clickhouse", "migrations");
const rawUrl = process.env.CLICKHOUSE_URL ?? "http://arm:arm_dev_password@localhost:8123";
// Node's fetch (undici) refuses URLs with embedded userinfo — convert to a
// Basic auth header instead.
const parsedUrl = new URL(rawUrl);
const authHeader =
  parsedUrl.username || parsedUrl.password
    ? { Authorization: `Basic ${Buffer.from(`${parsedUrl.username}:${parsedUrl.password}`).toString("base64")}` }
    : {};
parsedUrl.username = "";
parsedUrl.password = "";
const clickhouseUrl = parsedUrl.toString();

function stripComment(line) {
  const idx = line.indexOf("--");
  return idx === -1 ? line : line.slice(0, idx);
}

function splitStatements(content) {
  const statements = [];
  let current = [];
  for (const line of content.split("\n")) {
    current.push(line);
    if (stripComment(line).includes(";")) {
      statements.push(current.join("\n"));
      current = [];
    }
  }
  if (current.some((l) => l.trim())) statements.push(current.join("\n"));
  return statements.filter((s) => s.trim());
}

async function applyFile(path) {
  const content = readFileSync(path, "utf8");
  for (const stmt of splitStatements(content)) {
    const res = await fetch(clickhouseUrl, { method: "POST", body: stmt, headers: authHeader });
    const text = await res.text();
    if (!res.ok || text.trim()) {
      const firstCodeLine = stmt.split("\n").find((l) => stripComment(l).trim()) ?? stmt.slice(0, 80);
      throw new Error(`ClickHouse migration statement failed (starts: "${firstCodeLine.trim().slice(0, 80)}"): ${text}`);
    }
  }
}

const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

for (const f of files) {
  console.log(`Applying ${f}...`);
  await applyFile(join(migrationsDir, f));
}
console.log(`Done — ${files.length} migration file(s) applied.`);
