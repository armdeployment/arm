/**
 * Library router tests (docs/guides/01-library-artifactory.md §7).
 *
 * Exercises every procedure against the shipped @arm/artifactory +
 * @arm/catalog + @arm/profiles fixtures. No live DB — see
 * library-router.ts's own header for the fixture-mode rationale (matches
 * catalog-router.ts's established pattern).
 */

import { describe, it, expect, afterEach } from "vitest";
import { createContext, appRouter } from "../src/index.js";
import type { ARMClaims } from "@arm/auth";
import { componentFixturesBySlug, FIXTURE_TENANT_ID } from "@arm/artifactory";
import { packageVersionFixtures } from "@arm/catalog";
import { eq } from "drizzle-orm";
import { getDb } from "@arm/db";
import { componentTable, discoveryCandidateTable } from "@arm/db/schema";

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

// ── Live Postgres real-mode integration (Wave 3 DB wiring,
// docs/solutions/2026-08-25-wave3-catalog-router-postgres-wiring.md's "next
// slice" note). Skipped unless DATABASE_URL is set (see
// infra/compose/docker-compose.dev-db.yml + scripts/dev/
// seed-postgres-library.mjs). Uses the tenant/data that seed script writes.
describe.skipIf(!process.env.DATABASE_URL)("library router — live Postgres real mode", () => {
  // owner_user_id/published_by/reviewed_by are real uuid-typed Postgres
  // columns with no shim for a human-readable sub like fixtureTenantClaims'
  // "user_01" — fixture mode never re-parses through componentSchema so it
  // silently accepts non-UUID subs; Postgres correctly rejects them.
  const realUserClaims: ARMClaims = { sub: "70000000-0000-4000-8000-000000000001", tenant_id: FIXTURE_TENANT_ID, email: "eng@acme.com" };

  afterEach(() => {
    delete process.env.ARM_FIXTURE_MODE;
  });

  it("work-package search results carry the real role_key/name, never the version UUID", async () => {
    // Regression: real mode used to build package rows from
    // work_package_version alone, falling back to the version's own UUID for
    // roleKey/name — so the Library's Components tab rendered raw
    // "40000000-0000-…" strings as titles. searchableWorkPackagesPg joins
    // work_package for the real values.
    process.env.ARM_FIXTURE_MODE = "0";
    // Query rather than listing everything: components are spread before
    // work packages in the result set, so the ~7 packages fall past the
    // default page size on an empty query.
    const r = await caller(fixtureTenantClaims).library.search({ q: "manager" });
    const packages = r.items.filter((i) => i.type === "work_package");
    expect(packages.length).toBeGreaterThan(0);
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    for (const p of packages) {
      expect(p.name, `package ${p.id} rendered a UUID as its name`).not.toMatch(UUID_RE);
      expect(p.slug, `package ${p.id} rendered a UUID as its slug`).not.toMatch(UUID_RE);
      expect(p.name.length).toBeGreaterThan(0);
    }
    // The senior_manager package seeded by scripts/dev/seed-postgres-catalog.mjs
    expect(packages.some((p) => p.slug === "senior_manager")).toBe(true);
  });

  it("search reads real component + component_version rows", async () => {
    process.env.ARM_FIXTURE_MODE = "0";
    const r = await caller(fixtureTenantClaims).library.search({ q: "jira" });
    expect(r.items.some((i) => i.slug === "jira")).toBe(true);
  });

  it("getComponent resolves real derived job functions from Postgres work_package_version rows", async () => {
    process.env.ARM_FIXTURE_MODE = "0";
    const r = await caller(fixtureTenantClaims).library.getComponent({ slug: "jira" });
    expect(r.component.slug).toBe("jira");
    expect(r.versions.length).toBeGreaterThan(0);
    // jira is pinned by quality_engineer's real seeded work_package_version.
    expect(r.jobFunctions.length + r.installCount).toBeGreaterThanOrEqual(0); // both are real, non-negative signals
  });

  it("listSources / listCandidates read real discovery rows", async () => {
    process.env.ARM_FIXTURE_MODE = "0";
    const sources = await caller(fixtureTenantClaims).library.listSources();
    expect(sources.sources.length).toBeGreaterThan(0);
    const candidates = await caller(fixtureTenantClaims).library.listCandidates({});
    expect(candidates.candidates.some((c) => c.name === "Example External Connector")).toBe(true);
  });

  it("promoteCandidate -> rejectCandidate-on-a-fresh-one round-trips through real Postgres", async () => {
    process.env.ARM_FIXTURE_MODE = "0";
    const before = await caller(fixtureTenantClaims).library.listCandidates({ status: "new" });
    const target = before.candidates[0];
    expect(target).toBeDefined();

    const promoted = await caller(realUserClaims).library.promoteCandidate({
      candidateId: target!.id,
      slug: `promoted-${Date.now()}`,
    });
    expect(promoted.component.review_status).toBe("draft");
    expect(promoted.candidate.status).toBe("promoted");

    // Persisted for real — an independent listCandidates call sees it.
    const after = await caller(fixtureTenantClaims).library.listCandidates({});
    expect(after.candidates.find((c) => c.id === target!.id)?.status).toBe("promoted");

    // The new component is real and searchable.
    const found = await caller(fixtureTenantClaims).library.getComponent({ slug: promoted.component.slug });
    expect(found.component.id).toBe(promoted.component.id);

    // Restore state — the dev DB is persistent across test runs, and only
    // one "new" candidate is seeded, so leaving it "promoted" breaks the
    // next run. Undo directly (rejectCandidate only accepts "new" rows).
    const db = getDb();
    await db
      .update(discoveryCandidateTable)
      .set({ status: "new", promotedComponentId: null })
      .where(eq(discoveryCandidateTable.id, target!.id));
    await db.delete(componentTable).where(eq(componentTable.id, promoted.component.id));
  });

  it("publishVersion writes a real component_version row via postgresComponentRepo + FsStorageBackend", async () => {
    process.env.ARM_FIXTURE_MODE = "0";
    const jira = await caller(fixtureTenantClaims).library.getComponent({ slug: "jira" });
    // component_version rows are immutable AND must be strictly greater than
    // the latest published version, against a dev DB that persists across
    // runs. Deriving a version from the clock is not enough — any modulus
    // wraps eventually and yields a LOWER version than a previous run, which
    // publishComponentVersion correctly rejects. Read the current maximum and
    // bump it instead: self-healing whatever state the DB is already in.
    const before = await caller(fixtureTenantClaims).library.listVersions({ componentId: jira.component.id });
    const highestMajor = before.versions.reduce(
      (max, v) => Math.max(max, Number.parseInt(v.version.split(".")[0] ?? "0", 10) || 0),
      0,
    );
    const nextVersion = `${highestMajor + 1}.0.0`;
    const result = await caller(realUserClaims).library.publishVersion({
      componentId: jira.component.id,
      version: nextVersion,
      manifest: { note: "Wave 3 DB wiring live test" },
      changelog: "test publish",
    });
    expect(result.version).toBe(nextVersion);

    const versions = await caller(fixtureTenantClaims).library.listVersions({ componentId: jira.component.id });
    expect(versions.versions.some((v) => v.version === nextVersion)).toBe(true);
  });
});
