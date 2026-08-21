/**
 * Catalog router tests — D9 Work Packages (docs/solutions/2026-08-13-d9-work-packages.md).
 *
 * Tool/package fixtures now come from @arm/catalog (plain-data fixtures with
 * REAL manifest sha256 hashes — B1), parsed through the @arm/proto contracts
 * by the router. `getPackage` returns `integrity_ok` per version (server-side
 * recompute of the canonical-manifest hash).
 *
 * Covers fixture listing (4 tools / 6 packages / 4 assignments), manifest
 * integrity verification, and the package-assignment state machine end to end:
 *   request → approve → active
 *   request → deny → revoked
 *   active → revoke → revoked
 * plus invalid-transition rejections.
 */

import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { createContext, appRouter } from "../src/index.js";
import type { ARMClaims } from "@arm/auth";
import {
  toolFixtures,
  toolIdFixtures,
  packageVersionFixtures,
  manifestSha256,
  canonicalManifest,
} from "@arm/catalog";

const authedClaims: ARMClaims = { sub: "user_01", tenant_id: "tn_01", email: "eng@acme.com" };
function caller(claims: ARMClaims | null) {
  return appRouter.createCaller(createContext({ claims }));
}

const FIXTURE = {
  qualityVersion: "40000000-0000-4000-8000-000000000001",
  plcVersion: "40000000-0000-4000-8000-000000000002",
  officeVersion: "40000000-0000-4000-8000-000000000004",
  unknownId: "99999999-9999-4999-8999-999999999999",
};

describe("catalog tenant middleware", () => {
  it("REJECTS unauthenticated catalog calls", async () => {
    await expect(caller(null).catalog.listPackages()).rejects.toThrowError(/No authenticated tenant context/);
  });
});

