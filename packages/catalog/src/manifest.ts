/**
 * D9 Work Package manifest — canonical shape + version validation.
 *
 * The manifest is the installable bundle surface: pinned tool refs, skills,
 * sub-agent configs, permissions, model routing, budget template, starter
 * prompts, and template refs (docs/solutions/2026-08-13-d9-work-packages.md).
 *
 * ── THE HASHED FIELD LIST (B1) ──────────────────────────────────────────────
 * `canonicalManifest` produces the wire-shaped (snake_case) plain object that
 * `manifestSha256` hashes. EXACTLY these nine fields are hashed — nothing
 * else (no `id`, no `package_id`, no `version`, no `manifest_sha256`, no
 * timestamps):
 *
 *   1. tools              → [{ tool_id, tool_version, scopes }]
 *   2. skills
 *   3. subagent_configs
 *   4. permissions
 *   5. model_routing
 *   6. budget_template
 *   7. starter_prompts
 *   8. template_refs
 *   9. min_agent_version
 *
 * The canonical object must be constructible from BOTH sides:
 *   - DB side: the `work_package_version` row (camelCase Drizzle fields,
 *     tool refs as { toolId, toolVersion, scopes });
 *   - Client side: the wire manifest (snake_case proto shape,
 *     tool refs as { tool_id, tool_version, scopes }).
 * So `canonicalManifest` accepts either source shape and normalizes both to
 * the same snake_case output. `@arm/client-core`'s `buildCanonicalManifest`
 * builds the identical object (mirrored by the golden-vector test in
 * test/canonical-golden.test.ts) — any change to this field list is a wire
 * break and must update the client + the golden vector in the same PR.
 *
 * `validatePackageVersion` enforces the `package-integrity` guardrail — every
 * tool ref pins an existing tool version, and a package must ship something
 * usable.
 */

import { workPackageVersionSchema } from "@arm/proto";

export interface CamelToolRef {
  toolId: string;
  toolVersion: string;
  scopes: string[];
}

export interface SnakeToolRef {
  tool_id: string;
  tool_version: string;
  scopes?: string[];
}

/** Tool reference in either DB (camelCase) or wire (snake_case) shape. */
export type ManifestToolRef = CamelToolRef | SnakeToolRef;

/** Wire-shaped tool ref as it appears in the canonical manifest. */
export interface ManifestToolRefWire {
  tool_id: string;
  tool_version: string;
  scopes: string[];
}

/** DB-shaped (camelCase) source fields — the `work_package_version` row. */
export interface PackageManifestInput {
  tools?: ManifestToolRef[];
  skills?: string[];
  subagentConfigs?: string[];
  permissions?: string[];
  modelRouting?: Record<string, unknown>;
  budgetTemplate?: Record<string, unknown>;
  starterPrompts?: string[];
  templateRefs?: string[];
  minAgentVersion?: string;
}

/** Wire-shaped (snake_case) source fields — the proto package version. */
export interface PackageManifestWireInput {
  tools?: ManifestToolRefWire[];
  skills?: string[];
  subagent_configs?: string[];
  permissions?: string[];
  model_routing?: Record<string, unknown>;
  budget_template?: Record<string, unknown>;
  starter_prompts?: string[];
  template_refs?: string[];
  min_agent_version?: string;
}

/**
 * Either source shape (DB row or wire manifest) — every key is optional and
 * the camel/snake variants are distinct keys, so partial objects from either
 * side typecheck. Missing fields default to their schema defaults so both
 * sides hash the same empty-value forms.
 */
export interface PackageManifestSource {
  tools?: ManifestToolRef[] | ManifestToolRefWire[];
  skills?: string[];
  subagentConfigs?: string[];
  subagent_configs?: string[];
  permissions?: string[];
  modelRouting?: Record<string, unknown>;
  model_routing?: Record<string, unknown>;
  budgetTemplate?: Record<string, unknown>;
  budget_template?: Record<string, unknown>;
  starterPrompts?: string[];
  starter_prompts?: string[];
  templateRefs?: string[];
  template_refs?: string[];
  minAgentVersion?: string;
  min_agent_version?: string;
}

/** Canonical (wire-shaped) manifest — the exact object `manifestSha256` hashes. */
export interface PackageManifest {
  tools: ManifestToolRefWire[];
  skills: string[];
  subagent_configs: string[];
  permissions: string[];
  model_routing: Record<string, unknown>;
  budget_template: Record<string, unknown>;
  starter_prompts: string[];
  template_refs: string[];
  min_agent_version: string;
}

function normalizeToolRef(ref: ManifestToolRef): ManifestToolRefWire {
  const toolId = "toolId" in ref ? ref.toolId : ref.tool_id;
  const toolVersion = "toolVersion" in ref ? ref.toolVersion : ref.tool_version;
  return { tool_id: toolId, tool_version: toolVersion, scopes: ref.scopes ?? [] };
}

/**
 * Canonical manifest — normalizes either the camelCase DB row or the
 * snake_case wire manifest to the same snake_case object (the nine hashed
 * fields, see the field list above).
 */
export function canonicalManifest(pkg: PackageManifestSource): PackageManifest {
  return {
    tools: (pkg.tools ?? []).map(normalizeToolRef),
    skills: pkg.skills ?? [],
    subagent_configs: pkg.subagent_configs ?? pkg.subagentConfigs ?? [],
    permissions: pkg.permissions ?? [],
    model_routing: pkg.model_routing ?? pkg.modelRouting ?? {},
    budget_template: pkg.budget_template ?? pkg.budgetTemplate ?? {},
    starter_prompts: pkg.starter_prompts ?? pkg.starterPrompts ?? [],
    template_refs: pkg.template_refs ?? pkg.templateRefs ?? [],
    min_agent_version: pkg.min_agent_version ?? pkg.minAgentVersion ?? "0.0.0",
  };
}

/**
 * Validate a wire-shaped package version against the Tool Registry.
 *
 * `toolsById` maps tool id → set of published versions (populated from
 * tool + tool_version). Rejects unknown tool refs, refs pinning unpublished
 * versions, and packages that ship nothing usable (tools, skills,
 * sub-agent configs, and starter prompts all empty).
 */
export function validatePackageVersion(
  input: unknown,
  toolsById: Map<string, Set<string>>,
): { ok: boolean; errors: string[] } {
  const parsed = workPackageVersionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) =>
        `${issue.path.length > 0 ? `${issue.path.join(".")}: ` : ""}${issue.message}`,
      ),
    };
  }
  const data = parsed.data;
  const errors: string[] = [];
  for (const [i, ref] of data.tools.entries()) {
    const versions = toolsById.get(ref.tool_id);
    if (versions === undefined) {
      errors.push(`tools[${i}].tool_id: unknown tool "${ref.tool_id}"`);
    } else if (!versions.has(ref.tool_version)) {
      errors.push(`tools[${i}]: tool "${ref.tool_id}" has no version "${ref.tool_version}"`);
    }
  }
  if (
    data.tools.length === 0 &&
    data.skills.length === 0 &&
    data.subagent_configs.length === 0 &&
    data.starter_prompts.length === 0
  ) {
    errors.push(
      "package ships nothing usable: tools, skills, subagent_configs, and starter_prompts are all empty",
    );
  }
  return { ok: errors.length === 0, errors };
}
