/**
 * Component installation (docs/guides/03-client-downloader.md §5).
 *
 * Each `components[]` entry in a package version is resolved (manifest.ts)
 * and then installed by kind:
 *   - callable (mcp/http_api/cli/connector) → an opencode MCP entry
 *     (opencode.ts); no on-disk materialization here.
 *   - installable (skill/subagent/template/prompt_pack/plugin) → pull the
 *     blob from the data-plane artifact cache (`GET /artifacts/:digest`),
 *     verify its sha256, and write it into the agent home's corresponding
 *     directory.
 *
 * A digest mismatch is a HARD failure (`DIGEST_MISMATCH`) — never install
 * unverified bytes (Invariant: package-integrity).
 */

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ArmClientError } from "./errors.js";
import { isCallableComponentKind, type ResolvedComponent } from "./manifest.js";

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

/**
 * Fetch a component blob from the data-plane artifact cache and verify its
 * digest matches exactly. Throws `ArmClientError("DIGEST_MISMATCH", …)` on
 * any mismatch or malformed digest — the caller must not write the bytes.
 */
export async function pullComponentBlob(dataPlaneUrl: string, digest: string): Promise<Buffer> {
  if (!/^sha256:[0-9a-f]{64}$/.test(digest)) {
    throw new ArmClientError(
      "DIGEST_MISMATCH",
      `component blob digest "${digest}" is not a well-formed sha256: digest`,
    );
  }
  const endpoint = `${normalizeBaseUrl(dataPlaneUrl)}/artifacts/${encodeURIComponent(digest)}`;
  let res: Response;
  try {
    res = await fetch(endpoint);
  } catch (err) {
    throw new ArmClientError(
      "PROXY_UNREACHABLE",
      `could not reach the artifact cache for "${digest}": ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!res.ok) {
    throw new ArmClientError(
      "DIGEST_MISMATCH",
      `artifact fetch failed for "${digest}": HTTP ${res.status} ${res.statusText}`,
    );
  }
  const bytes = Buffer.from(await res.arrayBuffer());
  const actual = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  if (actual !== digest) {
    throw new ArmClientError(
      "DIGEST_MISMATCH",
      `component blob digest mismatch: expected ${digest}, got ${actual} — refusing to install unverified bytes`,
    );
  }
  return bytes;
}

/** The agent-home subdirectory an installable component kind materializes into. */
export function installDirFor(kind: string): string | null {
  switch (kind) {
    case "skill":
      return "skills";
    case "subagent":
      return "subagents";
    case "template":
      return "templates";
    case "prompt_pack":
      return "prompt_packs";
    case "plugin":
      return "plugins";
    default:
      return null; // callable kinds install as MCP entries instead (opencode.ts)
  }
}

export interface InstalledComponent {
  resolved: ResolvedComponent;
  /** Absolute path written on disk, or null for callable / no-blob components. */
  installedPath: string | null;
}

/**
 * Install one resolved component. No-op (returns `installedPath: null`) for
 * callable kinds or components with no blob — those are wired into the
 * rendered opencode config as MCP entries instead.
 */
export async function installComponent(
  resolved: ResolvedComponent,
  args: { dataPlaneUrl: string; agentHome: string },
): Promise<InstalledComponent> {
  const { component, version } = resolved;
  if (isCallableComponentKind(component.kind)) {
    return { resolved, installedPath: null };
  }
  const dir = installDirFor(component.kind);
  if (dir === null || version.blob_digest === null) {
    return { resolved, installedPath: null };
  }
  const bytes = await pullComponentBlob(args.dataPlaneUrl, version.blob_digest);
  const targetDir = join(args.agentHome, dir);
  try {
    await mkdir(targetDir, { recursive: true });
    const targetPath = join(targetDir, component.slug);
    await writeFile(targetPath, bytes);
    return { resolved, installedPath: targetPath };
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === "EACCES") {
      throw new ArmClientError(
        "DISK_PERMISSION",
        `could not write component "${component.slug}" to ${targetDir}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    throw err;
  }
}

/** Install every resolved component in a manifest (installable kinds only). */
export async function installComponents(
  components: ResolvedComponent[],
  args: { dataPlaneUrl: string; agentHome: string },
): Promise<InstalledComponent[]> {
  const results: InstalledComponent[] = [];
  for (const resolved of components) {
    results.push(await installComponent(resolved, args));
  }
  return results;
}
