#!/usr/bin/env node
/**
 * Seed the live Postgres work_package / work_package_version /
 * package_assignment tables with the SAME data catalog-router.ts's fixture
 * mode uses (Wave 3 DB wiring, see docs/solutions/2026-08-24-
 * wave3-adoption-router-db-wiring.md's "next slice" note). IDs are copied
 * verbatim from packages/trpc/src/catalog-router.ts's PACKAGE_FIXTURES /
 * ASSIGNMENT_FIXTURES and @arm/catalog's real (migrated)
 * packageVersionFixtures, so fixture mode and Postgres real mode agree for
 * the same tenant.
 *
 * Usage: DATABASE_URL=postgres://arm:arm_dev_password@localhost:5432/arm \
 *          node scripts/dev/seed-postgres-catalog.mjs
 */
import { getDb, closeDb } from "../../packages/db/dist/index.js";
import { tenantTable, workPackageTable, workPackageVersionTable, packageAssignmentTable } from "../../packages/db/dist/schema/index.js";
import { packageVersionFixtures } from "../../packages/catalog/dist/index.js";

const TENANT_ID = "d9d9d9d9-0000-4000-8000-000000000001";
const FIXTURE_APPROVER_ID = "60000000-0000-4000-8000-000000000003";

const PACKAGE_ROWS = [
  { id: "30000000-0000-4000-8000-000000000001", roleKey: "quality_engineer", name: "Quality Engineer", family: "Quality", mode: "copilot", description: "8D/PPAP/SPC copilot — defect triage, control plans, and customer submissions from ticketing + MES feeds." },
  { id: "30000000-0000-4000-8000-000000000002", roleKey: "plc_programmer", name: "PLC Programmer", family: "Engineering Controls", mode: "copilot", description: "Ladder/ST codegen with IO-table import, AOI library, and diff/merge tooling for TIA Portal + Studio 5000." },
  { id: "30000000-0000-4000-8000-000000000003", roleKey: "maintenance_technician", name: "Maintenance Technician", family: "Maintenance", mode: "copilot", description: "Fault → fix → CMMS loop: fault-code lookup, spares catalog, SOP checklists — mobile-first." },
  { id: "30000000-0000-4000-8000-000000000004", roleKey: "office_worker_general", name: "Office Worker (General)", family: "General Office", mode: "copilot", description: "The volume default: chat, docs, SharePoint, email triage, meeting notes → actions." },
  { id: "30000000-0000-4000-8000-000000000005", roleKey: "exec_assistant", name: "Executive Assistant", family: "Executive", mode: "copilot", description: "KPI briefings, exec digests, approvals-inbox summaries — aggregates-only guardrail enforced." },
  { id: "30000000-0000-4000-8000-000000000006", roleKey: "material_planner", name: "Material Planner", family: "Supply Chain", mode: "automated", description: "MRP exception triage, ECN impact alerts, EOL calculators — unattended batch runs." },
];

const ASSIGNMENT_ROWS = [
  { id: "50000000-0000-4000-8000-000000000001", packageVersionId: "40000000-0000-4000-8000-000000000004", assigneeType: "user", assigneeId: "70000000-0000-4000-8000-000000000001", status: "requested", approverUserId: null, approvedAt: null },
  { id: "50000000-0000-4000-8000-000000000002", packageVersionId: "40000000-0000-4000-8000-000000000001", assigneeType: "user", assigneeId: "70000000-0000-4000-8000-000000000002", status: "approved", approverUserId: FIXTURE_APPROVER_ID, approvedAt: "2026-08-11T14:05:00Z" },
  { id: "50000000-0000-4000-8000-000000000003", packageVersionId: "40000000-0000-4000-8000-000000000002", assigneeType: "org_node", assigneeId: "90000000-0000-4000-8000-000000000001", status: "active", approverUserId: FIXTURE_APPROVER_ID, approvedAt: "2026-08-02T09:00:00Z" },
  { id: "50000000-0000-4000-8000-000000000004", packageVersionId: "40000000-0000-4000-8000-000000000006", assigneeType: "agent", assigneeId: "80000000-0000-4000-8000-000000000001", status: "revoked", approverUserId: FIXTURE_APPROVER_ID, approvedAt: "2026-07-28T16:20:00Z" },
];

const db = getDb();

console.log("Seeding tenant...");
await db.insert(tenantTable).values({
  id: TENANT_ID,
  name: "Acme Manufacturing",
  tier: "pilot",
  deployment: "saas",
  industryProfile: "manufacturing",
}).onConflictDoNothing();

console.log(`Seeding ${PACKAGE_ROWS.length} work packages...`);
for (const p of PACKAGE_ROWS) {
  await db.insert(workPackageTable).values({
    id: p.id,
    tenantId: TENANT_ID,
    roleKey: p.roleKey,
    name: p.name,
    family: p.family,
    mode: p.mode,
    description: p.description,
    approvalRequired: true,
  }).onConflictDoNothing();
}

console.log(`Seeding ${packageVersionFixtures.length} work package versions (real, from @arm/catalog)...`);
for (const v of packageVersionFixtures) {
  await db.insert(workPackageVersionTable).values({
    id: v.id,
    tenantId: TENANT_ID,
    packageId: v.package_id,
    version: v.version,
    manifestVersion: v.manifest_version,
    components: v.components.map((c) => ({ componentId: c.component_id, version: c.version, kind: c.kind, scopes: c.scopes })),
    jobFunctions: v.job_functions,
    permissions: v.permissions,
    modelRouting: v.model_routing,
    budgetTemplate: v.budget_template,
    starterPrompts: v.starter_prompts,
    minAgentVersion: v.min_agent_version,
    manifestSha256: v.manifest_sha256,
  }).onConflictDoNothing();
}

console.log(`Seeding ${ASSIGNMENT_ROWS.length} package assignments...`);
for (const a of ASSIGNMENT_ROWS) {
  await db.insert(packageAssignmentTable).values({
    id: a.id,
    tenantId: TENANT_ID,
    packageVersionId: a.packageVersionId,
    assigneeType: a.assigneeType,
    assigneeId: a.assigneeId,
    status: a.status,
    approverUserId: a.approverUserId,
    approvedAt: a.approvedAt ? new Date(a.approvedAt) : null,
  }).onConflictDoNothing();
}

await closeDb();
console.log("Seed complete.");
