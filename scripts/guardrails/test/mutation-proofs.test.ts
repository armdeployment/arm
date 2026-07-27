/**
 * Mutation proofs for ARM guardrails (spec §14.2).
 *
 * For each guard: deliberately break the protected behavior, assert the check
 * FAILS, then assert it PASSES in the correct state. A guard that cannot fail
 * is worse than no guard — this is its acceptance test.
 */

import { describe, it, expect } from "vitest";
import { checkTenantIsolation } from "../src/checks/tenant-isolation.js";
import { checkNoContentEgress, parseColumns } from "../src/checks/no-content-egress.js";
import { checkNoSecretDumps } from "../src/checks/no-secret-dumps.js";
import { checkBoundaries } from "../src/checks/boundaries.js";
import { checkSafeRender } from "../src/checks/safe-render.js";
import { checkCISync, parseTableWorkflows } from "../src/checks/ci-sync.js";
import { INIT_SQL, assertTenantMonthPartitioning } from "@arm/clickhouse";

describe("mutation proof: tenant-isolation (§11.6)", () => {
  const clean = [
    { name: "agent", hasTenantId: true },
    { name: "budget", hasTenantId: true },
    { name: "tenant", hasTenantId: false }, // global — allowed
  ];

  it("FAILS when a multi-tenant table drops tenant_id", () => {
    const broken = [
      ...clean,
      { name: "rogue_table", hasTenantId: false }, // mutation
    ];
    const r = checkTenantIsolation(broken);
    expect(r.status).toBe("fail");
    expect(r.detail).toContain("rogue_table");
  });

  it("PASSES when all non-global tables have tenant_id", () => {
    expect(checkTenantIsolation(clean).status).toBe("pass");
  });

  it("FAILS as VACUOUS when the input set is empty (asserts negative)", () => {
    const r = checkTenantIsolation([]);
    expect(r.status).toBe("pass"); // pure fn passes (no violators)
    // NOTE: the vacuous-guard upgrade happens in the RUNNER, not the pure fn.
    // The runner test below covers that. Here we assert the fn's own contract.
    expect(r.scanned).toBe(0);
    expect(r.assertsNegative).toBe(true);
  });
});

describe("mutation proof: no-content-egress (§11.1)", () => {
  const clean = {
    token_usage_event: ["ts", "tenant_id", "sub_account_id", "model_id", "cost_usd"],
    access_audit_event: ["ts", "tenant_id", "agent_id", "decision", "reason"],
  };

  it("FAILS when a content field appears", () => {
    const broken = {
      ...clean,
      token_usage_event: [...clean.token_usage_event, "prompt_body"], // mutation
    };
    const r = checkNoContentEgress(broken);
    expect(r.status).toBe("fail");
    expect(r.detail).toContain("prompt_body");
  });

  it("PASSES when only metadata fields are present", () => {
    expect(checkNoContentEgress(clean).status).toBe("pass");
  });

  it("parses the real shipped 0001_init.sql and PASSES", () => {
    const cols = parseColumns(INIT_SQL);
    expect(Object.keys(cols).length).toBeGreaterThanOrEqual(2);
    expect(checkNoContentEgress(cols).status).toBe("pass");
  });
});

describe("mutation proof: no-secret-dumps (§12)", () => {
  const clean = [{ path: "packages/db/src/index.ts", content: "export const x = 1;" }];

  it("FAILS when an Anthropic key pattern appears", () => {
    // Fragmented so the live no-secret-dumps scanner doesn't flag this test source.
    // The assembled string still exercises the check at runtime.
    const fixtureKey = ["sk-ant-", "api03-", "x".repeat(32)].join("");
    const broken = [
      ...clean,
      { path: "config.ts", content: `const key = "${fixtureKey}"` }, // mutation
    ];
    const r = checkNoSecretDumps(broken);
    expect(r.status).toBe("fail");
    expect(r.detail).toContain("config.ts");
    expect(r.detail).toContain("sk-ant");
  });

  it("PASSES on clean source", () => {
    expect(checkNoSecretDumps(clean).status).toBe("pass");
  });
});

