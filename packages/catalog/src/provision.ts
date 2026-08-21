/**
 * D9 provisioning: industry-profile seed → immutable work_package_version
 * insert (copy-on-provisioning, D7 lock).
 *
 * Seeds arrive as `WorkPackageSeedInput` from profile presets (D6 pattern:
 * presets set defaults, never gate capabilities). Seed tool refs are
 * SLUG-based ({ tool, toolVersion, scopes } — the registry slug, not a DB id);
 * provisioning resolves each slug through `toolIdsBySlug` into the stored
 * `WorkPackageToolRef` ({ toolId, toolVersion, scopes }) shape. A seed slug
 * missing from the map is a hard provisioning error (M5: fail loud, never
 * store a dangling ref). Provisioning pins the bundle into a versioned row
 * whose `manifestSha256` covers the canonical (snake_case) manifest built
 * from the INSERT-READY tool refs — i.e. the hash covers exactly what gets
 * stored, so installs and agent starts can verify config integrity
 * (guardrail `package-integrity`).
 */

import type { WorkPackageSeedInput, WorkPackageToolRef } from "@arm/db/schema";
import { manifestSha256 } from "./hash.js";
import { canonicalManifest } from "./manifest.js";

/**
 * Insert shape for work_package_version — the Drizzle field names for the
 * DB columns (package_id, version, tools, skills, subagent_configs,
 * permissions, model_routing, budget_template, starter_prompts,
 * template_refs, min_agent_version, manifest_sha256). All fields required;
 * `id`/`createdAt` are DB defaults and not part of the insert.
 */
export interface PackageVersionInsert {
  packageId: string;
  version: string;
  tools: WorkPackageToolRef[];
  skills: string[];
  subagentConfigs: string[];
  permissions: string[];
  modelRouting: Record<string, unknown>;
  budgetTemplate: Record<string, unknown>;
  starterPrompts: string[];
  templateRefs: string[];
  minAgentVersion: string;
  manifestSha256: string;
}

/**
 * Build a pinned, tamper-evident package version row from a slug-based seed.
 *
 * `toolIdsBySlug` maps Tool Registry slugs ("jira") → tool ids. Every seed
 * tool ref is resolved through it; an unmapped slug throws (provisioning
 * must fail loud rather than store a dangling ref — M5). The returned
 * insert stores the RESOLVED refs, and `manifestSha256` is computed over
 * the canonical snake_case manifest of those resolved refs (hash what gets
 * stored, not the seed's slug form — B1).
 */
export function buildPackageVersionFromSeed(
  seed: WorkPackageSeedInput,
  packageId: string,
  version: string,
  toolIdsBySlug: Record<string, string>,
): PackageVersionInsert {
  const tools: WorkPackageToolRef[] = seed.tools.map((ref) => {
    const toolId = toolIdsBySlug[ref.tool];
    if (toolId === undefined) {
      throw new Error(
        `cannot provision seed tool "${ref.tool}": no Tool Registry id in toolIdsBySlug ` +
          `(add the slug→id mapping before provisioning this package)`,
      );
    }
    return { toolId, toolVersion: ref.toolVersion, scopes: ref.scopes };
  });
  const manifest = canonicalManifest({
    tools,
    skills: seed.skills,
    subagentConfigs: seed.subagentConfigs,
    permissions: seed.permissions,
    modelRouting: seed.modelRouting,
    budgetTemplate: seed.budgetTemplate,
    starterPrompts: seed.starterPrompts,
    templateRefs: seed.templateRefs,
    minAgentVersion: seed.minAgentVersion,
  });
  return {
    packageId,
    version,
    tools,
    skills: seed.skills,
    subagentConfigs: seed.subagentConfigs,
    permissions: seed.permissions,
    modelRouting: seed.modelRouting,
    budgetTemplate: seed.budgetTemplate,
    starterPrompts: seed.starterPrompts,
    templateRefs: seed.templateRefs,
    minAgentVersion: seed.minAgentVersion,
    manifestSha256: manifestSha256(manifest),
  };
}
