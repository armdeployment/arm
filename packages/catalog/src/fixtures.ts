/**
 * @arm/catalog plain-data fixtures — Tool Registry + package-version fixtures
 * for the 1.0 scaffold (D9, docs/solutions/2026-08-13-d9-work-packages.md).
 *
 * Shared by the tRPC catalog router (and any future dashboard/test surface).
 * Everything here is plain JSON-serializable data.
 *
 * ── Wire shape (B1) ─────────────────────────────────────────────────────────
 * The wire/canonical form is snake_case everywhere (the proto schemas are
 * snake_case), so the exported fixtures are wire-shaped objects parseable by
 * the @arm/proto catalog schemas verbatim (`toolSchema`,
 * `toolVersionSchema`, `workPackageVersionSchema`).
 *
 * ── Real hashes, not pseudo-hashes (B1) ─────────────────────────────────────
 * `packageVersionFixtures` is BUILT from slug-form seeds through
 * `buildPackageVersionFromSeed(seed, packageId, version, toolIdFixtures)` at
 * module load, so every `manifest_sha256` is a REAL sha256 over the canonical
 * snake_case manifest — the same value a client recomputes for integrity
 * verification. `toolVersionFixtures` manifests are real sha256 digests over
 * the canonical { config_schema, changelog } object of each tool version.
 *
 * ── D9 automotive landscape (Aug 2026) ─────────────────────────────────────
 * The OEM tool-landscape survey seeded 36 engineering tools (slugs namespaced
 * by domain: cad.*, ee.*, plm.*, sim.*, mdl.*, test.*, cal.*, autosar.*,
 * rm.*, docs.*, pm.*, vcs.*, spc.*, qms.*, mfg.*, dt.*, rt.*) so role
 * packages can reference the real OEM toolchain. `kind: "cli"` tools are
 * desktop engineering apps invoked as LOCAL PROCESSES on the operator
 * workstation (auth_strategy "none" even when classified confidential) —
 * the tool-endpoint-scope guardrail documents this exception. Tool-version
 * hashes are PER-MANIFEST digests: sha256 over the canonical
 * { config_schema, changelog } object of that version, recomputable
 * client-side for integrity verification (not a placeholder).
 */

import { manifestSha256 } from "./hash.js";
import { buildPackageVersionFromSeed, type PackageVersionInsert } from "./provision.js";
import type { Tool, ToolVersion, WorkPackageVersion } from "./types.js";
import type { WorkPackageSeedInput } from "@arm/db/schema";

/**
 * D9 automotive tool-landscape seeds (Aug 2026 OEM survey) — slug-form
 * sources for the registry rows and version manifests below.
 *
 * The slug is the domain-namespaced `tool.name`; `id` is a deterministic
 * fixture uuid (a0000000…NN — index-stable: DO NOT renumber or reorder once
 * shipped). Tool-version ids share the same NN tail with a b0000000… prefix.
 */
interface LandscapeToolSeed {
  slug: string;
  id: string;
  kind: Tool["kind"];
  endpoint: string;
  auth_strategy: Tool["auth_strategy"];
  data_classification: Tool["data_classification"];
  config_schema: Record<string, string>;
  changelog: string;
}

/** Deterministic tool-version uuid for a landscape seed (b0000000… + NN tail). */
function landscapeVersionId(seed: LandscapeToolSeed): string {
  return seed.id.replace("a0000000-0000-4000-8000-", "b0000000-0000-4000-8000-");
}

