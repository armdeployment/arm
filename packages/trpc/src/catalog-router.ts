/**
 * Catalog router — D9 Work Packages (docs/solutions/2026-08-13-d9-work-packages.md).
 *
 * Tool Registry + Work Package listing + package assignments. Tool, tool
 * version, and package version fixtures come from @arm/catalog (plain-data
 * fixtures with REAL manifest sha256 hashes — B1) and are parsed through the
 * @arm/proto zod contracts at module load. No live DB — TODO(1.1): replace
 * fixtures with Postgres.
 *
 * `catalog.getPackage` re-verifies manifest integrity server-side: it
 * recomputes `manifestSha256(canonicalManifest(version))` via @arm/catalog
 * and returns `integrity_ok` per version (true = stored hash covers the
 * served content exactly).
 *
 * Assignment state machine (D9 §Consequences):
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
import {
  toolSchema,
  toolVersionSchema,
  workPackageSchema,
  workPackageVersionSchema,
  packageAssignmentSchema,
} from "@arm/proto";
import {
  toolFixtures,
  toolIdFixtures,
  toolVersionFixtures,
  packageVersionFixtures,
  manifestSha256,
  canonicalManifest,
} from "@arm/catalog";

// ── tRPC setup (mirrors src/index.ts; routers must not import runtime values back) ──

const t = initTRPC.context<ARMContext>().create();

const tenantProcedure = t.procedure.use(async (opts) => {
  const { ctx } = opts;
  if (!ctx.claims || !ctx.tenantId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message:
        "No authenticated tenant context. All queries require a tenant_id (Invariant §11.6).",
    });
  }
  return opts.next({ ctx: { ...ctx, tenantId: ctx.tenantId } });
});

// ── Fixtures (parsed at module load — type safety from @arm/proto) ─────────

type Tool = z.infer<typeof toolSchema>;
type ToolVersion = z.infer<typeof toolVersionSchema>;
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

/** @arm/catalog fixtures, re-validated against the proto wire contracts. */
const TOOL_FIXTURES: Tool[] = toolSchema.array().parse(toolFixtures);
const TOOL_VERSION_FIXTURES: ToolVersion[] = toolVersionSchema.array().parse(toolVersionFixtures);
const PACKAGE_VERSION_FIXTURES: WorkPackageVersion[] = workPackageVersionSchema.array().parse(
  packageVersionFixtures,
);

// M5 fixture consistency: every package tool ref must resolve through the
// slug→id map to a registered tool — the same mapping slug-based seeds use
// at provisioning time. A ref outside the map is a fixture bug and fails
// loudly at module load instead of serving an unresolvable pin.
const TOOL_SLUG_BY_ID = new Map<string, string>(
  Object.entries(toolIdFixtures).map(([slug, id]) => [id, slug]),
);
for (const version of PACKAGE_VERSION_FIXTURES) {
  for (const ref of version.tools) {
    if (!TOOL_SLUG_BY_ID.has(ref.tool_id)) {
      throw new Error(
        `catalog fixture bug: package version ${version.id} refs tool ${ref.tool_id}, ` +
          `which has no slug mapping in toolIdFixtures (M5)`,
      );
    }
  }
}

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
  /** List all tools in the Tool Registry with their version pins. */
  listTools: tenantProcedure.query(async (opts) => {
    return {
      tenantId: opts.ctx.tenantId!,
      tools: TOOL_FIXTURES.map((tool) => ({
        id: tool.id,
        name: tool.name,
        kind: tool.kind,
        endpoint: tool.endpoint,
        authStrategy: tool.auth_strategy,
        dataClassification: tool.data_classification,
        reviewStatus: tool.review_status,
        versions: TOOL_VERSION_FIXTURES.filter((v) => v.tool_id === tool.id).map((v) => ({
          id: v.id,
          version: v.version,
          manifestSha256: v.manifest_sha256,
        })),
      })),
    };
  }),

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
          versionCount: versions.length,
          latestVersion: latest?.version ?? null,
          toolCount: latest?.tools.length ?? 0,
          monthlyUsdCap: monthlyUsdCap(latest),
        };
      }),
    };
  }),

  /** Fetch one package with its versions and resolved tool details. */
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
          tools: v.tools.map((ref) => {
            const tool = TOOL_FIXTURES.find((t) => t.id === ref.tool_id);
            const toolVersion = TOOL_VERSION_FIXTURES.find((tv) => tv.tool_id === ref.tool_id && tv.version === ref.tool_version);
            return {
              toolId: ref.tool_id,
              toolVersion: ref.tool_version,
              scopes: ref.scopes,
              name: tool?.name ?? null,
              kind: tool?.kind ?? null,
              dataClassification: tool?.data_classification ?? null,
              manifestSha256: toolVersion?.manifest_sha256 ?? null,
            };
          }),
          skills: v.skills,
          subagentConfigs: v.subagent_configs,
          permissions: v.permissions,
          modelRouting: v.model_routing,
          budgetTemplate: v.budget_template,
          starterPrompts: v.starter_prompts,
          templateRefs: v.template_refs,
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
