/**
 * @arm/catalog plain-data fixtures — pilot Work Package version fixtures for
 * the D10 scaffold (docs/guides/01-library-artifactory.md §4).
 *
 * D10 cutover: the Tool Registry fixtures (`toolFixtures`/`toolIdFixtures`/
 * `toolVersionFixtures`) MOVED to `@arm/artifactory` (`componentFixtures`/
 * `componentVersionFixtures`) — the 40 callable (mcp/http_api/cli/connector)
 * components from the Aug 2026 automotive OEM toolchain survey, plus 38
 * installable (skill/subagent/template) components that are the D10
 * successors of what used to be bare strings on these very seeds
 * (`skills`/`subagentConfigs`/`templateRefs`). This file now imports that
 * registry and resolves seed component refs through it via
 * `buildPackageVersionFromSeed` (`@arm/artifactory`'s `resolve()`, not a
 * slug→id map — guide 01 §4.4).
 *
 * ── Real hashes, not pseudo-hashes ──────────────────────────────────────────
 * `packageVersionFixtures` is BUILT from slug-form seeds through
 * `buildPackageVersionFromSeed(seed, packageId, version, fixtureResolvableVersions, tenantId)`
 * at module load, so every `manifest_sha256` is a REAL sha256 over the
 * canonical manifest v2 JSON.
 *
 * ── Stable ids ───────────────────────────────────────────────────────────
 * The 6 pilot package/version ids below (`30000000…`/`40000000…`) are
 * consumed directly by `packages/trpc/src/catalog-router.ts` (frozen to this
 * module — not owned by `library`), which hardcodes them. Do not renumber.
 */

import { fixtureResolvableVersions } from "@arm/artifactory";
import { buildPackageVersionFromSeed, type PackageVersionInsert } from "./provision.js";
import type { WorkPackageVersion } from "@arm/proto";
import type { WorkPackageSeedInput } from "@arm/db/schema";

const FIXTURE_TENANT_ID = "d9d9d9d9-0000-4000-8000-000000000001";

interface PackageVersionSeedSpec {
  id: string;
  packageId: string;
  seed: WorkPackageSeedInput;
}