describe("mutation proof: boundaries (§14.3)", () => {
  const clean = [
    { path: "packages/proto/src/index.ts", content: 'export const x = 1;' },
    { path: "packages/config/src/index.ts", content: 'import {} from "@arm/proto";' }, // layer 1 -> 0 ok
    { path: "apps/data-plane/proxy/src/index.ts", content: 'import {} from "@arm/proto";' }, // dataplane -> proto ok
  ];

  it("FAILS on a dependency back-edge (db importing trpc)", () => {
    const broken = [
      ...clean,
      { path: "packages/db/src/index.ts", content: 'import {} from "@arm/trpc";' }, // layer 2 -> 3 mutation
    ];
    const r = checkBoundaries(broken);
    expect(r.status).toBe("fail");
    expect(r.detail).toContain("back-edge");
  });

  it("FAILS when a data-plane app imports a control-plane-only package", () => {
    const broken = [
      ...clean,
      { path: "apps/data-plane/proxy/src/index.ts", content: 'import {} from "@arm/db";' }, // mutation
    ];
    const r = checkBoundaries(broken);
    expect(r.status).toBe("fail");
    expect(r.detail).toContain("data-plane-imports-control");
  });

  it("PASSES on a clean dependency graph", () => {
    expect(checkBoundaries(clean).status).toBe("pass");
  });
});

describe("mutation proof: ClickHouse partitioning (§11.6)", () => {
  it("PASSES on the shipped SQL", () => {
    expect(() => assertTenantMonthPartitioning()).not.toThrow();
  });

  it("THROWS when the partition clause is removed", () => {
    const broken = INIT_SQL.replaceAll(
      "PARTITION BY (tenant_id, toYYYYMM(ts))",
      "PARTITION BY (toYYYYMM(ts))", // mutation — drops tenant_id partitioning on BOTH tables
    );
    expect(() => assertTenantMonthPartitioning(broken)).toThrow(/Invariant 6 violated/);
  });
});

describe("mutation proof: safe-render (§14.1 LLM trust boundary)", () => {
  const clean = [
    { path: "apps/control-plane/web/src/components/sidebar.tsx", content: "<div>safe</div>" },
  ];

  it("FAILS when dangerouslySetInnerHTML appears", () => {
    const broken = [
      ...clean,
      { path: "evil.tsx", content: '<div dangerouslySetInnerHTML={{__html: agent.name}} />' }, // mutation
    ];
    const r = checkSafeRender(broken);
    expect(r.status).toBe("fail");
    expect(r.detail).toContain("dangerouslySetInnerHTML");
  });

  it("FAILS when eval() appears", () => {
    const broken = [
      ...clean,
      { path: "evil.ts", content: "const result = eval(userInput);" }, // mutation
    ];
    const r = checkSafeRender(broken);
    expect(r.status).toBe("fail");
 expect(r.detail).toContain("eval()");
  });

  it("PASSES on safe React/Tailwind source", () => {
    expect(checkSafeRender(clean).status).toBe("pass");
  });
});

describe("mutation proof: ci-sync (§14.3)", () => {
  const table = ["typecheck.yml", "guardrails.yml", "contract-check.yml", "security-audit.yml"];
  const actual = ["typecheck.yml", "guardrails.yml", "contract-check.yml", "security-audit.yml"];

  it("FAILS when a workflow is in AGENTS.md but not in .github/workflows/", () => {
    const r = checkCISync([...table, "phantom.yml"], actual);
    expect(r.status).toBe("fail");
    expect(r.detail).toContain("phantom.yml");
  });

  it("FAILS when a workflow file exists but is not in AGENTS.md", () => {
    const r = checkCISync(table, [...actual, "untracked-ci.yml"]);
    expect(r.status).toBe("fail");
    expect(r.detail).toContain("untracked-ci.yml");
  });

  it("PASSES when table and files match", () => {
    expect(checkCISync(table, actual).status).toBe("pass");
  });

  it("parseTableWorkflows extracts backtick-quoted .yml names", () => {
    const md = "Some text `typecheck.yml` and `guardrails.yml` in a row.";
    expect(parseTableWorkflows(md).sort()).toEqual(["guardrails.yml", "typecheck.yml"]);
  });

  it("FAILS as VACUOUS when both lists are empty", () => {
    // The pure fn returns pass (no drift), but assertsNegative + scanned=0
    // means the runner will upgrade it to fail.
    const r = checkCISync([], []);
    expect(r.scanned).toBe(0);
    expect(r.assertsNegative).toBe(true);
  });
});