const LANDSCAPE_TOOL_SEEDS: LandscapeToolSeed[] = [
  // ── CAD ────────────────────────────────────────────────────────────────
  // 01 — NX (Siemens)
  {
    slug: "cad.nx",
    id: "a0000000-0000-4000-8000-000000000001",
    kind: "cli",
    endpoint: "cli://nx.open-api",
    auth_strategy: "none",
    data_classification: "confidential",
    config_schema: { install_root: "string", version: "string" },
    changelog: "Initial registry snapshot: NX CAD session automation scopes.",
  },
  // 02 — CATIA (Dassault)
  {
    slug: "cad.catia",
    id: "a0000000-0000-4000-8000-000000000002",
    kind: "cli",
    endpoint: "cli://catia.caa",
    auth_strategy: "none",
    data_classification: "confidential",
    config_schema: { install_root: "string", environ_path: "string" },
    changelog: "Initial registry snapshot: CATIA CAA session automation scopes.",
  },
  // 03 — Alias (Autodesk)
  {
    slug: "cad.alias",
    id: "a0000000-0000-4000-8000-000000000003",
    kind: "cli",
    endpoint: "cli://alias.autodesk",
    auth_strategy: "none",
    data_classification: "confidential",
    config_schema: { install_root: "string", project_dir: "string" },
    changelog: "Initial registry snapshot: Alias surface/design scopes.",
  },
  // ── Electrical / E-E architecture ──────────────────────────────────────
  // 04 — Capital (Siemens)
  {
    slug: "ee.capital",
    id: "a0000000-0000-4000-8000-000000000004",
    kind: "cli",
    endpoint: "cli://capital.harness",
    auth_strategy: "none",
    data_classification: "confidential",
    config_schema: { project_dir: "string", library_dir: "string" },
    changelog: "Initial registry snapshot: Capital harness design scopes.",
  },
  // 05 — E3.series (Zuken)
  {
    slug: "ee.e3-series",
    id: "a0000000-0000-4000-8000-000000000005",
    kind: "cli",
    endpoint: "cli://e3.zuken",
    auth_strategy: "none",
    data_classification: "confidential",
    config_schema: { install_root: "string", project_dir: "string" },
    changelog: "Initial registry snapshot: E3.series schematic/cabling scopes.",
  },
  // 06 — PREEvision (Vector)
  {
    slug: "ee.preevision",
    id: "a0000000-0000-4000-8000-000000000006",
    kind: "cli",
    endpoint: "cli://preevision.vector",
    auth_strategy: "none",
    data_classification: "confidential",
    config_schema: { workspace: "string", model_file: "string" },
    changelog: "Initial registry snapshot: PREEvision E/E model scopes.",
  },
  // ── PLM ────────────────────────────────────────────────────────────────
  // 07 — Teamcenter (Siemens)
  {
    slug: "plm.teamcenter",
    id: "a0000000-0000-4000-8000-000000000007",
    kind: "http_api",
    endpoint: "internal://teamcenter.aw:8443",
    auth_strategy: "pat",
    data_classification: "confidential",
    config_schema: { base_url: "string", site: "string" },
    changelog: "Initial registry snapshot: Teamcenter BOM/CAD metadata scopes.",
  },
  // 08 — Windchill (PTC)
  {
    slug: "plm.windchill",
    id: "a0000000-0000-4000-8000-000000000008",
    kind: "http_api",
    endpoint: "internal://windchill.ptc:9443",
    auth_strategy: "pat",
    data_classification: "confidential",
    config_schema: { base_url: "string", wt_context: "string" },
    changelog: "Initial registry snapshot: Windchill part/BOM scopes.",
  },
  // ── Simulation / CAE ───────────────────────────────────────────────────
  // 09 — ANSA/META (BETA CAE)
  {
    slug: "sim.ansa",
    id: "a0000000-0000-4000-8000-000000000009",
    kind: "cli",
    endpoint: "cli://ansa.beta-cae",
    auth_strategy: "none",
    data_classification: "confidential",
    config_schema: { install_root: "string", run_dir: "string" },
    changelog: "Initial registry snapshot: ANSA/META meshing scopes.",
  },
  // 10 — GT-SUITE (Gamma Technologies)
  {
    slug: "sim.gt-suite",
    id: "a0000000-0000-4000-8000-000000000010",
    kind: "cli",
    endpoint: "cli://gt-suite.gtisoft",
    auth_strategy: "none",
    data_classification: "confidential",
    config_schema: { install_root: "string", model_dir: "string" },
    changelog: "Initial registry snapshot: GT-SUITE 1D simulation scopes.",
  },
  // 11 — Simcenter STAR-CCM+ (Siemens)
  {
    slug: "sim.star-ccm",
    id: "a0000000-0000-4000-8000-000000000011",
    kind: "cli",
    endpoint: "cli://star-ccm.siemens",
    auth_strategy: "none",
    data_classification: "confidential",
    config_schema: { install_root: "string", case_dir: "string" },
    changelog: "Initial registry snapshot: STAR-CCM+ CFD scopes.",
  },
  // 12 — LS-DYNA (Ansys/Synopsys)
  {
    slug: "sim.ls-dyna",
    id: "a0000000-0000-4000-8000-000000000012",
    kind: "cli",
    endpoint: "cli://ls-dyna.ansys",
    auth_strategy: "none",
    data_classification: "confidential",
    config_schema: { install_root: "string", solver: "string" },
    changelog: "Initial registry snapshot: LS-DYNA crash/solver scopes.",
  },
  // 13 — Abaqus (Dassault)
  {
    slug: "sim.abaqus",
    id: "a0000000-0000-4000-8000-000000000013",
    kind: "cli",
    endpoint: "cli://abaqus.3ds",
    auth_strategy: "none",
    data_classification: "confidential",
    config_schema: { install_root: "string", odb_dir: "string" },
    changelog: "Initial registry snapshot: Abaqus FEA scopes.",
  },
  // ── Model-based design ─────────────────────────────────────────────────
  // 14 — MATLAB/Simulink (MathWorks)
  {
    slug: "mdl.matlab-simulink",
    id: "a0000000-0000-4000-8000-000000000014",
    kind: "cli",
    endpoint: "cli://matlab.mathworks",
    auth_strategy: "none",
    data_classification: "confidential",
    config_schema: { matlab_root: "string", project_dir: "string" },
    changelog: "Initial registry snapshot: MATLAB/Simulink model scopes.",
  },
  // ── Test / HIL ─────────────────────────────────────────────────────────
  // 15 — CANoe (Vector)
  {
    slug: "test.canoe",
    id: "a0000000-0000-4000-8000-000000000015",
    kind: "cli",
    endpoint: "cli://canoe.vector",
    auth_strategy: "none",
    data_classification: "confidential",
    config_schema: { install_root: "string", config_dir: "string" },
    changelog: "Initial registry snapshot: CANoe test-environment scopes.",
  },
  // 16 — dSPACE SCALEXIO/ControlDesk
  {
    slug: "test.dspace",
    id: "a0000000-0000-4000-8000-000000000016",
    kind: "cli",
    endpoint: "cli://scalexio.dspace",
    auth_strategy: "none",
    data_classification: "confidential",
    config_schema: { install_root: "string", project_dir: "string" },
    changelog: "Initial registry snapshot: dSPACE HIL/ControlDesk scopes.",
  },
  // ── Calibration ────────────────────────────────────────────────────────
  // 17 — INCA (ETAS)
  {
    slug: "cal.inca",
    id: "a0000000-0000-4000-8000-000000000017",
    kind: "cli",
    endpoint: "cli://inca.etas",
    auth_strategy: "none",
    data_classification: "confidential",
    config_schema: { install_root: "string", experiment_dir: "string" },
    changelog: "Initial registry snapshot: INCA calibration scopes.",
  },
  // ── AUTOSAR authoring ──────────────────────────────────────────────────
  // 18 — EB tresos (Elektrobit/Aumovio)
  {
    slug: "autosar.tresos",
    id: "a0000000-0000-4000-8000-000000000018",
    kind: "cli",
    endpoint: "cli://tresos.elektrobit",
    auth_strategy: "none",
    data_classification: "confidential",
    config_schema: { workspace: "string", project_dir: "string" },
    changelog: "Initial registry snapshot: EB tresos AUTOSAR config scopes.",
  },
  // 19 — DaVinci (Vector)
  {
    slug: "autosar.davinci",
    id: "a0000000-0000-4000-8000-000000000019",
    kind: "cli",
    endpoint: "cli://davinci.vector",
    auth_strategy: "none",
    data_classification: "confidential",
    config_schema: { workspace: "string", project_dir: "string" },
    changelog: "Initial registry snapshot: DaVinci AUTOSAR config scopes.",
  },
  // ── Requirements management ────────────────────────────────────────────
  // 20 — Jama Connect
  {
    slug: "rm.jama",
    id: "a0000000-0000-4000-8000-000000000020",
    kind: "http_api",
    endpoint: "https://tenant.jamacloud.com/rest",
    auth_strategy: "pat",
    data_classification: "internal",
    config_schema: { base_url: "string", project_id: "string" },
    changelog: "Initial registry snapshot: Jama requirements read/write scopes.",
  },
  // 21 — Polarion (Siemens)
  {
    slug: "rm.polarion",
    id: "a0000000-0000-4000-8000-000000000021",
    kind: "http_api",
    endpoint: "https://polarion.tenant/polarion",
    auth_strategy: "pat",
    data_classification: "internal",
    config_schema: { base_url: "string", project_id: "string" },
    changelog: "Initial registry snapshot: Polarion requirements scopes.",
  },
  // 22 — Codebeamer (PTC)
  {
    slug: "rm.codebeamer",
    id: "a0000000-0000-4000-8000-000000000022",
    kind: "http_api",
    endpoint: "https://tenant.codebeamer.com",
    auth_strategy: "pat",
    data_classification: "internal",
    config_schema: { base_url: "string", project_id: "string" },
    changelog: "Initial registry snapshot: Codebeamer tracker scopes.",
  },
  // 23 — DOORS Next (IBM)
  {
    slug: "rm.doors",
    id: "a0000000-0000-4000-8000-000000000023",
    kind: "http_api",
    endpoint: "https://doors-ng.tenant/rm",
    auth_strategy: "oauth",
    data_classification: "internal",
    config_schema: { base_url: "string", oslc_project: "string" },
    changelog: "Initial registry snapshot: DOORS Next RM scopes.",
  },
  // 24 — Valispace
  {
    slug: "rm.valispace",
    id: "a0000000-0000-4000-8000-000000000024",
    kind: "http_api",
    endpoint: "https://tenant.valispace.com/api",
    auth_strategy: "pat",
    data_classification: "internal",
    config_schema: { base_url: "string", project_id: "string" },
    changelog: "Initial registry snapshot: Valispace requirements/analysis scopes.",
  },
  // ── Docs / PM / VCS ────────────────────────────────────────────────────
  // 25 — Confluence (Atlassian)
  {
    slug: "docs.confluence",
    id: "a0000000-0000-4000-8000-000000000025",
    kind: "http_api",
    endpoint: "https://tenant.atlassian.net/wiki",
    auth_strategy: "oauth",
    data_classification: "internal",
    config_schema: { base_url: "string", space_key: "string" },
    changelog: "Initial registry snapshot: Confluence page/space scopes.",
  },
  // 26 — cplace
  {
    slug: "pm.cplace",
    id: "a0000000-0000-4000-8000-000000000026",
    kind: "http_api",
    endpoint: "https://tenant.cplace.com/api",
    auth_strategy: "oauth",
    data_classification: "internal",
    config_schema: { base_url: "string", project_space: "string" },
    changelog: "Initial registry snapshot: cplace project scopes.",
  },
  // 27 — GitLab
  {
    slug: "vcs.gitlab",
    id: "a0000000-0000-4000-8000-000000000027",
    kind: "http_api",
    endpoint: "https://gitlab.tenant/api/v4",
    auth_strategy: "pat",
    data_classification: "internal",
    config_schema: { base_url: "string", group: "string" },
    changelog: "Initial registry snapshot: GitLab repo/CI scopes.",
  },
  // 28 — Azure DevOps
  {
    slug: "vcs.azure-devops",
    id: "a0000000-0000-4000-8000-000000000028",
    kind: "http_api",
    endpoint: "https://dev.azure.com/org",
    auth_strategy: "oauth",
    data_classification: "internal",
    config_schema: { org_url: "string", project: "string" },
    changelog: "Initial registry snapshot: Azure DevOps repo/work-item scopes.",
  },
  // ── SPC / Quality ──────────────────────────────────────────────────────
  // 29 — Minitab (mtbpy)
  {
    slug: "spc.minitab",
    id: "a0000000-0000-4000-8000-000000000029",
    kind: "cli",
    endpoint: "cli://minitab.mtbpy",
    auth_strategy: "none",
    data_classification: "internal",
    config_schema: { python_env: "string", project_dir: "string" },
    changelog: "Initial registry snapshot: Minitab mtbpy SPC scopes.",
  },
  // 30 — AQuA Pro (Omnex)
  {
    slug: "qms.aqua-pro",
    id: "a0000000-0000-4000-8000-000000000030",
    kind: "http_api",
    endpoint: "https://aqua.tenant/api",
    auth_strategy: "oauth",
    data_classification: "internal",
    config_schema: { base_url: "string", tenant: "string" },
    changelog: "Initial registry snapshot: AQuA Pro APQP/PPAP scopes.",
  },
  // 31 — Net-Inspect
  {
    slug: "qms.net-inspect",
    id: "a0000000-0000-4000-8000-000000000031",
    kind: "http_api",
    endpoint: "https://net-inspect.tenant/api",
    auth_strategy: "pat",
    data_classification: "internal",
    config_schema: { base_url: "string", plant: "string" },
    changelog: "Initial registry snapshot: Net-Inspect supplier quality scopes.",
  },
  // 32 — SAP QM
  {
    slug: "qms.sap-qm",
    id: "a0000000-0000-4000-8000-000000000032",
    kind: "http_api",
    endpoint: "internal://sap-qm:44300",
    auth_strategy: "service_account",
    data_classification: "internal",
    config_schema: { base_url: "string", client: "string" },
    changelog: "Initial registry snapshot: SAP QM inspection-lot scopes.",
  },
  // ── Manufacturing / Digital twin / RTOS ────────────────────────────────
  // 33 — Tecnomatix Process Simulate
  {
    slug: "mfg.tecnomatix",
    id: "a0000000-0000-4000-8000-000000000033",
    kind: "cli",
    endpoint: "cli://tecnomatix.siemens",
    auth_strategy: "none",
    data_classification: "confidential",
    config_schema: { install_root: "string", station_dir: "string" },
    changelog: "Initial registry snapshot: Tecnomatix process-simulation scopes.",
  },
  // 34 — DELMIA (Dassault)
  {
    slug: "mfg.delmia",
    id: "a0000000-0000-4000-8000-000000000034",
    kind: "cli",
    endpoint: "cli://delmia.3ds",
    auth_strategy: "none",
    data_classification: "confidential",
    config_schema: { install_root: "string", station_dir: "string" },
    changelog: "Initial registry snapshot: DELMIA manufacturing scopes.",
  },
  // 35 — NVIDIA Omniverse
  {
    slug: "dt.omniverse",
    id: "a0000000-0000-4000-8000-000000000035",
    kind: "http_api",
    endpoint: "https://omniverse.tenant",
    auth_strategy: "oauth",
    data_classification: "internal",
    config_schema: { base_url: "string", stage: "string" },
    changelog: "Initial registry snapshot: Omniverse digital-twin scopes.",
  },
  // 36 — QNX (BlackBerry)
  {
    slug: "rt.qnx",
    id: "a0000000-0000-4000-8000-000000000036",
    kind: "cli",
    endpoint: "cli://qnx.blackberry",
    auth_strategy: "none",
    data_classification: "confidential",
    config_schema: { sdp_root: "string", target_dir: "string" },
    changelog: "Initial registry snapshot: QNX build/target scopes.",
  },
];

