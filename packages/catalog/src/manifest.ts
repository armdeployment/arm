/**
 * D10 Work Package manifest v2 — canonical shape + version validation
 * (docs/guides/00-shared-contracts.md §4, docs/guides/01-library-artifactory.md §4).
 *
 * `tool` generalizes to `component` (A3): the manifest's second field is a
 * single `components[]` ref array (mcp/http_api/cli/connector/plugin/skill/
 * subagent/template/prompt_pack, discriminated by `kind`) instead of the v1
 * `tools`/`skills`/`subagent_configs`/`template_refs` split, plus a new
 * `job_functions[]` field (D10 taxonomy, `packages/profiles`).
 *
 * ── THE HASHED FIELD LIST (guide 00 §4) ─────────────────────────────────────
 * `canonicalManifest` produces the wire-shaped (snake_case) plain object that
 * `manifestSha256` hashes. EXACTLY these eight fields are hashed, nothing
 * else (no `id`, no `package_id`, no `version`, no `manifest_sha256`, no
 * timestamps): `manifest_version` (literal 2), `components`, `permissions`,
 * `model_routing`, `budget_template`, `starter_prompts`, `min_agent_version`,
 * `job_functions`.
 *
 * `canonicalManifest` only sorts OBJECT KEYS recursively (via `hash.ts`'s
 * `canonicalize`) — it does NOT sort array elements. Per the golden-vector
 * convention (`packages/proto/test/fixtures/manifest-v2-golden.json` +
 * `packages/proto/test/manifest-v2-golden.test.ts`), `components` must be
 * pre-sorted by `component_id` and `permissions`/`job_functions` pre-sorted
 * lexicographically by the CALLER (`provision.ts`) before hashing;
 * `starter_prompts` keeps insertion order.
 *
 * The canonical object must be constructible from BOTH sides:
 *   - DB side: the `work_package_version` row (camelCase Drizzle fields,
 *     component refs as `{ componentId, version, kind, scopes }`);
 *   - Client side: the wire manifest (snake_case proto shape, component
 *     refs as `{ component_id, version, kind, scopes }`).
 * `@arm/client-core`'s `buildCanonicalManifest` builds the identical object
 * (both sides prove byte-identical output against the shared golden vector,
 * `test/canonical-golden.test.ts`) — any change to this field list is a wire
 * break and must update the client + the golden vector in the same PR
 * (exactly what this D10 cutover does: guide 00 §4 froze the new list).
 *
 * `validatePackageVersion` enforces the `component-review`/`artifact-integrity`
 * guardrails at the application layer: every component ref pins an existing,
 * APPROVED, non-yanked component_version, and a package must ship at least
 * one component; every `job_functions[]` entry resolves to a seeded key.
 */

import { workPackageVersionSchema } from "@arm/proto";

export interface CamelComponentRef {
  componentId: string;
  version: string;
  kind: string;
  scopes: string[];
}

export interface SnakeComponentRef {
  component_id: string;
  version: string;
  kind: string;
  scopes?: string[];
}

/** Component reference in either DB (camelCase) or wire (snake_case) shape. */
export type ManifestComponentRef = CamelComponentRef | SnakeComponentRef;

/** Wire-shaped component ref as it appears in the canonical manifest. */
export interface ManifestComponentRefWire {
  component_id: string;
  version: string;
  kind: string;
  scopes: string[];
}

/** DB-shaped (camelCase) source fields — the `work_package_version` row. */
export interface PackageManifestInput {
  components?: ManifestComponentRef[];
  permissions?: string[];
  modelRouting?: Record<string, unknown>;
  budgetTemplate?: Record<string, unknown>;
  starterPrompts?: string[];
  minAgentVersion?: string;
  jobFunctions?: string[];
}

/** Wire-shaped (snake_case) source fields — the proto package version. */
export interface PackageManifestWireInput {
  components?: ManifestComponentRefWire[];
  permissions?: string[];
  model_routing?: Record<string, unknown>;
  budget_template?: Record<string, unknown>;
  starter_prompts?: string[];
  min_agent_version?: string;
  job_functions?: string[];
}

/**
 * Either source shape (DB row or wire manifest) — every key is optional and
 * the camel/snake variants are distinct keys, so partial objects from either
 * side typecheck. Missing fields default to their schema defaults so both
 * sides hash the same empty-value forms.
 */