describe("catalog queries (@arm/catalog fixture data)", () => {
  it("lists 40 tools (4 originals + 36 landscape) with version pins", async () => {
    const r = await caller(authedClaims).catalog.listTools();
    expect(r.tools.length).toBe(40);
    const names = r.tools.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(["jira", "github", "cmms", "historian-pi"]));
    const jira = r.tools.find((t) => t.name === "jira")!;
    expect(jira.id).toBe(toolIdFixtures["jira"]);
    expect(jira.kind).toBe("mcp");
    expect(jira.authStrategy).toBe("oauth");
    expect(jira.dataClassification).toBe("internal");
    expect(jira.versions.map((v) => v.version)).toContain("1.0.0");
    // Tool version pins carry REAL sha256 hashes (not pseudo-hashes).
    for (const v of jira.versions) {
      expect(v.manifestSha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("lists 6 pilot packages with the D9 role keys", async () => {
    const r = await caller(authedClaims).catalog.listPackages();
    expect(r.packages.length).toBe(6);
    expect(r.packages.map((p) => p.roleKey)).toEqual(expect.arrayContaining([
      "quality_engineer", "plc_programmer", "maintenance_technician",
      "office_worker_general", "exec_assistant", "material_planner",
    ]));
    const office = r.packages.find((p) => p.roleKey === "office_worker_general")!;
    expect(office.mode).toBe("copilot");
    expect(office.monthlyUsdCap).toBe(300);
    const material = r.packages.find((p) => p.roleKey === "material_planner")!;
    expect(material.mode).toBe("automated");
  });

  it("getPackage resolves tools for quality_engineer", async () => {
    const r = await caller(authedClaims).catalog.getPackage({ packageId: "30000000-0000-4000-8000-000000000001" });
    expect(r.package.role_key).toBe("quality_engineer");
    expect(r.versions.length).toBe(1);
    const v = r.versions[0]!;
    expect(v.tools.length).toBe(2);
    expect(v.tools.map((t) => t.name)).toEqual(expect.arrayContaining(["jira", "historian-pi"]));
    expect(v.budgetTemplate.monthly_usd_cap).toBe(950);
    expect(v.skills).toContain("8d-generator");
  });

  it("getPackage reports integrity_ok true for all versions (real hashes)", async () => {
    for (const spec of packageVersionFixtures) {
      const r = await caller(authedClaims).catalog.getPackage({ packageId: spec.package_id });
      const version = r.versions.find((v) => v.id === spec.id);
      expect(version).toBeDefined();
      expect(version!.integrity_ok).toBe(true);
      // The served version's hash must cover the canonical manifest exactly.
      expect(manifestSha256(canonicalManifest(spec))).toBe(version!.manifestSha256);
    }
  });

  it("getPackage rejects unknown package ids", async () => {
    await expect(
      caller(authedClaims).catalog.getPackage({ packageId: FIXTURE.unknownId }),
    ).rejects.toThrowError(/not found/i);
  });

  it("fixture assignments cover all four statuses", async () => {
    const r = await caller(authedClaims).catalog.listAssignments();
    const fixtureStatuses = new Set(
      r.assignments
        .filter((a) => a.id.startsWith("50000000"))
        .map((a) => a.status),
    );
    expect(fixtureStatuses).toEqual(new Set(["requested", "approved", "active", "revoked"]));
    const active = r.assignments.find((a) => a.id === "50000000-0000-4000-8000-000000000003")!;
    expect(active.assigneeType).toBe("org_node");
    expect(active.roleKey).toBe("plc_programmer");
    expect(active.approverUserId).not.toBeNull();
  });
});

describe("assignment state machine (D9)", () => {
  async function requestPackage(packageVersionId: string, assigneeType: "user" | "agent" | "org_node" = "user") {
    return caller(authedClaims).catalog.requestAssignment({
      packageVersionId,
      assigneeType,
      assigneeId: randomUUID(),
    });
  }

  it("request → approve → active chain", async () => {
    const c = caller(authedClaims);
    const requested = await requestPackage(FIXTURE.officeVersion);
    expect(requested.assignment.status).toBe("requested");
    expect(requested.assignment.approverUserId).toBeNull();
    expect(requested.assignment.approvedAt).toBeNull();

    const approved = await c.catalog.approveAssignment({ assignmentId: requested.assignment.id, approve: true });
    expect(approved.assignment.status).toBe("approved");
    expect(approved.assignment.approverUserId).not.toBeNull();
    expect(approved.assignment.approvedAt).not.toBeNull();

    // Second approval = provisioning confirmation → active
    const active = await c.catalog.approveAssignment({ assignmentId: requested.assignment.id, approve: true });
    expect(active.assignment.status).toBe("active");

    const listed = (await c.catalog.listAssignments()).assignments.find((a) => a.id === requested.assignment.id);
    expect(listed?.status).toBe("active");
  });

  it("deny path: request → revoked", async () => {
    const c = caller(authedClaims);
    const requested = await requestPackage(FIXTURE.plcVersion, "org_node");
    const denied = await c.catalog.approveAssignment({ assignmentId: requested.assignment.id, approve: false });
    expect(denied.assignment.status).toBe("revoked");
  });

  it("revoke path: active → revoked", async () => {
    const c = caller(authedClaims);
    const requested = await requestPackage(FIXTURE.qualityVersion);
    await c.catalog.approveAssignment({ assignmentId: requested.assignment.id, approve: true });
    await c.catalog.approveAssignment({ assignmentId: requested.assignment.id, approve: true });
    const revoked = await c.catalog.revokeAssignment({ assignmentId: requested.assignment.id });
    expect(revoked.assignment.status).toBe("revoked");
  });

  it("rejects invalid transitions", async () => {
    const c = caller(authedClaims);
    const requested = await requestPackage(FIXTURE.officeVersion, "agent");
    const id = requested.assignment.id;

    // requested cannot be revoked directly — must be decided first
    await expect(c.catalog.revokeAssignment({ assignmentId: id })).rejects.toThrow();

    await c.catalog.approveAssignment({ assignmentId: id, approve: true });
    await c.catalog.approveAssignment({ assignmentId: id, approve: true });

    // active cannot be approved again
    await expect(c.catalog.approveAssignment({ assignmentId: id, approve: true })).rejects.toThrow();
    // active cannot be denied — use revoke
    await expect(c.catalog.approveAssignment({ assignmentId: id, approve: false })).rejects.toThrow();

    await c.catalog.revokeAssignment({ assignmentId: id });
    // revoked is terminal
    await expect(c.catalog.revokeAssignment({ assignmentId: id })).rejects.toThrow();
  });

  it("rejects unknown ids", async () => {
    await expect(
      caller(authedClaims).catalog.requestAssignment({
        packageVersionId: FIXTURE.unknownId,
        assigneeType: "user",
        assigneeId: randomUUID(),
      }),
    ).rejects.toThrowError(/not found/i);
    await expect(
      caller(authedClaims).catalog.approveAssignment({ assignmentId: FIXTURE.unknownId, approve: true }),
    ).rejects.toThrowError(/not found/i);
    await expect(
      caller(authedClaims).catalog.revokeAssignment({ assignmentId: FIXTURE.unknownId }),
    ).rejects.toThrowError(/not found/i);
  });
});
