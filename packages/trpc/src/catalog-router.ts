/**
 * Catalog router — D9 Work Packages, updated D10 (docs/solutions/
 * 2026-08-13-d9-work-packages.md, docs/guides/00-shared-contracts.md).
 *
 * Work Package listing + package assignments. Package version fixtures come
 * from @arm/catalog (plain-data fixtures) and are parsed through the
 * @arm/proto zod contracts at module load. No live DB — TODO(1.1): replace
 * fixtures with Postgres.
 *
 * D10 MECHANICAL UPDATE (contracts, Wave 0 — NOT a reimplementation): `tool`
 * generalizes to `component` (A3) and the Tool Registry moves out of this
 * router. `listTools` is REMOVED — its D10 successor is `library.search` /
 * `library.getComponent` (packages/trpc/src/library-router.ts, filled by the
 * `library` Wave-1 agent against packages/artifactory). `getPackage` and
 * `listPackages` are updated to the new `work_package_version` shape
 * (`components`/`job_functions` replace `tools`/`skills`/`subagent_configs`/
 * `template_refs`) — but @arm/catalog's fixtures themselves are NOT yet
 * migrated to that shape (that migration is `library`'s job too), so
 * `components`/`job_functions` read as empty and `integrity_ok` reads as
 * `false` for every fixture version until then. This is expected, tracked
 * collateral of the contracts-only Wave-0 cutover — not a regression to fix
 * here.
 *
 * `catalog.getPackage` re-verifies manifest integrity server-side: it
 * recomputes `manifestSha256(canonicalManifest(version))` via @arm/catalog
 * and returns `integrity_ok` per version (true = stored hash covers the
 * served content exactly).
 *
 * Assignment state machine (D9 §Consequences, unaffected by the D10 cutover):
 *
 *   requested ── approveAssignment(true) ──▶ approved ── approveAssignment(true) ──▶ active
 *        │                                        │                                         │
 *        └───────── approveAssignment(false) ─────┴───── revokeAssignment ─────────────────┴──▶ revoked
 *
 * The second approval is the provisioning/activation step: a scope-admin
 * approval moves `requested → approved`; the follow-up approval (agent runtime
 * confirmed provisioned) moves `approved → active`. `approve: false` denies at
 * either gate. `revoked` is terminal.
 */

import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import type { ARMContext } from "./index.js";
import { workPackageSchema, workPackageVersionSchema, packageAssignmentSchema } from "@arm/proto";
import { packageVersionFixtures, manifestSha256, canonicalManifest } from "@arm/catalog";
import { isDemoMode, registerDemoArray, snapshotAllDemoStores, restoreAllDemoStores } from "./demo-mode.js";

// ── tRPC setup (mirrors src/index.ts; routers must not import runtime values back) ──

const t = initTRPC.context<ARMContext>().create();

const tenantProcedure = t.procedure
  .use(async (opts) => {
    const { ctx } = opts;
    if (!ctx.claims || !ctx.tenantId) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message:
          "No authenticated tenant context. All queries require a tenant_id (Invariant §11.6).",
      });
    }
    return opts.next({ ctx: { ...ctx, tenantId: ctx.tenantId } });
  })
  .use(async (opts) => {
    if (!isDemoMode() || opts.type !== "mutation") return opts.next();
    const snapshot = snapshotAllDemoStores();
    try {
      return await opts.next();
    } finally {
      restoreAllDemoStores(snapshot);
    }
  });

// ── Fixtures (parsed at module load — type safety from @arm/proto) ─────────

type WorkPackage = z.infer<typeof workPackageSchema>;
type WorkPackageVersion = z.infer<typeof workPackageVersionSchema>;
type PackageAssignment = z.infer<typeof packageAssignmentSchema>;

const TENANT_ID = "d9d9d9d9-0000-4000-8000-000000000001";
const FIXTURE_OWNER_ID = "60000000-0000-4000-8000-000000000001";
const FIXTURE_APPROVER_ID = "60000000-0000-4000-8000-000000000003";

/** Local-time ISO string (no offset) — matches datetime({ local: true }). */
function localNow(): string {
  return new Date().toISOString().slice(0, 19);
}

