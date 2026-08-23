import { describe, it, expect } from "vitest";
import { recommend, type CatalogIndex } from "../src/recommend.js";
import type { RankedJobFunction } from "../src/score.js";

const CATALOG: CatalogIndex = {
  packages: [
    {
      packageId: "pkg_maint",
      packageVersionId: "pkgv_maint_1",
      slug: "maintenance_technician",
      name: "Maintenance Technician",
      jobFunctions: ["maintenance_technician"],
      headcountFit: 500,
      publishedAt: "2026-01-01T00:00:00",
      eligible: true,
      approvalRequired: false,
    },
    {
      packageId: "pkg_quality",
      packageVersionId: "pkgv_quality_1",
      slug: "quality_engineer",
      name: "Quality Engineer",
      jobFunctions: ["quality_engineer"],
      headcountFit: 200,
      publishedAt: "2026-02-01T00:00:00",
      eligible: true,
      approvalRequired: true,
    },
    {
      packageId: "pkg_generic",
      packageVersionId: "pkgv_generic_old",
      slug: "generic_older",
      name: "Generic (older)",
      jobFunctions: ["office_worker_general"],
      headcountFit: 100,
      publishedAt: "2025-01-01T00:00:00",
      eligible: true,
      approvalRequired: true,
    },
    {
      packageId: "pkg_generic",
      packageVersionId: "pkgv_generic_new",
      slug: "generic_older",
      name: "Generic (newer)",
      jobFunctions: ["office_worker_general"],
      headcountFit: 100,
      publishedAt: "2026-06-01T00:00:00",
      eligible: true,
      approvalRequired: true,
    },
    {
      packageId: "pkg_ineligible",
      packageVersionId: "pkgv_ineligible",
      slug: "restricted_pkg",
      name: "Restricted",
      jobFunctions: ["maintenance_technician"],
      headcountFit: 999,
      publishedAt: "2026-01-01T00:00:00",
      eligible: false,
      approvalRequired: true,
    },
  ],
};

describe("recommend", () => {
  it("returns an empty list when no job function scored", () => {
    expect(recommend([], CATALOG)).toEqual([]);
  });

  it("ranks the exact-match package first and carries approval_required through", () => {
    const ranked: RankedJobFunction[] = [
      { key: "maintenance_technician", weight: 6 },
      { key: "quality_engineer", weight: 1 },
    ];
    const result = recommend(ranked, CATALOG);
    expect(result[0]?.slug).toBe("maintenance_technician");
    expect(result[0]?.exactMatch).toBe(true);
    expect(result[0]?.approvalRequired).toBe(false);
  });

  it("excludes ineligible packages even when they'd otherwise match", () => {
    const ranked: RankedJobFunction[] = [{ key: "maintenance_technician", weight: 3 }];
    const result = recommend(ranked, CATALOG);
    expect(result.map((r) => r.packageVersionId)).not.toContain("pkgv_ineligible");
  });

  it("prefers the more recently published version among otherwise-tied packages", () => {
    const ranked: RankedJobFunction[] = [{ key: "office_worker_general", weight: 3 }];
    const result = recommend(ranked, CATALOG);
    expect(result[0]?.packageVersionId).toBe("pkgv_generic_new");
  });

  it("is deterministic — same inputs produce byte-identical output", () => {
    const ranked: RankedJobFunction[] = [
      { key: "maintenance_technician", weight: 6 },
      { key: "quality_engineer", weight: 3 },
    ];
    expect(recommend(ranked, CATALOG)).toEqual(recommend(ranked, CATALOG));
  });

  it("excludes packages with no job-function overlap at all", () => {
    const ranked: RankedJobFunction[] = [{ key: "job_function_nobody_has", weight: 9 }];
    expect(recommend(ranked, CATALOG)).toEqual([]);
  });
});
