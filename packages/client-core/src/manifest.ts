/**
 * Package manifest fetch + integrity verification (D9 Phase 1.6).
 *
 * The client downloads the package manifest from the control plane catalog
 * endpoint, validates it against the proto contracts, and re-verifies the
 * content hash (`manifest_sha256`) before rendering any config. Tampered or
 * truncated manifests fail loud here, before a single credential is minted.
 *
 * Canonical manifest shape (hashed by `manifestSha256`, shared with
 * `@arm/catalog`): the nine snake_case wire fields below, tool refs
 * normalized to `{ tool_id, tool_version, scopes }`, serialized with sorted
 * keys, no whitespace. `buildCanonicalManifest` must stay byte-identical to
 * `@arm/catalog`'s `canonicalManifest` (packages/catalog/src/manifest.ts) —
 * the control plane hashes the snake_case canonical object, so the client
 * builds the same snake_case object or integrity verification fails.
 * Do not reorder, rename, or add fields without a catalog-side change in
 * the same PR.
 */

import { z } from "zod";
import { toolSchema, workPackageSchema, workPackageVersionSchema } from "@arm/proto";
import { manifestSha256 } from "./hash.js";

/** Work Package entity (zod-inferred from the proto wire contract). */
export type WorkPackage = z.infer<typeof workPackageSchema>;
/** Work Package version — the installable bundle (zod-inferred). */
export type WorkPackageVersion = z.infer<typeof workPackageVersionSchema>;

/**
 * Client-side tool wire type: the proto `toolSchema` plus an optional
 * `config_schema` (e.g. `command` for cli tools) so runtime-rendering hints
 * can flow through the manifest. Additive and optional — catalog payloads
 * without it still parse. The canonical manifest hash covers package-version
 * fields only, so this extension does not affect integrity verification.
 */
export const clientToolSchema = toolSchema.extend({
  config_schema: z.record(z.string(), z.unknown()).optional(),
});
/** Tool registry entity (client wire shape, config_schema optional). */
export type Tool = z.infer<typeof clientToolSchema>;

/** A complete, installable package: definition + pinned version + tools. */
export interface ClientPackageManifest {
  package: WorkPackage;
  version: WorkPackageVersion;
  tools: Tool[];
}

/** Wire contract for the catalog manifest endpoint response. */
export const clientPackageManifestSchema = z.object({
  package: workPackageSchema,
  version: workPackageVersionSchema,
  tools: z.array(clientToolSchema),
});

/** Normalized tool reference inside the canonical manifest (snake_case wire shape). */
export interface CanonicalToolRef {
  tool_id: string;
  tool_version: string;
  scopes: string[];
}

/** The canonical manifest object covered by `manifest_sha256` (snake_case). */
export interface CanonicalPackageManifest {
  tools: CanonicalToolRef[];
  skills: string[];
  subagent_configs: string[];
  permissions: string[];
  model_routing: Record<string, unknown>;
  budget_template: Record<string, unknown>;
  starter_prompts: string[];
  template_refs: string[];
  min_agent_version: string;
}

/**
 * Build the canonical manifest object from a (snake_case wire) version.
 * This is the exact snake_case object the catalog hashes — it must stay
 * byte-identical to `@arm/catalog`'s `canonicalManifest`
 * (packages/catalog/src/manifest.ts). The wire version fields are already
 * snake_case, so the canonical object is a structural copy of the hashed
 * fields in the same order; the hash itself is order-insensitive (sorted
 * keys deep), but the shape must match field-for-field.
 */
export function buildCanonicalManifest(version: WorkPackageVersion): CanonicalPackageManifest {
  return {
    tools: version.tools.map((ref) => ({
      tool_id: ref.tool_id,
      tool_version: ref.tool_version,
      scopes: ref.scopes,
    })),
    skills: version.skills,
    subagent_configs: version.subagent_configs,
    permissions: version.permissions,
    model_routing: version.model_routing,
    budget_template: version.budget_template,
    starter_prompts: version.starter_prompts,
    template_refs: version.template_refs,
    min_agent_version: version.min_agent_version,
  };
}

/** Strip trailing slashes so base URLs compose cleanly. */
function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

/**
 * Fetch the package manifest for a role from the control plane catalog.
 *
 * GET `${controlPlaneUrl}/api/catalog/packages/${roleKey}/manifest` with a
 * Bearer token. Throws on non-200 responses, non-JSON bodies, or responses
 * that fail the proto-composed zod schema.
 */
export async function fetchManifest(
  controlPlaneUrl: string,
  token: string,
  roleKey: string,
): Promise<ClientPackageManifest> {
  const endpoint = `${normalizeBaseUrl(controlPlaneUrl)}/api/catalog/packages/${encodeURIComponent(roleKey)}/manifest`;
  const res = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(
      `manifest fetch failed for role "${roleKey}": HTTP ${res.status} ${res.statusText}`,
    );
  }
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new Error(`manifest fetch failed for role "${roleKey}": response is not JSON`);
  }
  const parsed = clientPackageManifestSchema.safeParse(body);
  if (!parsed.success) {
    throw new Error(
      `manifest fetch failed for role "${roleKey}": invalid payload — ${parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`,
    );
  }
  return parsed.data;
}

/**
 * Recompute `manifestSha256` over the canonical manifest and compare with the
 * version's pinned hash. `false` means the manifest was tampered with or is
 * from a catalog with a different canonicalization — fail loud, never render.
 */
export function verifyManifestIntegrity(version: WorkPackageVersion): boolean {
  const recomputed = manifestSha256(buildCanonicalManifest(version));
  return recomputed === version.manifest_sha256;
}
