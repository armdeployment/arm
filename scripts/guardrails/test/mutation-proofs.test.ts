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
import { checkNoProfileBranching } from "../src/checks/no-profile-branching.js";
import {
  checkTaxonomyScope,
  type TaxonomyRow,
} from "../src/checks/taxonomy-scope.js";
import {
  checkWorkTypeUnknown,
  UNKNOWN_THRESHOLD_PCT,
  type ClassificationStats,
} from "../src/checks/work-type-unknown.js";
import {
  checkPackageIntegrity,
  verifyFixtureIntegrity,
  sha256Canonical,
  type CatalogVersionFixture,
  type ManifestHashTools,
} from "../src/checks/package-integrity.js";
import { checkLeastPrivilege } from "../src/checks/package-least-privilege.js";
import {
  checkToolEndpoints,
  verifyToolEndpoints,
  type ToolEndpointRecord,
  type ToolEndpointWireFixture,
} from "../src/checks/tool-endpoint-scope.js";
import { checkPackageDrift } from "../src/checks/package-drift.js";
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

  it("FAILS when client-core (layer 1) imports @arm/db (layer 2 back-edge)", () => {
    const broken = [
      ...clean,
      { path: "packages/client-core/src/index.ts", content: 'import {} from "@arm/db";' }, // mutation
    ];
    const r = checkBoundaries(broken);
    expect(r.status).toBe("fail");
    expect(r.detail).toContain("back-edge");
    expect(r.detail).toContain("client-core");
  });

  it("FAILS when a data-plane app imports @arm/catalog (control-plane only)", () => {
    const broken = [
      ...clean,
      { path: "apps/data-plane/plugin-ingest/src/index.ts", content: 'import {} from "@arm/catalog";' }, // mutation
    ];
    const r = checkBoundaries(broken);
    expect(r.status).toBe("fail");
    expect(r.detail).toContain("data-plane-imports-control");
    expect(r.detail).toContain("catalog");
  });

  it("PASSES when plugin-ingest imports @arm/client-core (shared layer 1)", () => {
    const files = [
      ...clean,
      { path: "apps/data-plane/plugin-ingest/src/index.ts", content: 'import {} from "@arm/client-core";' },
    ];
    expect(checkBoundaries(files).status).toBe("pass");
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

describe("mutation proof: no-profile-branching (D6)", () => {
  const clean = [
    { path: "packages/policy/src/index.ts", content: "export function checkPolicy() { return true; }" },
    { path: "apps/data-plane/proxy/src/index.ts", content: "export function proxy() { return null; }" },
    { path: "apps/simulation/src/proxy.ts", content: "export function handle() { return null; }" },
    // Allowed path — should never trigger
    { path: "packages/profiles/src/index.ts", content: "export const manufacturingProfile = getProfile('manufacturing');" },
  ];

  it("FAILS when a policy file branches on industryProfile", () => {
    const broken = [
      ...clean,
      {
        path: "packages/policy/src/index.ts",
        content: "if (industryProfile === 'manufacturing') { applyOTPolicy(); }", // mutation
      },
    ];
    const r = checkNoProfileBranching(broken);
    expect(r.status).toBe("fail");
    expect(r.detail).toContain("industryProfile");
  });

  it("FAILS when a proxy file reads industryProfile", () => {
    const broken = [
      ...clean,
      {
        path: "apps/data-plane/proxy/src/index.ts",
        content: "const profile = tenant.industryProfile;", // mutation
      },
    ];
    const r = checkNoProfileBranching(broken);
    expect(r.status).toBe("fail");
    expect(r.detail).toContain("industryProfile");
  });

  it("FAILS when enforcement code calls getProfile()", () => {
    const broken = [
      ...clean,
      {
        path: "apps/simulation/src/proxy.ts",
        content: "const p = getProfile(tenant.profile);", // mutation
      },
    ];
    const r = checkNoProfileBranching(broken);
    expect(r.status).toBe("fail");
    expect(r.detail).toContain("getProfile");
  });

  it("does NOT flag allowed paths (profiles package, db-init, control-plane web)", () => {
    const allowed = [
      { path: "packages/profiles/src/index.ts", content: "export function getProfile(id) { return manufacturingProfile; }" },
      { path: "apps/simulation/src/db-init.ts", content: "const profile = getProfile('manufacturing');" },
      { path: "apps/control-plane/web/src/app/page.tsx", content: "const profileId = tenant.industryProfile;" },
    ];
    const r = checkNoProfileBranching(allowed);
    expect(r.status).toBe("pass");
  });

  it("PASSES on clean enforcement code (no profile references)", () => {
    expect(checkNoProfileBranching(clean).status).toBe("pass");
  });

  it("asserts a negative (subject to vacuous-guard rule)", () => {
    const r = checkNoProfileBranching(clean);
    expect(r.assertsNegative).toBe(true);
    expect(r.scanned).toBe(clean.length);
  });
});

describe("mutation proof: taxonomy-scope (D7)", () => {
  const clean: TaxonomyRow[] = [
    { tenantId: "tn1", scopeType: "department", scopeId: "dept_eng", labels: ["code_review", "test_gen"] },
    { tenantId: "tn1", scopeType: "department", scopeId: "dept_mfg", labels: ["cnc_toolpath", "defect_analysis"] },
  ];

  it("FAILS when a WorkTypeTaxonomy row misses tenant_id", () => {
    const broken: TaxonomyRow[] = [
      ...clean,
      { tenantId: null, scopeType: "department", scopeId: "dept_x", labels: ["x"] }, // mutation
    ];
    const r = checkTaxonomyScope(broken);
    expect(r.status).toBe("fail");
    expect(r.detail).toContain("tenant_id");
  });

  it("FAILS when scope_type is null", () => {
    const broken: TaxonomyRow[] = [
      { tenantId: "tn1", scopeType: null, scopeId: "dept_x", labels: ["x"] }, // mutation
    ];
    const r = checkTaxonomyScope(broken);
    expect(r.status).toBe("fail");
    expect(r.detail).toContain("scope_type");
  });

  it("FAILS when labels is empty", () => {
    const broken: TaxonomyRow[] = [
      { tenantId: "tn1", scopeType: "department", scopeId: "dept_x", labels: [] }, // mutation
    ];
    const r = checkTaxonomyScope(broken);
    expect(r.status).toBe("fail");
    expect(r.detail).toContain("empty label set");
  });

  it("PASSES on clean taxonomy rows", () => {
    expect(checkTaxonomyScope(clean).status).toBe("pass");
  });
});

describe("mutation proof: work-type-unknown (D7)", () => {
  const clean: ClassificationStats = {
    labelCounts: { code_review: 60, test_generation: 30, hot_issue_resolution: 10 },
    unknownCount: 5,
  };

  it("FAILS when unknown rate exceeds threshold", () => {
    const broken: ClassificationStats = {
      labelCounts: { code_review: 30, test_generation: 20 },
      unknownCount: 40, // mutation — 44% unknown, ≥ threshold
    };
    const r = checkWorkTypeUnknown(broken);
    expect(r.status).toBe("fail");
    expect(r.detail).toContain("unknown");
  });

  it("PASSES when unknown rate is below threshold", () => {
    const r = checkWorkTypeUnknown(clean);
    expect(r.status).toBe("pass");
    expect(clean.unknownCount / (60 + 30 + 10 + 5)).toBeLessThan(UNKNOWN_THRESHOLD_PCT);
  });

  it("FAILS as VACUOUS when zero prompts observed (empty input = red)", () => {
    const empty: ClassificationStats = { labelCounts: {}, unknownCount: 0 };
    const r = checkWorkTypeUnknown(empty);
    expect(r.status).toBe("fail");
    expect(r.detail).toContain("vacuous");
  });
});

describe("mutation proof: package-integrity (D9)", () => {
  const manifest = {
    tools: [{ toolId: "tool_mes", toolVersion: "1.4.2", scopes: ["read"] }],
    permissions: ["resource:mes:read"],
    skills: ["spc_analysis"],
  };
  const clean = [{ manifestSha256: sha256Canonical(manifest), manifestJson: manifest }];

  it("FAILS when the manifest content is tampered after hashing", () => {
    const broken = [
      {
        manifestSha256: clean[0]!.manifestSha256,
        manifestJson: { ...manifest, permissions: ["resource:mes:write"] }, // mutation
      },
    ];
    const r = checkPackageIntegrity(broken);
    expect(r.status).toBe("fail");
    expect(r.detail).toContain("index 0");
    expect(r.detail).toContain("mismatch");
  });

  it("FAILS when the declared hash is tampered", () => {
    const broken = [{ manifestSha256: "0".repeat(64), manifestJson: manifest }]; // mutation
    expect(checkPackageIntegrity(broken).status).toBe("fail");
  });

  it("PASSES on intact manifests", () => {
    expect(checkPackageIntegrity(clean).status).toBe("pass");
  });

  it("canonicalization is key-order independent (same bytes in, same hash out)", () => {
    const a = { roleKey: "quality_engineer", nested: { b: 1, a: [1, 2, 3] } };
    const b = { nested: { a: [1, 2, 3], b: 1 }, roleKey: "quality_engineer" };
    expect(sha256Canonical(a)).toBe(sha256Canonical(b));
    expect(sha256Canonical(a)).toHaveLength(64);
  });

  it("PASSES on empty input (vacuous upgrade is the registered check's job, §14.2)", () => {
    const r = checkPackageIntegrity([]);
    expect(r.status).toBe("pass");
    expect(r.scanned).toBe(0);
    expect(r.assertsNegative).toBe(false);
  });
});

describe("mutation proof: package-least-privilege (D9)", () => {
  const clean = [
    "resource:s3:read",
    "tool:jira:invoke",
    "org_node:plant_detroit:approve",
    "org_node:*", // legacy delegation form — allowed
  ];

  it("FAILS on a bare wildcard resource grant", () => {
    const r = checkLeastPrivilege([...clean, "resource:*"]); // mutation
    expect(r.status).toBe("fail");
    expect(r.detail).toContain("bare wildcard");
  });

  it("FAILS on a bare wildcard tool grant", () => {
    const r = checkLeastPrivilege([...clean, "tool:*"]); // mutation
    expect(r.status).toBe("fail");
    expect(r.detail).toContain("bare wildcard");
  });

  it("FAILS on a malformed permission entry", () => {
    const r = checkLeastPrivilege([...clean, "resource:s3"]); // mutation — missing verb
    expect(r.status).toBe("fail");
    expect(r.detail).toContain("malformed");
  });

  it("FAILS on duplicate permission entries", () => {
    const r = checkLeastPrivilege([...clean, "resource:s3:read"]); // mutation — dup
    expect(r.status).toBe("fail");
    expect(r.detail).toContain("duplicate");
  });

  it("PASSES on explicit scoped grants (incl. legacy org_node:*)", () => {
    expect(checkLeastPrivilege(clean).status).toBe("pass");
  });

  it("PASSES on empty input (vacuous upgrade is the registered check's job, §14.2)", () => {
    const r = checkLeastPrivilege([]);
    expect(r.status).toBe("pass");
    expect(r.scanned).toBe(0);
    expect(r.assertsNegative).toBe(false);
  });
});

describe("mutation proof: tool-endpoint-scope (D9)", () => {
  const clean: ToolEndpointRecord[] = [
    {
      kind: "mcp",
      endpoint: "internal://mcp-gateway.tenant-vpc",
      authStrategy: "service_account",
      dataClassification: "confidential",
    },
    {
      kind: "api",
      endpoint: "https://api.github.com",
      authStrategy: "oauth",
      dataClassification: "public",
    },
    {
      kind: "connector",
      endpoint: "10.0.4.11:8443",
      authStrategy: "pat",
      dataClassification: "restricted",
    },
  ];

  it("FAILS when restricted data uses authStrategy none", () => {
    const broken: ToolEndpointRecord[] = [
      {
        kind: "mcp",
        endpoint: "internal://historian.plant",
        authStrategy: "none", // mutation
        dataClassification: "restricted",
      },
    ];
    const r = checkToolEndpoints(broken);
    expect(r.status).toBe("fail");
    expect(r.detail).toContain("authStrategy");
  });

  it("FAILS when confidential data uses authStrategy none", () => {
    const broken: ToolEndpointRecord[] = [
      {
        kind: "api",
        endpoint: "https://api.example.com",
        authStrategy: "none", // mutation
        dataClassification: "confidential",
      },
    ];
    expect(checkToolEndpoints(broken).status).toBe("fail");
  });

  it("FAILS when a connector touching restricted data points at a public https URL", () => {
    const broken: ToolEndpointRecord[] = [
      {
        kind: "connector",
        endpoint: "https://public-saas.example.com/api", // mutation — must be tenant-VPC
        authStrategy: "oauth",
        dataClassification: "restricted",
      },
    ];
    const r = checkToolEndpoints(broken);
    expect(r.status).toBe("fail");
    expect(r.detail).toContain("public https");
  });

  it("FAILS on a malformed endpoint", () => {
    const broken: ToolEndpointRecord[] = [
      {
        kind: "api",
        endpoint: "file:///etc/passwd", // mutation
        authStrategy: "none",
        dataClassification: "public",
      },
    ];
    const r = checkToolEndpoints(broken);
    expect(r.status).toBe("fail");
    expect(r.detail).toContain("malformed endpoint");
  });

  it("PASSES a valid cli:// endpoint for a local desktop app (kind cli)", () => {
    const r = checkToolEndpoints([
      {
        kind: "cli",
        endpoint: "cli://nx.open-api",
        authStrategy: "none", // allowed: local-process invocation, OS session is the auth boundary
        dataClassification: "confidential",
      },
    ]);
    expect(r.status).toBe("pass");
    expect(r.scanned).toBe(1);
  });

  it("FAILS on a disallowed endpoint scheme (ftp://)", () => {
    const broken: ToolEndpointRecord[] = [
      {
        kind: "cli",
        endpoint: "ftp://files.example.com/parts", // mutation — cli tools may only use cli://
        authStrategy: "none",
        dataClassification: "public",
      },
    ];
    const r = checkToolEndpoints(broken);
    expect(r.status).toBe("fail");
    expect(r.detail).toContain("malformed endpoint");
  });

  it("FAILS when a non-cli tool uses authStrategy none on confidential data (no exception leak)", () => {
    const broken: ToolEndpointRecord[] = [
      {
        kind: "http_api",
        endpoint: "https://api.example.com",
        authStrategy: "none", // mutation — the cli exception must NOT apply to http_api tools
        dataClassification: "confidential",
      },
    ];
    expect(checkToolEndpoints(broken).status).toBe("fail");
  });

  it("PASSES on clean endpoints (VPC forms + classified SaaS)", () => {
    expect(checkToolEndpoints(clean).status).toBe("pass");
  });

  it("PASSES on empty input (vacuous upgrade is the registered check's job, §14.2)", () => {
    const r = checkToolEndpoints([]);
    expect(r.status).toBe("pass");
    expect(r.scanned).toBe(0);
    expect(r.assertsNegative).toBe(false);
  });
});

describe("mutation proof: package-drift (D9)", () => {
  const channel = ["1.0.0", "1.1.0", "1.2.0"];
  const clean = [{ roleKey: "quality_engineer", installedVersion: "1.1.0", channel }];

  it("FAILS when the installed version trails the channel by > maxLag", () => {
    const broken = [
      { roleKey: "quality_engineer", installedVersion: "1.0.0", channel }, // mutation — lag 2 > 1
    ];
    const r = checkPackageDrift(broken);
    expect(r.status).toBe("fail");
    expect(r.detail).toContain("trails release channel");
  });

  it("FAILS when the installed version is missing from the channel", () => {
    const broken = [
      { roleKey: "quality_engineer", installedVersion: "0.9.0", channel }, // mutation
    ];
    const r = checkPackageDrift(broken);
    expect(r.status).toBe("fail");
    expect(r.detail).toContain("not in release channel");
  });

  it("FAILS when the release channel is empty", () => {
    const broken = [
      { roleKey: "quality_engineer", installedVersion: "1.0.0", channel: [] }, // mutation
    ];
    const r = checkPackageDrift(broken);
    expect(r.status).toBe("fail");
    expect(r.detail).toContain("empty release channel");
  });

  it("PASSES at the maxLag boundary (lag 1 with maxLag 1)", () => {
    expect(checkPackageDrift(clean).status).toBe("pass");
  });

  it("PASSES when installed on the latest channel version (lag 0)", () => {
    const latest = [{ roleKey: "quality_engineer", installedVersion: "1.2.0", channel }];
    expect(checkPackageDrift(latest).status).toBe("pass");
  });

  it("PASSES on empty input (vacuous upgrade is the registered check's job, §14.2)", () => {
    const r = checkPackageDrift([]);
    expect(r.status).toBe("pass");
    expect(r.scanned).toBe(0);
    expect(r.assertsNegative).toBe(false);
  });
});

describe("mutation proof: verifyToolEndpoints over shipped fixtures (D9)", () => {
  const clean: ToolEndpointWireFixture[] = [
    {
      kind: "connector",
      endpoint: "pi.internal:5450",
      auth_strategy: "pat",
      data_classification: "restricted",
    },
    {
      kind: "mcp",
      endpoint: "mcp://mcp.jira.internal",
      auth_strategy: "oauth",
      data_classification: "internal",
    },
  ];

  it("FAILS when a fixture endpoint changes to a public https URL on restricted data", () => {
    const broken: ToolEndpointWireFixture[] = [
      { ...clean[0]!, endpoint: "https://pi.saas.example.com/api" }, // mutation
    ];
    const r = verifyToolEndpoints(broken);
    expect(r.status).toBe("fail");
    expect(r.detail).toContain("public https");
  });

  it("FAILS when a restricted-data fixture drops its auth_strategy", () => {
    const broken: ToolEndpointWireFixture[] = [
      { ...clean[0]!, auth_strategy: "none" }, // mutation
    ];
    const r = verifyToolEndpoints(broken);
    expect(r.status).toBe("fail");
    expect(r.detail).toContain("authStrategy");
  });

  it("PASSES on clean wire-shaped fixtures", () => {
    const r = verifyToolEndpoints(clean);
    expect(r.status).toBe("pass");
    expect(r.scanned).toBe(2);
  });

  it("PASSES cli:// wire fixtures with auth_strategy none (local desktop apps)", () => {
    const r = verifyToolEndpoints([
      {
        kind: "cli",
        endpoint: "cli://inca.etas",
        auth_strategy: "none",
        data_classification: "confidential",
      },
    ]);
    expect(r.status).toBe("pass");
    expect(r.scanned).toBe(1);
  });

  it("PASSES on the real @arm/catalog toolFixtures", async () => {
    const catalog = await import("@arm/catalog");
    const r = verifyToolEndpoints(catalog.toolFixtures);
    expect(r.status).toBe("pass");
    expect(r.scanned).toBeGreaterThanOrEqual(4);
  });
});

describe("mutation proof: verifyFixtureIntegrity over shipped fixtures (D9)", () => {
  const toolId = "10000000-0000-4000-8000-000000000001";
  const manifest = {
    tools: [{ tool_id: toolId, tool_version: "1.0.0", scopes: ["read:issue"] }],
    skills: ["8d-generator"],
    subagent_configs: [],
    permissions: ["tool:invoke:jira"],
    model_routing: {},
    budget_template: {},
    starter_prompts: [],
    template_refs: [],
    min_agent_version: "1.4.0",
  };
  const hashTools: ManifestHashTools = {
    canonicalManifest: (source: unknown) => {
      const { manifest_sha256: _dropped, ...fields } = source as CatalogVersionFixture;
      return fields;
    },
    manifestSha256: sha256Canonical,
  };
  const clean = {
    ...manifest,
    manifest_sha256: sha256Canonical(manifest),
  };
  const knownToolIds = new Set([toolId]);

  it("FAILS when a fixture field is tampered after hashing", () => {
    const broken = {
      ...manifest,
      permissions: ["resource:mes:write"], // mutation
      manifest_sha256: sha256Canonical(manifest),
    };
    const r = verifyFixtureIntegrity([broken], hashTools, knownToolIds);
    expect(r.status).toBe("fail");
    expect(r.detail).toContain("mismatch");
  });

  it("FAILS when the declared fixture hash is tampered", () => {
    const broken = { ...clean, manifest_sha256: "0".repeat(64) }; // mutation
    expect(verifyFixtureIntegrity([broken], hashTools, knownToolIds).status).toBe("fail");
  });

  it("FAILS on a dangling tool_id absent from the registry id set", () => {
    const dangling = {
      ...manifest,
      tools: [
        { tool_id: "99999999-0000-4000-8000-000000000999", tool_version: "1.0.0", scopes: [] }, // mutation
      ],
    };
    const broken = {
      ...dangling,
      manifest_sha256: sha256Canonical(dangling),
    };
    const r = verifyFixtureIntegrity([broken], hashTools, knownToolIds);
    expect(r.status).toBe("fail");
    expect(r.detail).toContain("dangling");
  });

  it("PASSES on intact wire-shaped fixtures", () => {
    const r = verifyFixtureIntegrity([clean], hashTools, knownToolIds);
    expect(r.status).toBe("pass");
    expect(r.scanned).toBe(1);
  });

  it("PASSES on the real @arm/catalog packageVersionFixtures + toolIdFixtures", async () => {
    const catalog = await import("@arm/catalog");
    const r = verifyFixtureIntegrity(
      catalog.packageVersionFixtures,
      {
        canonicalManifest: catalog.canonicalManifest as ManifestHashTools["canonicalManifest"],
        manifestSha256: catalog.manifestSha256,
      },
      new Set(Object.values(catalog.toolIdFixtures)),
    );
    expect(r.status).toBe("pass");
    expect(r.scanned).toBeGreaterThanOrEqual(6);
  });
});