/** Registry slug → tool id. The slug is `tool.name` (the unique key per tenant). */
export const toolIdFixtures: Record<string, string> = {
  jira: "10000000-0000-4000-8000-000000000001",
  github: "10000000-0000-4000-8000-000000000002",
  cmms: "10000000-0000-4000-8000-000000000003",
  "historian-pi": "10000000-0000-4000-8000-000000000004",
  ...Object.fromEntries(LANDSCAPE_TOOL_SEEDS.map((seed) => [seed.slug, seed.id] as const)),
};

const FIXTURE_TENANT_ID = "d9d9d9d9-0000-4000-8000-000000000001";
const FIXTURE_OWNER_ID = "60000000-0000-4000-8000-000000000001";

/** Tool Registry fixtures — snake_case wire shape (toolSchema). */
export const toolFixtures: Tool[] = [
  {
    id: toolIdFixtures["jira"]!,
    tenant_id: FIXTURE_TENANT_ID,
    name: "jira",
    kind: "mcp",
    endpoint: "mcp://mcp.jira.internal",
    auth_strategy: "oauth",
    data_classification: "internal",
    owner_user_id: FIXTURE_OWNER_ID,
    review_status: "approved",
  },
  {
    id: toolIdFixtures["github"]!,
    tenant_id: FIXTURE_TENANT_ID,
    name: "github",
    kind: "mcp",
    endpoint: "https://api.github.com/mcp",
    auth_strategy: "oauth",
    data_classification: "internal",
    owner_user_id: FIXTURE_OWNER_ID,
    review_status: "approved",
  },
  {
    id: toolIdFixtures["cmms"]!,
    tenant_id: FIXTURE_TENANT_ID,
    name: "cmms",
    kind: "connector",
    endpoint: "cmms.internal:8443",
    auth_strategy: "pat",
    data_classification: "confidential",
    owner_user_id: FIXTURE_OWNER_ID,
    review_status: "approved",
  },
  {
    id: toolIdFixtures["historian-pi"]!,
    tenant_id: FIXTURE_TENANT_ID,
    name: "historian-pi",
    kind: "connector",
    endpoint: "pi.internal:5450",
    auth_strategy: "pat",
    data_classification: "restricted",
    owner_user_id: FIXTURE_OWNER_ID,
    review_status: "approved",
  },
  ...LANDSCAPE_TOOL_SEEDS.map(
    (seed): Tool => ({
      id: seed.id,
      tenant_id: FIXTURE_TENANT_ID,
      name: seed.slug,
      kind: seed.kind,
      endpoint: seed.endpoint,
      auth_strategy: seed.auth_strategy,
      data_classification: seed.data_classification,
      owner_user_id: FIXTURE_OWNER_ID,
      review_status: "approved",
    }),
  ),
];

