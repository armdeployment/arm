/**
 * Library router tests (docs/guides/01-library-artifactory.md §7).
 *
 * Exercises every procedure against the shipped @arm/artifactory +
 * @arm/catalog + @arm/profiles fixtures. No live DB — see
 * library-router.ts's own header for the fixture-mode rationale (matches
 * catalog-router.ts's established pattern).
 */

import { describe, it, expect } from "vitest";
import { createContext, appRouter } from "../src/index.js";
import type { ARMClaims } from "@arm/auth";
import { componentFixturesBySlug, FIXTURE_TENANT_ID } from "@arm/artifactory";
import { packageVersionFixtures } from "@arm/catalog";

const authedClaims: ARMClaims = { sub: "user_01", tenant_id: "tn_01", email: "eng@acme.com" };
// publishComponentVersion validates tenant_id as a UUID (componentVersionSchema,
// @arm/proto) — the shipped fixtures all belong to FIXTURE_TENANT_ID, so
// publish-path tests authenticate as that tenant specifically.
const fixtureTenantClaims: ARMClaims = { sub: "user_01", tenant_id: FIXTURE_TENANT_ID, email: "eng@acme.com" };
function caller(claims: ARMClaims | null) {
  return appRouter.createCaller(createContext({ claims }));
}

describe("library tenant middleware", () => {
  it("rejects unauthenticated calls", async () => {
    await expect(caller(null).library.search({})).rejects.toThrowError(/No authenticated tenant context/);
  });
});

describe("library.search / library.facets", () => {
  it("search returns approved components and packages, faceted", async () => {
    const r = await caller(authedClaims).library.search({ q: "jira" });
    expect(r.items.some((i) => i.slug === "jira")).toBe(true);
    expect(r.facets.kind).toBeDefined();
  });

  it("search filters by kind", async () => {
    const r = await caller(authedClaims).library.search({ kinds: ["skill"] });
    expect(r.items.length).toBeGreaterThan(0);
  });

  it("search paginates with a nextCursor", async () => {
    const r = await caller(authedClaims).library.search({ limit: 1 });
    expect(r.items).toHaveLength(1);
    expect(r.nextCursor).not.toBeNull();
  });

  it("facets reports counts across kind/classification/source", async () => {
    const r = await caller(authedClaims).library.facets({});
    expect(Object.keys(r.facets.kind).length).toBeGreaterThan(0);
    expect(Object.keys(r.facets.classification).length).toBeGreaterThan(0);
  });
});

describe("library.getComponent / library.listVersions", () => {
  it("getComponent returns the component + versions + jobFunctions + installCount for a real slug", async () => {
    const r = await caller(authedClaims).library.getComponent({ slug: "jira" });
    expect(r.component.slug).toBe("jira");
    expect(r.versions.length).toBeGreaterThan(0);
    expect(Array.isArray(r.jobFunctions)).toBe(true);
    expect(typeof r.installCount).toBe("number");
  });

  it("getComponent 404s on an unknown slug", async () => {
    await expect(caller(authedClaims).library.getComponent({ slug: "does-not-exist" })).rejects.toThrow(/not found/i);
  });

  it("listVersions returns newest-first with yanked flagged", async () => {
    const eightD = componentFixturesBySlug["8d-generator"]!;
    const r = await caller(authedClaims).library.listVersions({ componentId: eightD.id });
    expect(r.versions.length).toBeGreaterThanOrEqual(2); // 1.0.0 + 1.1.0 (blob-bearing)
    expect(r.versions[0]!.version).toBe("1.1.0"); // newest first
    for (const v of r.versions) expect(typeof v.yanked).toBe("boolean");
  });
});

