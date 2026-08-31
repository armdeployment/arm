import { describe, it, expect } from "vitest";
import { computeFacets } from "../src/facets.js";
import type { SearchableComponentRow, SearchableWorkPackageRow } from "../src/search.js";

function comp(overrides: Partial<SearchableComponentRow>): SearchableComponentRow {
  return {
    id: "c1",
    slug: "jira",
    name: "Jira",
    description: "",
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
    description: "",
    mode: "copilot",
    jobFunctions: [],
    installCount: 0,
    ...overrides,
  };
}

describe("computeFacets", () => {
  it("counts by kind, classification, source for approved components only", () => {
    const rows = [
      comp({ slug: "a", kind: "mcp", dataClassification: "internal", sourceKind: "first_party" }),
      comp({ slug: "b", kind: "mcp", dataClassification: "internal", sourceKind: "first_party" }),
      comp({
        slug: "c",
        kind: "skill",
        dataClassification: "confidential",
        sourceKind: "tenant_authored",
      }),
      comp({ slug: "d", kind: "skill", reviewStatus: "draft" }), // excluded
    ];
    const facets = computeFacets(rows, []);
    expect(facets.kind).toEqual({ mcp: 2, skill: 1 });
    expect(facets.classification).toEqual({ internal: 2, confidential: 1 });
    expect(facets.source).toEqual({ first_party: 2, tenant_authored: 1 });
  });

  it("counts by mode across work packages", () => {
    const wps = [wp({ mode: "copilot" }), wp({ mode: "copilot" }), wp({ mode: "automated" })];
    const facets = computeFacets([], wps);
    expect(facets.mode).toEqual({ copilot: 2, automated: 1 });
  });

  it("counts jobFunction across BOTH components and work packages", () => {
    const comps = [comp({ jobFunctions: ["quality_engineer", "spc_metrology_engineer"] })];
    const wps = [wp({ jobFunctions: ["quality_engineer"] })];
    const facets = computeFacets(comps, wps);
    expect(facets.jobFunction).toEqual({ quality_engineer: 2, spc_metrology_engineer: 1 });
  });

  it("returns empty facets on empty input", () => {
    const facets = computeFacets([], []);
    expect(facets).toEqual({ kind: {}, jobFunction: {}, classification: {}, mode: {}, source: {} });
  });
});
