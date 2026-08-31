import { describe, it, expect } from "vitest";
import {
  buildComponentSearchSql,
  buildWorkPackageSearchSql,
  searchInMemory,
  type SearchableComponentRow,
  type SearchableWorkPackageRow,
} from "../src/search.js";

const TENANT = "tn-1";

describe("buildComponentSearchSql", () => {
  it("always scopes by tenant_id and approved review_status", () => {
    const { sql, params } = buildComponentSearchSql(TENANT, {});
    expect(sql).toContain("tenant_id = $1");
    expect(sql).toContain("review_status = 'approved'");
    expect(params[0]).toBe(TENANT);
  });

  it("adds an FTS + trigram clause when q is provided", () => {
    const { sql, params } = buildComponentSearchSql(TENANT, { q: "jira" });
    expect(sql).toContain("plainto_tsquery");
    expect(sql).toContain("slug %");
    expect(params).toContain("jira");
  });

  it("adds a kind filter with ANY($n)", () => {
    const { sql, params } = buildComponentSearchSql(TENANT, { kinds: ["mcp", "skill"] });
    expect(sql).toContain("kind = ANY(");
    expect(params).toContainEqual(["mcp", "skill"]);
  });

  it("adds a job-function EXISTS subquery", () => {
    const { sql, params } = buildComponentSearchSql(TENANT, { jobFunction: "quality_engineer" });
    expect(sql).toContain("component_job_function");
    expect(params).toContain("quality_engineer");
  });

  it("respects a custom limit", () => {
    const { sql, params } = buildComponentSearchSql(TENANT, { limit: 5 });
    expect(sql).toMatch(/LIMIT \$\d+$/);
    expect(params[params.length - 1]).toBe(5);
  });
});

describe("buildWorkPackageSearchSql", () => {
  it("scopes by tenant_id and supports mode + jobFunction filters", () => {
    const { sql, params } = buildWorkPackageSearchSql(TENANT, {
      mode: "copilot",
      jobFunction: "quality_engineer",
    });
    expect(sql).toContain("tenant_id = $1");
    expect(sql).toContain("mode = $");
    expect(sql).toContain("work_package_job_function");
    expect(params).toContain("copilot");
  });
});

function comp(overrides: Partial<SearchableComponentRow>): SearchableComponentRow {
  return {
    id: "c1",
    slug: "jira",
    name: "Jira",
    description: "Issue tracking",
    kind: "mcp",
    jobFunctions: [],
    dataClassification: "internal",
    sourceKind: "first_party",
    reviewStatus: "approved",
    installCount: 0,
    ...overrides,
  };
}

function wp(overrides: Partial<SearchableWorkPackageRow>): SearchableWorkPackageRow {
  return {
    id: "w1",
    roleKey: "quality_engineer",
    name: "Quality Engineer",
    description: "8D/PPAP copilot",
    mode: "copilot",
    jobFunctions: ["product_quality_engineer_pqe"],
    installCount: 0,
    ...overrides,
  };
}

describe("searchInMemory", () => {
  it("excludes non-approved components", () => {
    const rows = [comp({ slug: "draft-thing", reviewStatus: "draft" }), comp({ slug: "jira" })];
    const r = searchInMemory(rows, [], {});
    expect(r.items.map((i) => i.slug)).toEqual(["jira"]);
  });

  it("filters by query against name/slug/description (case-insensitive)", () => {
    const rows = [
      comp({ slug: "jira" }),
      comp({ slug: "github", name: "GitHub", description: "Code hosting" }),
    ];
    const r = searchInMemory(rows, [], { q: "CODE" });
    expect(r.items.map((i) => i.slug)).toEqual(["github"]);
  });

  it("filters by kind", () => {
    const rows = [comp({ slug: "jira", kind: "mcp" }), comp({ slug: "8d-gen", kind: "skill" })];
    const r = searchInMemory(rows, [], { kinds: ["skill"] });
    expect(r.items.map((i) => i.slug)).toEqual(["8d-gen"]);
  });

  it("filters by classification", () => {
    const rows = [
      comp({ slug: "public-x", dataClassification: "public" }),
      comp({ slug: "internal-x", dataClassification: "internal" }),
    ];
    const r = searchInMemory(rows, [], { classification: "public" });
    expect(r.items.map((i) => i.slug)).toEqual(["public-x"]);
  });

  it("filters by jobFunction across both components and work packages", () => {
    const comps = [
      comp({ slug: "jira", jobFunctions: ["quality_engineer"] }),
      comp({ slug: "github", jobFunctions: [] }),
    ];
    const wps = [
      wp({ roleKey: "quality_engineer", jobFunctions: ["quality_engineer"] }),
      wp({ roleKey: "other", jobFunctions: [] }),
    ];
    const r = searchInMemory(comps, wps, { jobFunction: "quality_engineer" });
    expect(r.items.map((i) => i.slug).sort()).toEqual(["jira", "quality_engineer"]);
  });

  it("filters work packages by mode", () => {
    const wps = [
      wp({ roleKey: "copilot-role", mode: "copilot" }),
      wp({ roleKey: "auto-role", mode: "automated" }),
    ];
    const r = searchInMemory([], wps, { mode: "automated" });
    expect(r.items.map((i) => i.slug)).toEqual(["auto-role"]);
  });

  it("paginates deterministically via cursor + limit", () => {
    const rows = ["a", "b", "c", "d"].map((s) => comp({ slug: s }));
    const page1 = searchInMemory(rows, [], { limit: 2 });
    expect(page1.items.map((i) => i.slug)).toEqual(["a", "b"]);
    expect(page1.nextCursor).toBe("2");
    const page2 = searchInMemory(rows, [], { limit: 2, cursor: page1.nextCursor! });
    expect(page2.items.map((i) => i.slug)).toEqual(["c", "d"]);
    expect(page2.nextCursor).toBeNull();
  });

  it("orders results deterministically by slug ascending", () => {
    const rows = [comp({ slug: "zeta" }), comp({ slug: "alpha" }), comp({ slug: "mid" })];
    const r = searchInMemory(rows, [], {});
    expect(r.items.map((i) => i.slug)).toEqual(["alpha", "mid", "zeta"]);
  });
});