describe("library.publishVersion", () => {
  it("publishes a new version and returns an audit entry (impact preview)", async () => {
    const jira = componentFixturesBySlug["jira"]!;
    const r = await caller(fixtureTenantClaims).library.publishVersion({
      componentId: jira.id,
      version: "1.1.0",
      manifest: { note: "test publish" },
    });
    expect(r.componentId).toBe(jira.id);
    expect(r.version).toBe("1.1.0");
    expect(r.manifestSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(r.audit.action).toBe("publish_version");

    // The new version is now visible via listVersions.
    const versions = await caller(fixtureTenantClaims).library.listVersions({ componentId: jira.id });
    expect(versions.versions.some((v) => v.version === "1.1.0")).toBe(true);
  });

  it("rejects publishing a version that already exists (immutability)", async () => {
    const github = componentFixturesBySlug["github"]!;
    await expect(
      caller(fixtureTenantClaims).library.publishVersion({ componentId: github.id, version: "1.0.0", manifest: {} }),
    ).rejects.toThrow(/already exists/);
  });
});

describe("library discovery admin surfaces", () => {
  it("listSources returns configured sources", async () => {
    const r = await caller(authedClaims).library.listSources();
    expect(r.sources.length).toBeGreaterThan(0);
  });

  it("listCandidates returns pending candidates, filterable by status", async () => {
    const r = await caller(authedClaims).library.listCandidates({});
    expect(r.candidates.some((c) => c.status === "new")).toBe(true);
    const onlyNew = await caller(authedClaims).library.listCandidates({ status: "new" });
    expect(onlyNew.candidates.every((c) => c.status === "new")).toBe(true);
  });

  it("promoteCandidate creates a DRAFT+imported component and marks the candidate promoted (audited)", async () => {
    const before = await caller(authedClaims).library.listCandidates({ status: "new" });
    const candidate = before.candidates[0]!;
    const r = await caller(authedClaims).library.promoteCandidate({
      candidateId: candidate.id,
      slug: "promoted-test-component",
    });
    expect(r.component.review_status).toBe("draft");
    expect(r.component.source_kind).toBe("imported");
    expect(r.candidate.status).toBe("promoted");
    expect(r.candidate.promoted_component_id).toBe(r.component.id);
    expect(r.audit.action).toBe("promote_candidate");

    // Promoted component now resolves via getComponent.
    const fetched = await caller(authedClaims).library.getComponent({ slug: "promoted-test-component" });
    expect(fetched.component.review_status).toBe("draft");
  });

  it("rejectCandidate marks a candidate rejected with a reason (audited)", async () => {
    // Add a second candidate to reject (the first is already promoted above).
    const sources = await caller(authedClaims).library.listSources();
    expect(sources.sources.length).toBeGreaterThan(0);
    const candidates = await caller(authedClaims).library.listCandidates({});
    const rejectable = candidates.candidates.find((c) => c.status === "new" || c.status === "triaged");
    if (rejectable) {
      const r = await caller(authedClaims).library.rejectCandidate({ candidateId: rejectable.id, reason: "not needed" });
      expect(r.candidate.status).toBe("rejected");
      expect(r.audit.detail).toBe("not needed");
    }
  });

  it("promoteCandidate 404s on an unknown candidate id", async () => {
    await expect(
      caller(authedClaims).library.promoteCandidate({ candidateId: "99999999-9999-4999-8999-999999999999", slug: "x" }),
    ).rejects.toThrow(/not found/i);
  });
});

describe("library job-function surfaces", () => {
  it("listJobFunctions returns the manufacturing taxonomy with package coverage counts", async () => {
    const r = await caller(authedClaims).library.listJobFunctions({});
    expect(r.jobFunctions.length).toBeGreaterThan(100); // manufacturing taxonomy is ~250 keys
    const covered = r.jobFunctions.find((jf) => jf.key === "product_quality_engineer_pqe");
    expect(covered?.packageCoverageCount).toBeGreaterThanOrEqual(1);
  });

  it("listJobFunctions filters by family", async () => {
    const r = await caller(authedClaims).library.listJobFunctions({ family: "Quality Management" });
    expect(r.jobFunctions.length).toBeGreaterThan(0);
    for (const jf of r.jobFunctions) expect(jf.functionFamily).toBe("Quality Management");
  });

  it("recommendForJobFunction ranks components and packages for a real job function key", async () => {
    const r = await caller(authedClaims).library.recommendForJobFunction({ key: "product_quality_engineer_pqe" });
    expect(Array.isArray(r.components)).toBe(true);
    expect(Array.isArray(r.packages)).toBe(true);
    expect(r.packages.length).toBe(packageVersionFixtures.length);
  });

  it("gaps returns uncovered job functions ranked by headcount weight", async () => {
    const r = await caller(authedClaims).library.gaps();
    expect(r.gaps.length).toBeGreaterThan(0);
    for (let i = 1; i < r.gaps.length; i++) {
      expect(r.gaps[i - 1]!.headcountWeight).toBeGreaterThanOrEqual(r.gaps[i]!.headcountWeight);
    }
    // A covered job function must never appear in gaps.
    expect(r.gaps.some((g) => g.key === "product_quality_engineer_pqe")).toBe(false);
  });
});
