/**
 * Given what a client says it has installed and what the registry publishes,
 * decide what it should upgrade to.
 *
 * Pure and DB-free on purpose: this is the one piece of the check-in path with
 * real branching (yanked versions, unknown components, downgrades, missing
 * blobs), and it is the piece worth testing without standing up Postgres.
 */
import { compareSemVer } from "@arm/artifactory";
import type { ComponentUpdate, ComponentVersion, InstalledComponentRecord } from "@arm/proto";

export interface RegistryComponent {
  id: string;
  slug: string;
  kind: ComponentUpdate["kind"];
  versions: ComponentVersion[];
}

export interface UpdatePlan {
  updates: ComponentUpdate[];
  /** component_ids the client reports but the registry does not publish. */
  unknown: string[];
}

/**
 * Highest non-yanked version, or null when a component has only yanked ones.
 *
 * Yanked versions are excluded rather than merely deprioritised: yanking is
 * how a broken or compromised version is withdrawn, so offering it as an
 * upgrade target would push a known-bad artifact to every machine at once.
 */
export function latestPublishedVersion(versions: ComponentVersion[]): ComponentVersion | null {
  const usable = versions.filter((v) => !v.yanked);
  if (usable.length === 0) return null;
  return usable.reduce((best, v) => (compareSemVer(v.version, best.version) > 0 ? v : best));
}

/**
 * `clientVersion` gates updates whose `min_client_version` the reporting
 * client cannot satisfy. Such an update is still returned — an operator needs
 * to see that a machine is pinned by an old installer, which is invisible if
 * we silently drop it — but flagged so the client refuses to install it.
 */
export function computeUpdatePlan(
  installed: InstalledComponentRecord[],
  registry: RegistryComponent[],
  clientVersion = "",
): UpdatePlan {
  const byId = new Map(registry.map((c) => [c.id, c]));
  const updates: ComponentUpdate[] = [];
  const unknown: string[] = [];

  for (const have of installed) {
    const component = byId.get(have.component_id);
    if (component === undefined) {
      unknown.push(have.component_id);
      continue;
    }
    const latest = latestPublishedVersion(component.versions);
    if (latest === null) {
      // Every published version was yanked. That is not an update — it is a
      // component the operator should look at, so it reads as unknown rather
      // than silently vanishing from the report.
      unknown.push(have.component_id);
      continue;
    }
    // Strictly newer only. A client ahead of the registry (a hand-installed
    // build, or a version yanked after it shipped) is left alone: rolling it
    // backwards automatically would undo a deliberate action.
    if (compareSemVer(latest.version, have.version) <= 0) continue;

    const minClient = readMinClientVersion(latest);
    updates.push({
      component_id: component.id,
      slug: component.slug,
      kind: component.kind,
      from_version: have.version,
      to_version: latest.version,
      blob_digest: latest.blob_digest,
      changelog: latest.changelog,
      requires_client_upgrade: minClient !== null && !clientAtLeast(clientVersion, minClient),
    });
  }

  return { updates, unknown: [...new Set(unknown)] };
}

/** `min_client_version` lives in the free-form manifest, so it is read
 *  defensively: a malformed value must not crash every client's check-in. */
function readMinClientVersion(version: ComponentVersion): string | null {
  const raw = version.manifest?.["min_client_version"];
  if (typeof raw !== "string") return null;
  return /^\d+\.\d+\.\d+$/.test(raw) ? raw : null;
}

/** An unknown or unparseable client version fails the check: refusing an
 *  update is recoverable, installing one the client cannot run is not. */
function clientAtLeast(clientVersion: string, minimum: string): boolean {
  if (!/^\d+\.\d+\.\d+$/.test(clientVersion)) return false;
  return compareSemVer(clientVersion, minimum) >= 0;
}