/**
 * Tool version fixtures — one immutable snapshot per tool. `manifest_sha256`
 * is a real digest over the canonical { config_schema, changelog } object.
 */
export const toolVersionFixtures: ToolVersion[] = [
  {
    id: "20000000-0000-4000-8000-000000000001",
    tool_id: toolIdFixtures["jira"]!,
    version: "1.0.0",
    manifest_sha256: manifestSha256({
      config_schema: { base_url: "string", project_key: "string" },
      changelog: "Initial registry snapshot: issue read/write/transition scopes.",
    }),
    config_schema: { base_url: "string", project_key: "string" },
    changelog: "Initial registry snapshot: issue read/write/transition scopes.",
  },
  {
    id: "20000000-0000-4000-8000-000000000002",
    tool_id: toolIdFixtures["github"]!,
    version: "1.0.0",
    manifest_sha256: manifestSha256({
      config_schema: { org: "string", default_repo: "string" },
      changelog: "Initial registry snapshot: repo read/write scopes.",
    }),
    config_schema: { org: "string", default_repo: "string" },
    changelog: "Initial registry snapshot: repo read/write scopes.",
  },
  {
    id: "20000000-0000-4000-8000-000000000003",
    tool_id: toolIdFixtures["cmms"]!,
    version: "1.0.0",
    manifest_sha256: manifestSha256({
      config_schema: { site_url: "string", asset_prefix: "string" },
      changelog: "Initial registry snapshot: work-order + inventory scopes.",
    }),
    config_schema: { site_url: "string", asset_prefix: "string" },
    changelog: "Initial registry snapshot: work-order + inventory scopes.",
  },
  {
    id: "20000000-0000-4000-8000-000000000004",
    tool_id: toolIdFixtures["historian-pi"]!,
    version: "1.0.0",
    manifest_sha256: manifestSha256({
      config_schema: { af_server: "string", tag_prefix: "string" },
      changelog: "Initial registry snapshot: tag read + archive scopes.",
    }),
    config_schema: { af_server: "string", tag_prefix: "string" },
    changelog: "Initial registry snapshot: tag read + archive scopes.",
  },
  ...LANDSCAPE_TOOL_SEEDS.map(
    (seed): ToolVersion => ({
      id: landscapeVersionId(seed),
      tool_id: seed.id,
      version: "1.0.0",
      manifest_sha256: manifestSha256({ config_schema: seed.config_schema, changelog: seed.changelog }),
      config_schema: seed.config_schema,
      changelog: seed.changelog,
    }),
  ),
];