/**
 * @arm/catalog fixtures, re-validated against the proto wire contracts.
 * NOTE (D10 mechanical update): @arm/catalog's fixtures are still shaped
 * for the v1 manifest (tools/skills/subagent_configs/template_refs) — the
 * `library` Wave-1 agent migrates them to `components`/`job_functions`
 * (manifest v2). Until then, unknown v1 fields are silently dropped by zod
 * and `components`/`job_functions` parse to their empty defaults below —
 * expected, not a bug in this router.
 */
const PACKAGE_VERSION_FIXTURES: WorkPackageVersion[] = workPackageVersionSchema.array().parse(
  packageVersionFixtures,
);

const PACKAGE_FIXTURES: WorkPackage[] = workPackageSchema.array().parse([
  {
    id: "30000000-0000-4000-8000-000000000001",
    tenant_id: TENANT_ID,
    role_key: "quality_engineer",
    name: "Quality Engineer",
    family: "Quality",
    mode: "copilot",
    description: "8D/PPAP/SPC copilot — defect triage, control plans, and customer submissions from ticketing + MES feeds.",
  },
  {
    id: "30000000-0000-4000-8000-000000000002",
    tenant_id: TENANT_ID,
    role_key: "plc_programmer",
    name: "PLC Programmer",
    family: "Engineering Controls",
    mode: "copilot",
    description: "Ladder/ST codegen with IO-table import, AOI library, and diff/merge tooling for TIA Portal + Studio 5000.",
  },
  {
    id: "30000000-0000-4000-8000-000000000003",
    tenant_id: TENANT_ID,
    role_key: "maintenance_technician",
    name: "Maintenance Technician",
    family: "Maintenance",
    mode: "copilot",
    description: "Fault → fix → CMMS loop: fault-code lookup, spares catalog, SOP checklists — mobile-first.",
  },
  {
    id: "30000000-0000-4000-8000-000000000004",
    tenant_id: TENANT_ID,
    role_key: "office_worker_general",
    name: "Office Worker (General)",
    family: "General Office",
    mode: "copilot",
    description: "The volume default: chat, docs, SharePoint, email triage, meeting notes → actions.",
  },
  {
    id: "30000000-0000-4000-8000-000000000005",
    tenant_id: TENANT_ID,
    role_key: "exec_assistant",
    name: "Executive Assistant",
    family: "Executive",
    mode: "copilot",
    description: "KPI briefings, exec digests, approvals-inbox summaries — aggregates-only guardrail enforced.",
  },
  {
    id: "30000000-0000-4000-8000-000000000006",
    tenant_id: TENANT_ID,
    role_key: "material_planner",
    name: "Material Planner",
    family: "Supply Chain",
    mode: "automated",
    description: "MRP exception triage, ECN impact alerts, EOL calculators — unattended batch runs.",
  },
]);

const ASSIGNMENT_FIXTURES: PackageAssignment[] = packageAssignmentSchema.array().parse([
  {
    id: "50000000-0000-4000-8000-000000000001",
    tenant_id: TENANT_ID,
    package_version_id: "40000000-0000-4000-8000-000000000004",
    assignee_type: "user",
    assignee_id: "70000000-0000-4000-8000-000000000001",
    status: "requested",
    approver_user_id: null,
    approved_at: null,
  },
  {
    id: "50000000-0000-4000-8000-000000000002",
    tenant_id: TENANT_ID,
    package_version_id: "40000000-0000-4000-8000-000000000001",
    assignee_type: "user",
    assignee_id: "70000000-0000-4000-8000-000000000002",
    status: "approved",
    approver_user_id: FIXTURE_APPROVER_ID,
    approved_at: "2026-08-11T14:05:00",
  },
  {
    id: "50000000-0000-4000-8000-000000000003",
    tenant_id: TENANT_ID,
    package_version_id: "40000000-0000-4000-8000-000000000002",
    assignee_type: "org_node",
    assignee_id: "90000000-0000-4000-8000-000000000001",
    status: "active",
    approver_user_id: FIXTURE_APPROVER_ID,
    approved_at: "2026-08-02T09:00:00",
  },
  {
    id: "50000000-0000-4000-8000-000000000004",
    tenant_id: TENANT_ID,
    package_version_id: "40000000-0000-4000-8000-000000000006",
    assignee_type: "agent",
    assignee_id: "80000000-0000-4000-8000-000000000001",
    status: "revoked",
    approver_user_id: FIXTURE_APPROVER_ID,
    approved_at: "2026-07-28T16:20:00",
  },
]);

