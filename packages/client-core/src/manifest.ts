/**
 * Package manifest fetch + integrity verification (D9 Phase 1.6, updated D10
 * — manifest v2, docs/guides/00-shared-contracts.md §4, docs/guides/
 * 03-client-downloader.md §5).
 *
 * The client downloads the package manifest from the control plane catalog
 * endpoint, validates it against the proto contracts, and re-verifies the
 * content hash (`manifest_sha256`) before rendering any config. Tampered or
 * truncated manifests fail loud here, before a single credential is minted.
 *
 * Canonical manifest v2 shape (hashed by `manifestSha256`, shared with
 * `@arm/catalog`): the eight snake_case wire fields from guide 00 §4 —
 * `manifest_version`, `components` (sorted by component_id), `permissions`
 * (sorted), `model_routing`, `budget_template`, `starter_prompts` (insertion
 * order preserved), `min_agent_version`, `job_functions` (sorted).
 * `buildCanonicalManifest` must stay byte-identical to `@arm/catalog`'s
 * `canonicalManifest` (packages/catalog/src/manifest.ts, owned by the
 * `library` Wave-1 agent) — both are tested against the shared golden vector
 * at packages/proto/test/fixtures/manifest-v2-golden.json so drift is caught
 * without either side importing the other (dependency-direction guardrail).
 */

import { z } from "zod";
import {
  workPackageSchema,
  workPackageVersionSchema,
  componentSchema,
  componentVersionSchema,
  type WorkPackage,
  type WorkPackageVersion,
  type Component,
  type ComponentVersion,
  type PackageManifestV2,
} from "@arm/proto";
import { manifestSha256 } from "./hash.js";

export type { WorkPackage, WorkPackageVersion, Component, ComponentVersion };

/** Component kinds that are *callable* (tool:* verbs apply) — these become
 *  opencode MCP entries. Everything else is *installable* (materialized to
 *  disk under the agent home) — guide 00 §1 / guide 03 §5. */
export const CALLABLE_COMPONENT_KINDS = new Set(["mcp", "http_api", "cli", "connector"]);

export function isCallableComponentKind(kind: string): boolean {
  return CALLABLE_COMPONENT_KINDS.has(kind);
}

/**
 * One resolved component: the registry entity (name, endpoint, auth
 * strategy) plus the exact pinned version's data (blob digest, config
 * schema) for the version referenced by this package's `components[]`.
 */
export interface ResolvedComponent {
  component: Component;
  version: ComponentVersion;
}

export const resolvedComponentSchema = z.object({
  component: componentSchema,
  version: componentVersionSchema,
});

/** A complete, installable package: definition + pinned version + resolved components. */
export interface ClientPackageManifest {
  package: WorkPackage;
  version: WorkPackageVersion;
  components: ResolvedComponent[];
}

/** Wire contract for the catalog manifest endpoint response. */
export const clientPackageManifestSchema = z.object({
  package: workPackageSchema,
  version: workPackageVersionSchema,
  components: z.array(resolvedComponentSchema),
});

/**
 * Build the canonical manifest v2 object from a (snake_case wire) version —
 * exactly the eight fields in guide 00 §4, deterministically ordered:
 * `components` sorted by `component_id`, `permissions`/`job_functions`
 * sorted lexicographically, `starter_prompts` keeps insertion order. This is
 * the object `manifest_sha256` covers; the hash itself is order-insensitive
 * on object keys (sortKeysDeep) but NOT on array element order, so the
 * arrays must be canonicalized here, not left in DB/wire order.
 */
export function buildCanonicalManifest(version: WorkPackageVersion): PackageManifestV2 {
  const components = version.components
    .map((ref) => ({
      component_id: ref.component_id,
      version: ref.version,
      kind: ref.kind,
      scopes: [...ref.scopes],
    }))
    .sort((a, b) =>
      a.component_id < b.component_id ? -1 : a.component_id > b.component_id ? 1 : 0,
    );

  return {
    manifest_version: 2,
    components,
    permissions: [...version.permissions].sort(),
    model_routing: version.model_routing,
    budget_template: version.budget_template,
    starter_prompts: [...version.starter_prompts],
    min_agent_version: version.min_agent_version,
    job_functions: [...version.job_functions].sort(),
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
 * that fail the proto-composed zod schema. This is the advanced/flags path
 * (guide 03 §1) — the primary token path resolves a manifest directly via
 * `resolveFromSetupToken` (setup-token.ts) and never calls this.
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
 * Recompute `manifestSha256` over the canonical manifest v2 and compare with
 * the version's pinned hash. `false` means the manifest was tampered with or
 * is from a catalog with a different canonicalization — fail loud, never
 * render.
 */
export function verifyManifestIntegrity(version: WorkPackageVersion): boolean {
  const recomputed = manifestSha256(buildCanonicalManifest(version));
  return recomputed === version.manifest_sha256;
}