// ── Package version seeds (slug refs) → wire fixtures (real hashes) ────────

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
      tools: [
        { tool: "jira", toolVersion: "1.0.0", scopes: ["read:issue", "write:comment", "transition:issue"] },
        { tool: "historian-pi", toolVersion: "1.0.0", scopes: ["read:tags", "read:archive"] },
      ],
      skills: ["8d-generator", "control-plan-editor", "ppap-checklist", "iatf-clause-library"],
      subagentConfigs: ["8d-root-cause-solver"],
      permissions: ["tool:jira:invoke", "resource:read:mes_defects"],
      modelRouting: { strategy: "frontier_for_reasoning", fallback: "glm-5.2", day_cap_usd: 60 },
      budgetTemplate: { monthly_usd_cap: 950, model_tier: "mixed", overage_action: "throttle" },
      starterPrompts: ["Draft an 8D for defect D-1042", "Generate a PPAP checklist for part 4477-B"],
      templateRefs: ["tpl_8d_report", "tpl_ppap_submission", "tpl_control_plan"],
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
      tools: [
        { tool: "github", toolVersion: "1.0.0", scopes: ["repo:read", "repo:write"] },
        { tool: "historian-pi", toolVersion: "1.0.0", scopes: ["read:tags"] },
      ],
      skills: ["ladder-codegen", "st-codegen", "aoi-library", "io-table-import"],
      subagentConfigs: ["diff-merge-reviewer"],
      permissions: ["tool:github:invoke"],
      modelRouting: { strategy: "frontier_for_codegen", fallback: "deepseek-v3", loop_cap: 24 },
      budgetTemplate: { monthly_usd_cap: 700, model_tier: "mixed", loop_cap: 24 },
      starterPrompts: ["Generate ladder logic for a 3-motor sequence", "Diff my AOI against the library baseline"],
      templateRefs: ["tpl_ladder_patterns", "tpl_alarm_templates"],
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
      tools: [
        { tool: "cmms", toolVersion: "1.0.0", scopes: ["workorder:read", "workorder:update", "asset:read"] },
        { tool: "historian-pi", toolVersion: "1.0.0", scopes: ["read:tags"] },
      ],
      skills: ["fault-fix-playbooks", "sop-checklists", "escalation-trees"],
      subagentConfigs: ["fault-triage-agent"],
      permissions: ["tool:cmms:invoke"],
      modelRouting: { strategy: "cheap_first", fallback: "glm-5.2" },
      budgetTemplate: { monthly_usd_cap: 420, model_tier: "cheap", mobile_first: true },
      starterPrompts: ["Fault FC-1042 on Line A — walk me through the fix", "Write the closing notes for WO-8821"],
      templateRefs: ["tpl_sop_checklist", "tpl_fault_report"],
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
      tools: [
        { tool: "jira", toolVersion: "1.0.0", scopes: ["read:issue", "write:comment"] },
      ],
      skills: ["meeting-notes-actions", "doc-summarization", "mail-triage"],
      subagentConfigs: [],
      permissions: ["tool:jira:invoke"],
      modelRouting: { strategy: "cheapest_viable" },
      budgetTemplate: { monthly_usd_cap: 300, model_tier: "cheap", per_seat: true },
      starterPrompts: ["Summarize this thread and list action items", "Turn these meeting notes into Jira tasks"],
      templateRefs: ["tpl_meeting_notes", "tpl_mail_reply"],
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
      tools: [
        { tool: "jira", toolVersion: "1.0.0", scopes: ["read:issue"] },
        { tool: "historian-pi", toolVersion: "1.0.0", scopes: ["read:tags"] },
      ],
      skills: ["kpi-briefing-generator", "exec-digest", "approval-summaries"],
      subagentConfigs: ["kpi-analyst"],
      permissions: ["tool:jira:invoke"],
      modelRouting: { strategy: "frontier_for_briefings", aggregates_only: true },
      budgetTemplate: { monthly_usd_cap: 400, model_tier: "mixed", aggregates_only: true },
      starterPrompts: ["Brief me on yesterday's OEE across plants", "Summarize the approvals inbox"],
      templateRefs: ["tpl_kpi_brief", "tpl_exec_digest"],
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
      tools: [
        { tool: "cmms", toolVersion: "1.0.0", scopes: ["inventory:read", "workorder:read"] },
        { tool: "historian-pi", toolVersion: "1.0.0", scopes: ["read:tags"] },
      ],
      skills: ["mrp-exception-triage", "ecn-impact-alerts", "eol-calculators"],
      subagentConfigs: ["exception-triage-batch"],
      permissions: ["tool:cmms:invoke"],
      modelRouting: { strategy: "small_model_batch", batch_window: "nightly" },
      budgetTemplate: { monthly_usd_cap: 600, model_tier: "cheap", high_volume: true },
      starterPrompts: ["Triage today's MRP exceptions", "Which ECNs touch part 4477-B?"],
      templateRefs: ["tpl_exception_card", "tpl_ecn_impact"],
      minAgentVersion: "1.4.0",
    },
  },
];