const PACKAGE_VERSION_SEEDS: PackageVersionSeedSpec[] = [
  {
    id: "40000000-0000-4000-8000-000000000001",
    packageId: "30000000-0000-4000-8000-000000000001",
    seed: {
      roleKey: "quality_engineer",
      name: "Quality Engineer",
      family: "Quality",
      mode: "copilot",
      description: "8D/PPAP/SPC copilot — defect triage, control plans, and customer submissions from ticketing + MES feeds.",
      approvalRequired: true,
      components: [
        { component: "jira", componentVersion: "1.0.0", kind: "mcp", scopes: ["read:issue", "write:comment", "transition:issue"] },
        { component: "historian-pi", componentVersion: "1.0.0", kind: "connector", scopes: ["read:tags", "read:archive"] },
        { component: "8d-generator", componentVersion: "1.0.0", kind: "skill", scopes: [] },
        { component: "control-plan-editor", componentVersion: "1.0.0", kind: "skill", scopes: [] },
        { component: "ppap-checklist", componentVersion: "1.0.0", kind: "skill", scopes: [] },
        { component: "iatf-clause-library", componentVersion: "1.0.0", kind: "skill", scopes: [] },
        { component: "8d-root-cause-solver", componentVersion: "1.0.0", kind: "subagent", scopes: [] },
        { component: "tpl_8d_report", componentVersion: "1.0.0", kind: "template", scopes: [] },
        { component: "tpl_ppap_submission", componentVersion: "1.0.0", kind: "template", scopes: [] },
        { component: "tpl_control_plan", componentVersion: "1.0.0", kind: "template", scopes: [] },
      ],
      jobFunctions: ["product_quality_engineer_pqe", "spc_metrology_engineer"],
      permissions: ["tool:jira:invoke", "resource:read:mes_defects"],
      modelRouting: { strategy: "frontier_for_reasoning", fallback: "glm-5.2", day_cap_usd: 60 },
      budgetTemplate: { monthly_usd_cap: 950, model_tier: "mixed", overage_action: "throttle" },
      starterPrompts: ["Draft an 8D for defect D-1042", "Generate a PPAP checklist for part 4477-B"],
      minAgentVersion: "1.4.0",
    },
  },
  {
    id: "40000000-0000-4000-8000-000000000002",
    packageId: "30000000-0000-4000-8000-000000000002",
    seed: {
      roleKey: "plc_programmer",
      name: "PLC Programmer",
      family: "Engineering Controls",
      mode: "copilot",
      description: "Ladder/ST codegen with IO-table import, AOI library, and diff/merge tooling for TIA Portal + Studio 5000.",
      approvalRequired: true,
      components: [
        { component: "github", componentVersion: "1.0.0", kind: "mcp", scopes: ["repo:read", "repo:write"] },
        { component: "historian-pi", componentVersion: "1.0.0", kind: "connector", scopes: ["read:tags"] },
        { component: "ladder-codegen", componentVersion: "1.0.0", kind: "skill", scopes: [] },
        { component: "st-codegen", componentVersion: "1.0.0", kind: "skill", scopes: [] },
        { component: "aoi-library", componentVersion: "1.0.0", kind: "skill", scopes: [] },
        { component: "io-table-import", componentVersion: "1.0.0", kind: "skill", scopes: [] },
        { component: "diff-merge-reviewer", componentVersion: "1.0.0", kind: "subagent", scopes: [] },
        { component: "tpl_ladder_patterns", componentVersion: "1.0.0", kind: "template", scopes: [] },
        { component: "tpl_alarm_templates", componentVersion: "1.0.0", kind: "template", scopes: [] },
      ],
      jobFunctions: ["controls_engineer_plc_programmer"],
      permissions: ["tool:github:invoke"],
      modelRouting: { strategy: "frontier_for_codegen", fallback: "deepseek-v3", loop_cap: 24 },
      budgetTemplate: { monthly_usd_cap: 700, model_tier: "mixed", loop_cap: 24 },
      starterPrompts: ["Generate ladder logic for a 3-motor sequence", "Diff my AOI against the library baseline"],
      minAgentVersion: "1.4.0",
    },
  },
  {
    id: "40000000-0000-4000-8000-000000000003",
    packageId: "30000000-0000-4000-8000-000000000003",
    seed: {
      roleKey: "maintenance_technician",
      name: "Maintenance Technician",
      family: "Maintenance",
      mode: "copilot",
      description: "Fault → fix → CMMS loop: fault-code lookup, spares catalog, SOP checklists — mobile-first.",
      approvalRequired: true,
      components: [
        { component: "cmms", componentVersion: "1.0.0", kind: "connector", scopes: ["workorder:read", "workorder:update", "asset:read"] },
        { component: "historian-pi", componentVersion: "1.0.0", kind: "connector", scopes: ["read:tags"] },
        { component: "fault-fix-playbooks", componentVersion: "1.0.0", kind: "skill", scopes: [] },
        { component: "sop-checklists", componentVersion: "1.0.0", kind: "skill", scopes: [] },
        { component: "escalation-trees", componentVersion: "1.0.0", kind: "skill", scopes: [] },
        { component: "fault-triage-agent", componentVersion: "1.0.0", kind: "subagent", scopes: [] },
        { component: "tpl_sop_checklist", componentVersion: "1.0.0", kind: "template", scopes: [] },
        { component: "tpl_fault_report", componentVersion: "1.0.0", kind: "template", scopes: [] },
      ],
      jobFunctions: ["maintenance_technician_mech_elec"],
      permissions: ["tool:cmms:invoke"],
      modelRouting: { strategy: "cheap_first", fallback: "glm-5.2" },
      budgetTemplate: { monthly_usd_cap: 420, model_tier: "cheap", mobile_first: true },
      starterPrompts: ["Fault FC-1042 on Line A — walk me through the fix", "Write the closing notes for WO-8821"],
      minAgentVersion: "1.4.0",
    },
  },
  {
    id: "40000000-0000-4000-8000-000000000004",
    packageId: "30000000-0000-4000-8000-000000000004",
    seed: {
      roleKey: "office_worker_general",
      name: "Office Worker (General)",
      family: "General Office",
      mode: "copilot",
      description: "The volume default: chat, docs, SharePoint, email triage, meeting notes → actions.",
      approvalRequired: true,
      components: [
        { component: "jira", componentVersion: "1.0.0", kind: "mcp", scopes: ["read:issue", "write:comment"] },
        { component: "meeting-notes-actions", componentVersion: "1.0.0", kind: "skill", scopes: [] },
        { component: "doc-summarization", componentVersion: "1.0.0", kind: "skill", scopes: [] },
        { component: "mail-triage", componentVersion: "1.0.0", kind: "skill", scopes: [] },
        { component: "tpl_meeting_notes", componentVersion: "1.0.0", kind: "template", scopes: [] },
        { component: "tpl_mail_reply", componentVersion: "1.0.0", kind: "template", scopes: [] },
      ],
      jobFunctions: ["general_office_staff"],
      permissions: ["tool:jira:invoke"],
      modelRouting: { strategy: "cheapest_viable" },
      budgetTemplate: { monthly_usd_cap: 300, model_tier: "cheap", per_seat: true },
      starterPrompts: ["Summarize this thread and list action items", "Turn these meeting notes into Jira tasks"],
      minAgentVersion: "1.4.0",
    },
  },
  {
    id: "40000000-0000-4000-8000-000000000005",
    packageId: "30000000-0000-4000-8000-000000000005",
    seed: {
      roleKey: "exec_assistant",
      name: "Executive Assistant",
      family: "Executive",
      mode: "copilot",
      description: "KPI briefings, exec digests, approvals-inbox summaries — aggregates-only guardrail enforced.",
      approvalRequired: true,
      components: [
        { component: "jira", componentVersion: "1.0.0", kind: "mcp", scopes: ["read:issue"] },
        { component: "historian-pi", componentVersion: "1.0.0", kind: "connector", scopes: ["read:tags"] },
        { component: "kpi-briefing-generator", componentVersion: "1.0.0", kind: "skill", scopes: [] },
        { component: "exec-digest", componentVersion: "1.0.0", kind: "skill", scopes: [] },
        { component: "approval-summaries", componentVersion: "1.0.0", kind: "skill", scopes: [] },
        { component: "kpi-analyst", componentVersion: "1.0.0", kind: "subagent", scopes: [] },
        { component: "tpl_kpi_brief", componentVersion: "1.0.0", kind: "template", scopes: [] },
        { component: "tpl_exec_digest", componentVersion: "1.0.0", kind: "template", scopes: [] },
      ],
      jobFunctions: ["executive_assistant"],
      permissions: ["tool:jira:invoke"],
      modelRouting: { strategy: "frontier_for_briefings", aggregates_only: true },
      budgetTemplate: { monthly_usd_cap: 400, model_tier: "mixed", aggregates_only: true },
      starterPrompts: ["Brief me on yesterday's OEE across plants", "Summarize the approvals inbox"],
      minAgentVersion: "1.4.0",
    },
  },
  {
    id: "40000000-0000-4000-8000-000000000006",
    packageId: "30000000-0000-4000-8000-000000000006",
    seed: {
      roleKey: "material_planner",
      name: "Material Planner",
      family: "Supply Chain",
      mode: "automated",
      description: "MRP exception triage, ECN impact alerts, EOL calculators — unattended batch runs.",
      approvalRequired: true,
      components: [
        { component: "cmms", componentVersion: "1.0.0", kind: "connector", scopes: ["inventory:read", "workorder:read"] },
        { component: "historian-pi", componentVersion: "1.0.0", kind: "connector", scopes: ["read:tags"] },
        { component: "mrp-exception-triage", componentVersion: "1.0.0", kind: "skill", scopes: [] },
        { component: "ecn-impact-alerts", componentVersion: "1.0.0", kind: "skill", scopes: [] },
        { component: "eol-calculators", componentVersion: "1.0.0", kind: "skill", scopes: [] },
        { component: "exception-triage-batch", componentVersion: "1.0.0", kind: "subagent", scopes: [] },
        { component: "tpl_exception_card", componentVersion: "1.0.0", kind: "template", scopes: [] },
        { component: "tpl_ecn_impact", componentVersion: "1.0.0", kind: "template", scopes: [] },
      ],
      jobFunctions: ["material_planner_mrp"],
      permissions: ["tool:cmms:invoke"],
      modelRouting: { strategy: "small_model_batch", batch_window: "nightly" },
      budgetTemplate: { monthly_usd_cap: 600, model_tier: "cheap", high_volume: true },
      starterPrompts: ["Triage today's MRP exceptions", "Which ECNs touch part 4477-B?"],
      minAgentVersion: "1.4.0",
    },
  },
];