// Mutable store — mutations update this in memory (no DB in 1.0 scaffold).
const assignmentStore: PackageAssignment[] = [...ASSIGNMENT_FIXTURES];
registerDemoArray(assignmentStore);

// ── Helpers ────────────────────────────────────────────────────────────────

function packageForVersion(versionId: string): { version: WorkPackageVersion; package: WorkPackage } | null {
  const version = PACKAGE_VERSION_FIXTURES.find((v) => v.id === versionId);
  if (!version) return null;
  const pkg = PACKAGE_FIXTURES.find((p) => p.id === version.package_id);
  if (!pkg) return null;
  return { version, package: pkg };
}

function toAssignmentView(a: PackageAssignment) {
  const ref = packageForVersion(a.package_version_id);
  return {
    id: a.id,
    packageVersionId: a.package_version_id,
    assigneeType: a.assignee_type,
    assigneeId: a.assignee_id,
    status: a.status,
    approverUserId: a.approver_user_id,
    approvedAt: a.approved_at,
    packageId: ref?.package.id ?? null,
    roleKey: ref?.package.role_key ?? null,
    packageName: ref?.package.name ?? null,
    mode: ref?.package.mode ?? null,
  };
}

function monthlyUsdCap(version: WorkPackageVersion | undefined): number | null {
  const cap = version?.budget_template.monthly_usd_cap;
  return typeof cap === "number" ? cap : null;
}

/** Server-side manifest integrity check (B1): hash of the canonical snake_case
 *  manifest of the SERVED version vs the stored `manifest_sha256`. */
function verifyManifestIntegrity(version: WorkPackageVersion): boolean {
  return manifestSha256(canonicalManifest(version)) === version.manifest_sha256;
}

function notFound(message: string): never {
  throw new TRPCError({ code: "NOT_FOUND", message });
}

function precondition(message: string): never {
  throw new TRPCError({ code: "PRECONDITION_FAILED", message });
}

// ── Router ─────────────────────────────────────────────────────────────────

