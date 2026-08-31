/**
 * D10 provisioning: industry-profile seed → immutable work_package_version
 * insert (copy-on-provisioning, D7 lock; docs/guides/01-library-artifactory.md §4).
 *
 * Seeds arrive as `WorkPackageSeedInput` from profile presets (D6 pattern:
 * presets set defaults, never gate capabilities). Seed component refs are
 * SLUG-based (`{ component, componentVersion, kind, scopes }` — the registry
 * slug + exact pinned version, not a DB id). Provisioning resolves each slug
 * through `@arm/artifactory`'s `resolve()` — NOT a bare `toolIdsBySlug` map
 * (guide 01 §4.4) — into the stored `WorkPackageComponentRef`
 * (`{ componentId, version, kind, scopes }`) shape. A seed slug/version with
 * no match in the Component Registry is a hard provisioning error (M5: fail
 * loud, never store a dangling ref).
 *
 * Component refs, permissions, and job_functions are sorted before hashing
 * (components by `componentId`, the other two lexicographically —
 * `manifest.ts`'s canonicalizer does not sort arrays itself, per the
 * manifest-v2 wire convention), so the hash covers exactly the deterministic
 * form that gets stored and re-verified.
 */

import type { WorkPackageSeedInput, WorkPackageComponentRef } from "@arm/db/schema";
import { resolve, type ResolvableComponentVersion } from "@arm/artifactory";
import { manifestSha256 } from "./hash.js";
import { canonicalManifest } from "./manifest.js";

/**
 * Insert shape for work_package_version — the Drizzle field names for the
 * DB columns (package_id, version, manifest_version, components,
 * job_functions, permissions, model_routing, budget_template,
 * starter_prompts, min_agent_version, manifest_sha256). All fields required;
 * `id`/`tenant_id`/`created_at` are DB-context/defaults, not part of this
 * insert shape.
 */
export interface PackageVersionInsert {
  packageId: string;
  version: string;
  manifestVersion: 2;
  components: WorkPackageComponentRef[];
  jobFunctions: string[];
  permissions: string[];
  modelRouting: Record<string, unknown>;
  budgetTemplate: Record<string, unknown>;
  starterPrompts: string[];
  minAgentVersion: string;
  manifestSha256: string;
}

/**
 * Build a pinned, tamper-evident package version row from a slug-based seed.
 *
 * `availableComponents` is the resolvable-version view of the Component
 * Registry (`@arm/artifactory`'s `fixtureResolvableVersions` in tests/demo;
 * a real DB-backed query in production). Every seed component ref is
 * resolved through `resolve(slug, exactVersion, availableComponents,
 * { tenantId })`; an unmatched slug@version throws (fail loud — M5). The
 * returned insert stores the RESOLVED refs (sorted by componentId), and
 * `manifestSha256` is computed over the canonical snake_case manifest of
 * those resolved, sorted refs (hash what gets stored, not the seed's slug
 * form).
 */
export function buildPackageVersionFromSeed(
  seed: WorkPackageSeedInput,
  packageId: string,
  version: string,
  availableComponents: readonly ResolvableComponentVersion[],
  tenantId: string,
): PackageVersionInsert {
  const components: WorkPackageComponentRef[] = seed.components.map((ref) => {
    const resolved = resolve(ref.component, ref.componentVersion, availableComponents, {
      tenantId,
    });
    if (resolved === null) {
      throw new Error(
        `cannot provision seed component "${ref.component}"@"${ref.componentVersion}": no match in the ` +
          `Component Registry (publish/approve the component before provisioning this package)`,
      );
    }
    return {
      componentId: resolved.componentId,
      version: resolved.version,
      kind: ref.kind,
      scopes: ref.scopes,
    };
  });

  // Sort per the manifest-v2 wire convention (guide 00 §4): components by
  // componentId; permissions/job_functions lexicographic; starter_prompts
  // keeps insertion order.
  const sortedComponents = [...components].sort((a, b) =>
    a.componentId.localeCompare(b.componentId),
  );
  const sortedPermissions = [...seed.permissions].sort();
  const sortedJobFunctions = [...seed.jobFunctions].sort();

  const manifest = canonicalManifest({
    components: sortedComponents,
    permissions: sortedPermissions,
    modelRouting: seed.modelRouting,
    budgetTemplate: seed.budgetTemplate,
    starterPrompts: seed.starterPrompts,
    minAgentVersion: seed.minAgentVersion,
    jobFunctions: sortedJobFunctions,
  });

  return {
    packageId,
    version,
    manifestVersion: 2,
    components: sortedComponents,
    jobFunctions: sortedJobFunctions,
    permissions: sortedPermissions,
    modelRouting: seed.modelRouting,
    budgetTemplate: seed.budgetTemplate,
    starterPrompts: seed.starterPrompts,
    minAgentVersion: seed.minAgentVersion,
    manifestSha256: manifestSha256(manifest),
  };
}