export interface PackageManifestSource {
  components?: ManifestComponentRef[] | ManifestComponentRefWire[];
  permissions?: string[];
  modelRouting?: Record<string, unknown>;
  model_routing?: Record<string, unknown>;
  budgetTemplate?: Record<string, unknown>;
  budget_template?: Record<string, unknown>;
  starterPrompts?: string[];
  starter_prompts?: string[];
  minAgentVersion?: string;
  min_agent_version?: string;
  jobFunctions?: string[];
  job_functions?: string[];
}

/** Canonical (wire-shaped) manifest v2 — the exact object `manifestSha256`
 *  hashes. Field order here matches guide 00 §4 for readability; hashing
 *  itself is key-order-independent (`hash.ts`'s `canonicalize`). */
export interface PackageManifest {
  manifest_version: 2;
  components: ManifestComponentRefWire[];
  permissions: string[];
  model_routing: Record<string, unknown>;
  budget_template: Record<string, unknown>;
  starter_prompts: string[];
  min_agent_version: string;
  job_functions: string[];
}

function normalizeComponentRef(ref: ManifestComponentRef): ManifestComponentRefWire {
  const componentId = "componentId" in ref ? ref.componentId : ref.component_id;
  return {
    component_id: componentId,
    version: ref.version,
    kind: ref.kind,
    scopes: ref.scopes ?? [],
  };
}

/**
 * Canonical manifest v2 — normalizes either the camelCase DB row or the
 * snake_case wire manifest to the same snake_case object (the eight hashed
 * fields, see the field list above). Does NOT sort array elements — callers
 * must pre-sort `components` (by `component_id`) and `permissions`/
 * `job_functions` (lexicographically) before this is called.
 */
export function canonicalManifest(pkg: PackageManifestSource): PackageManifest {
  return {
    manifest_version: 2,
    components: (pkg.components ?? []).map(normalizeComponentRef),
    permissions: pkg.permissions ?? [],
    model_routing: pkg.model_routing ?? pkg.modelRouting ?? {},
    budget_template: pkg.budget_template ?? pkg.budgetTemplate ?? {},
    starter_prompts: pkg.starter_prompts ?? pkg.starterPrompts ?? [],
    min_agent_version: pkg.min_agent_version ?? pkg.minAgentVersion ?? "0.0.0",
    job_functions: pkg.job_functions ?? pkg.jobFunctions ?? [],
  };
}

/** What `validatePackageVersion` needs to know about a pinned
 *  `(component_id, version)` — mirrors the relevant slice of
 *  `component_version` + its parent `component.review_status`. */
export interface ComponentVersionLookup {
  reviewStatus: string;
  yanked: boolean;
}

/**
 * Validate a wire-shaped package version (manifest v2) against the
 * Component Registry + job-function taxonomy.
 *
 * `componentVersionsById` maps `"${component_id}@${version}"` → the pinned
 * version's review status + yanked flag (populated from `component` +
 * `component_version`). `knownJobFunctionKeys` is the seeded taxonomy key
 * set (`packages/profiles`). Rejects: unknown component_version refs, refs
 * pinning a non-approved or yanked version, packages shipping zero
 * components, and `job_functions[]` entries outside the known key set.
 */
export function validatePackageVersion(
  input: unknown,
  componentVersionsById: Map<string, ComponentVersionLookup>,
  knownJobFunctionKeys: ReadonlySet<string>,
): { ok: boolean; errors: string[] } {
  const parsed = workPackageVersionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map(
        (issue) => `${issue.path.length > 0 ? `${issue.path.join(".")}: ` : ""}${issue.message}`,
      ),
    };
  }
  const data = parsed.data;
  const errors: string[] = [];

  for (const [i, ref] of data.components.entries()) {
    const key = `${ref.component_id}@${ref.version}`;
    const cv = componentVersionsById.get(key);
    if (cv === undefined) {
      errors.push(
        `components[${i}]: unknown component_version "${ref.component_id}@${ref.version}"`,
      );
      continue;
    }
    if (cv.reviewStatus !== "approved") {
      errors.push(
        `components[${i}]: component "${ref.component_id}" version "${ref.version}" is not approved ` +
          `(review_status="${cv.reviewStatus}")`,
      );
    }
    if (cv.yanked) {
      errors.push(
        `components[${i}]: component "${ref.component_id}" version "${ref.version}" is yanked`,
      );
    }
  }

  if (data.components.length === 0) {
    errors.push(
      "package ships nothing usable: components is empty — a package must ship at least one component",
    );
  }

  for (const [i, key] of data.job_functions.entries()) {
    if (!knownJobFunctionKeys.has(key)) {
      errors.push(`job_functions[${i}]: unknown job function key "${key}"`);
    }
  }

  return { ok: errors.length === 0, errors };
}
