/**
 * guardrail: tool-endpoint-scope (D9).
 *
 * Tool endpoints must be tenant-VPC or approved SaaS tagged with a data
 * classification — connects tools to the Invariant 1 / D2 classification gate.
 * A tool touching `restricted` data is never callable from a closed external
 * model (docs/solutions/2026-08-13-d9-work-packages.md §Consequences →
 * Guardrails):
 *   - endpoints must be `https|internal|mcp|cli://` URLs or bare
 *     `host[:port]` (cli:// is reserved for kind==="cli" local desktop apps),
 *   - `confidential`/`restricted` data ⇒ authStrategy must not be "none" —
 *     EXCEPT `kind === "cli"` desktop engineering apps, which are
 *     local-process invocations on the operator workstation, not
 *     credential-bearing remote endpoints (the OS/session login is the auth
 *     boundary there; D9 automotive landscape, Aug 2026),
 *   - a `connector` touching `restricted` data must not call a public https
 *     endpoint (tenant-VPC form only).
 *
 * Pure-function form (`checkToolEndpoints`) is exercised by mutation proofs.
 * The registered check asserts the DB substrate: the tool table ships nonNull
 * `endpoint`, `auth_strategy`, and `data_classification` columns, so every
 * registered tool is forced through this gate — and then runs the same gate
 * over the REAL shipped tool rows (`@arm/catalog` toolFixtures, snake_case
 * wire shape), so the guard can never go vacuous while fixtures exist.
 */

import { register, type CheckResult } from "../types.js";
import * as fs from "node:fs";
import * as path from "node:path";

/** `https|internal|mcp|cli://` + at least one character of address. */
const ENDPOINT_URL_FORM = /^(https|internal|mcp|cli):\/\/.+/;

/** Bare hostname[:port] — the tenant-VPC form (Invariant 1). */
const ENDPOINT_HOST_PORT_FORM = /^[a-z0-9.-]+(:\d+)?$/i;

/** Public https URL — forbidden for connectors touching restricted data. */
const PUBLIC_HTTPS = /^https:\/\//i;

/** A registered tool as the tool table models it. */
export interface ToolEndpointRecord {
  kind: string;
  endpoint: string;
  authStrategy: string;
  dataClassification: string;
}

/** A registered tool as @arm/catalog ships it (snake_case wire shape). */
export interface ToolEndpointWireFixture {
  kind: string;
  endpoint: string;
  auth_strategy: string;
  data_classification: string;
}

/** Pure function form — used by mutation proofs. */
export function checkToolEndpoints(tools: ToolEndpointRecord[]): CheckResult {
  const violations: string[] = [];

  for (const [i, t] of tools.entries()) {
    const classification = t.dataClassification.toLowerCase();
    const auth = t.authStrategy.toLowerCase();

    if (
      !ENDPOINT_URL_FORM.test(t.endpoint) &&
      !ENDPOINT_HOST_PORT_FORM.test(t.endpoint)
    ) {
      violations.push(
        `index ${i}: malformed endpoint "${t.endpoint}" (expected https|internal|mcp|cli:// URL or bare host[:port])`,
      );
    }

    // Exception: kind==="cli" local desktop apps are local-process
    // invocations (not credential-bearing endpoints) — the OS/session login
    // is the auth boundary, so authStrategy "none" is allowed even for
    // confidential/restricted data (D9 automotive landscape, Aug 2026).
    if (
      t.kind.toLowerCase() !== "cli" &&
      (classification === "confidential" || classification === "restricted") &&
      auth === "none"
    ) {
      violations.push(
        `index ${i}: ${classification} data with authStrategy "none" — classification gate requires credentials (Invariant 1/D2)`,
      );
    }

    if (t.kind === "connector" && classification === "restricted" && PUBLIC_HTTPS.test(t.endpoint)) {
      violations.push(
        `index ${i}: connector touching restricted data must not call a public https endpoint (${t.endpoint}) — tenant-VPC form only (Invariant 1)`,
      );
    }
  }

  const scanned = tools.length;
  if (violations.length > 0) {
    return {
      id: "tool-endpoint-scope",
      status: "fail",
      detail: violations.join("\n"),
      scanned,
      assertsNegative: true,
    };
  }
  return {
    id: "tool-endpoint-scope",
    status: "pass",
    scanned,
    assertsNegative: scanned > 0,
  };
}

/**
 * Pure function form over the shipped @arm/catalog fixture shape (snake_case
 * wire rows) — adapts each row to `checkToolEndpoints`. The registered check
 * feeds it the real `toolFixtures`; mutation proofs exercise it directly.
 */
export function verifyToolEndpoints(fixtures: ToolEndpointWireFixture[]): CheckResult {
  return checkToolEndpoints(
    fixtures.map((t) => ({
      kind: t.kind,
      endpoint: t.endpoint,
      authStrategy: t.auth_strategy,
      dataClassification: t.data_classification,
    })),
  );
}

// ── Registered check (scans the shipped tool table schema) ─────────────────

register({
  id: "tool-endpoint-scope",
  description:
    "Tool table must ship nonNull endpoint, auth_strategy, and data_classification columns — every registered tool passes through the Invariant 1/D2 classification gate (D9). Also runs the endpoint gate over the real @arm/catalog toolFixtures.",
  invariant:
    "D9/Invariant 1: tool endpoints must be tenant-VPC or approved SaaS tagged with data classification; a restricted-data tool is never callable from a closed external model",
  run: async () => {
    const repoRoot = path.resolve(import.meta.dirname, "../../../..");
    const schemaPath = path.join(repoRoot, "packages/db/src/schema/catalog.ts");

    if (!fs.existsSync(schemaPath)) {
      return {
        id: "tool-endpoint-scope",
        status: "fail" as const,
        detail: `catalog schema file not found: ${schemaPath}`,
        scanned: 1,
        assertsNegative: true,
      };
    }

    const content = fs.readFileSync(schemaPath, "utf-8");

    const required = [
      'text("endpoint").notNull()',
      'text("auth_strategy").notNull()',
      'text("data_classification").notNull()',
    ];
    const missing = required.filter((needle) => !content.includes(needle));
    const missingTable =
      !content.includes("export const toolTable") ? ["toolTable definition"] : [];

    const issues = [...missingTable, ...missing];
    if (issues.length > 0) {
      return {
        id: "tool-endpoint-scope",
        status: "fail" as const,
        detail: `tool table schema missing required definitions: ${issues.join(", ")}`,
        scanned: 1,
        assertsNegative: true,
      };
    }

    // ── Shipped fixture rows: run the endpoint gate over real data ─────────
    let tools: ToolEndpointWireFixture[];
    try {
      const catalog = await import("@arm/catalog");
      tools = catalog.toolFixtures;
    } catch (err) {
      return {
        id: "tool-endpoint-scope",
        status: "fail" as const,
        detail: `@arm/catalog unavailable — cannot verify shipped tool fixtures: ${String(err)}`,
        scanned: 0,
        assertsNegative: true,
      };
    }

    const fixtureCheck = verifyToolEndpoints(tools);
    if (fixtureCheck.status === "fail") {
      return fixtureCheck;
    }

    return {
      id: "tool-endpoint-scope",
      status: "pass" as const,
      scanned: fixtureCheck.scanned,
      assertsNegative: true,
    };
  },
});