export const catalogRouter = t.router({
  // NOTE (D10): Tool Registry browsing (`listTools`) moved to the Component
  // Registry — see `library.search` / `library.getComponent`
  // (packages/trpc/src/library-router.ts, filled in by the `library`
  // Wave-1 agent). No replacement lives in this router.

  /** List all work packages with their latest published version. */
  listPackages: tenantProcedure.query(async (opts) => {
    return {
      tenantId: opts.ctx.tenantId!,
      packages: PACKAGE_FIXTURES.map((pkg) => {
        const versions = PACKAGE_VERSION_FIXTURES.filter((v) => v.package_id === pkg.id);
        const latest = versions[versions.length - 1];
        return {
          id: pkg.id,
          roleKey: pkg.role_key,
          name: pkg.name,
          family: pkg.family,
          mode: pkg.mode,
          description: pkg.description,
          approvalRequired: pkg.approval_required,
          versionCount: versions.length,
          latestVersion: latest?.version ?? null,
          componentCount: latest?.components.length ?? 0,
          monthlyUsdCap: monthlyUsdCap(latest),
        };
      }),
    };
  }),

  /** Fetch one package with its versions and pinned component refs. */
  getPackage: tenantProcedure
    .input(z.object({ packageId: z.string().uuid() }))
    .query(async (opts) => {
      const pkg = PACKAGE_FIXTURES.find((p) => p.id === opts.input.packageId);
      if (!pkg) notFound(`Package ${opts.input.packageId} not found`);
      const versions = PACKAGE_VERSION_FIXTURES.filter((v) => v.package_id === pkg.id);
      return {
        tenantId: opts.ctx.tenantId!,
        package: pkg,
        versions: versions.map((v) => ({
          id: v.id,
          version: v.version,
          manifestVersion: v.manifest_version,
          // NOTE (D10): component refs are NOT resolved against the
          // Component Registry here (that join belongs to `library`'s
          // component-review/artifact-integrity guardrails and
          // library-router.ts once packages/artifactory lands) — this is a
          // plain passthrough of the pinned refs.
          components: v.components,
          jobFunctions: v.job_functions,
          permissions: v.permissions,
          modelRouting: v.model_routing,
          budgetTemplate: v.budget_template,
          starterPrompts: v.starter_prompts,
          minAgentVersion: v.min_agent_version,
          manifestSha256: v.manifest_sha256,
          integrity_ok: verifyManifestIntegrity(v),
        })),
      };
    }),

  /** List all package assignments across assignee types. */
  listAssignments: tenantProcedure.query(async (opts) => {
    return {
      tenantId: opts.ctx.tenantId!,
      assignments: assignmentStore.map(toAssignmentView),
    };
  }),

  /** Request a package for a user, agent, or org node. Starts in `requested`. */
  requestAssignment: tenantProcedure
    .input(z.object({
      packageVersionId: z.string().uuid(),
      assigneeType: z.enum(["user", "agent", "org_node"]),
      assigneeId: z.string().uuid(),
    }))
    .mutation(async (opts) => {
      const { packageVersionId, assigneeType, assigneeId } = opts.input;
      if (!packageForVersion(packageVersionId)) {
        notFound(`Package version ${packageVersionId} not found`);
      }
      const assignment = packageAssignmentSchema.parse({
        id: randomUUID(),
        tenant_id: TENANT_ID,
        package_version_id: packageVersionId,
        assignee_type: assigneeType,
        assignee_id: assigneeId,
        status: "requested",
        approver_user_id: null,
        approved_at: null,
      });
      assignmentStore.push(assignment);
      return { tenantId: opts.ctx.tenantId!, assignment: toAssignmentView(assignment) };
    }),

  /**
   * Approve (or deny) a package assignment.
   * approve:true  — requested → approved → active (second approval provisions).
   * approve:false — requested/approved → revoked.
   */
  approveAssignment: tenantProcedure
    .input(z.object({ assignmentId: z.string().uuid(), approve: z.boolean() }))
    .mutation(async (opts) => {
      const { assignmentId, approve } = opts.input;
      const idx = assignmentStore.findIndex((a) => a.id === assignmentId);
      if (idx === -1) notFound(`Assignment ${assignmentId} not found`);
      const current = assignmentStore[idx]!;

      let nextStatus: PackageAssignment["status"];
      if (approve) {
        if (current.status === "requested") nextStatus = "approved";
        else if (current.status === "approved") nextStatus = "active";
        else precondition(`Cannot approve assignment in '${current.status}' state (use revokeAssignment for active)`);
      } else {
        if (current.status === "requested" || current.status === "approved") nextStatus = "revoked";
        else precondition(`Cannot deny assignment in '${current.status}' state (use revokeAssignment for active)`);
      }

      const next = packageAssignmentSchema.parse({
        ...current,
        status: nextStatus,
        approver_user_id: approve ? FIXTURE_APPROVER_ID : current.approver_user_id,
        approved_at: approve ? localNow() : current.approved_at,
      });
      assignmentStore[idx] = next;
      return { tenantId: opts.ctx.tenantId!, assignment: toAssignmentView(next) };
    }),

  /** Revoke an approved or active assignment. `revoked` is terminal. */
  revokeAssignment: tenantProcedure
    .input(z.object({ assignmentId: z.string().uuid() }))
    .mutation(async (opts) => {
      const { assignmentId } = opts.input;
      const idx = assignmentStore.findIndex((a) => a.id === assignmentId);
      if (idx === -1) notFound(`Assignment ${assignmentId} not found`);
      const current = assignmentStore[idx]!;
      if (current.status === "requested") {
        precondition("Requested assignment must be decided via approveAssignment first");
      }
      if (current.status === "revoked") {
        precondition("Assignment is already revoked");
      }
      const next = packageAssignmentSchema.parse({ ...current, status: "revoked" });
      assignmentStore[idx] = next;
      return { tenantId: opts.ctx.tenantId!, assignment: toAssignmentView(next) };
    }),
});