function insertToWireVersion(insert: PackageVersionInsert, id: string): WorkPackageVersion {
  return {
    id,
    package_id: insert.packageId,
    version: insert.version,
    tools: insert.tools.map((ref) => ({
      tool_id: ref.toolId,
      tool_version: ref.toolVersion,
      scopes: ref.scopes,
    })),
    skills: insert.skills,
    subagent_configs: insert.subagentConfigs,
    permissions: insert.permissions,
    model_routing: insert.modelRouting,
    budget_template: insert.budgetTemplate,
    starter_prompts: insert.starterPrompts,
    template_refs: insert.templateRefs,
    min_agent_version: insert.minAgentVersion,
    manifest_sha256: insert.manifestSha256,
  };
}

/**
 * Package version fixtures — wire-shaped (workPackageVersionSchema), each
 * `manifest_sha256` computed over the canonical snake_case manifest of the
 * INSERT-READY (toolId-resolved) refs. Provisoning fails loud if a slug is
 * missing from `toolIdFixtures`.
 */
export const packageVersionFixtures: WorkPackageVersion[] = PACKAGE_VERSION_SEEDS.map((spec) =>
  insertToWireVersion(
    buildPackageVersionFromSeed(spec.seed, spec.packageId, "1.0.0", toolIdFixtures),
    spec.id,
  ),
);