function insertToWireVersion(insert: PackageVersionInsert, id: string): WorkPackageVersion {
  return {
    id,
    package_id: insert.packageId,
    version: insert.version,
    manifest_version: insert.manifestVersion,
    components: insert.components.map((ref) => ({
      component_id: ref.componentId,
      version: ref.version,
      kind: ref.kind as WorkPackageVersion["components"][number]["kind"],
      scopes: ref.scopes,
    })),
    permissions: insert.permissions,
    model_routing: insert.modelRouting,
    budget_template: insert.budgetTemplate,
    starter_prompts: insert.starterPrompts,
    min_agent_version: insert.minAgentVersion,
    job_functions: insert.jobFunctions,
    manifest_sha256: insert.manifestSha256,
  };
}

/**
 * Package version fixtures — wire-shaped (workPackageVersionSchema, manifest
 * v2), each `manifest_sha256` computed over the canonical snake_case
 * manifest of the INSERT-READY (component-resolved, sorted) refs.
 * Provisioning fails loud if a seed slug@version has no match in
 * `fixtureResolvableVersions` (`@arm/artifactory`).
 */
export const packageVersionFixtures: WorkPackageVersion[] = PACKAGE_VERSION_SEEDS.map((spec) =>
  insertToWireVersion(
    buildPackageVersionFromSeed(spec.seed, spec.packageId, "1.0.0", fixtureResolvableVersions, FIXTURE_TENANT_ID),
    spec.id,
  ),
);
