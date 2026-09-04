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

/** One `component_install` row, reduced to the fields a roll-up needs. */
export interface InstallFact {
  sub_account_id: string;
  component_id: string;
  version: string;
  last_seen_at: string;
}

export interface InstallSummaryRow {
  component_id: string;
  /** null when the registry no longer publishes this component at all. */
  slug: string | null;
  kind: RegistryComponent["kind"] | null;
  /** null when the component is unknown OR every version of it was yanked. */
  latest_version: string | null;
  in_registry: boolean;
  installs: number;
  stale: number;
  versions: { version: string; count: number; stale: boolean }[];
  last_seen_at: string;
}

export interface InstallSummary {
  /** Distinct agents reporting, not rows — one agent installs many components. */
  agents: number;
  installs: number;
  stale: number;
  components: InstallSummaryRow[];
}

/**
 * Roll a tenant's raw install rows up into one row per component: who has it,
 * at which versions, and how many machines are behind the registry.
 *
 * Pure for the same reason `computeUpdatePlan` is: the interesting part is the
 * grouping and the staleness rule, not the query that fetched the rows. It
 * applies the same yanked-version rule as the update path, so the dashboard
 * and the client can never disagree about what "latest" means.
 */
export function summarizeInstalls(
  installs: InstallFact[],
  registry: RegistryComponent[],
): InstallSummary {
  const byId = new Map(registry.map((c) => [c.id, c]));
  const groups = new Map<string, InstallFact[]>();
  for (const row of installs) {
    const list = groups.get(row.component_id);
    if (list === undefined) groups.set(row.component_id, [row]);
    else list.push(row);
  }

  const components: InstallSummaryRow[] = [];
  for (const [componentId, rows] of groups) {
    const component = byId.get(componentId);
    const latest = component ? latestPublishedVersion(component.versions) : null;

    const counts = new Map<string, number>();
    for (const r of rows) counts.set(r.version, (counts.get(r.version) ?? 0) + 1);

    const versions = [...counts.entries()]
      .map(([version, count]) => ({
        version,
        count,
        stale: latest !== null && compareSemVer(latest.version, version) > 0,
      }))
      .sort((a, b) => compareSemVer(b.version, a.version));

    components.push({
      component_id: componentId,
      slug: component?.slug ?? null,
      kind: component?.kind ?? null,
      latest_version: latest?.version ?? null,
      in_registry: component !== undefined,
      versions,
      installs: rows.length,
      stale: versions.reduce((n, v) => (v.stale ? n + v.count : n), 0),
      last_seen_at: rows.reduce((a, r) => (r.last_seen_at > a ? r.last_seen_at : a), ""),
    });
  }

  // Most stale first — this list is read to find what needs acting on. Next
  // come components with no installable version (unknown to the registry, or
  // entirely yanked): zero stale machines, but they need a human rather than
  // an update, and sorting them by staleness alone would bury them.
  components.sort(
    (a, b) =>
      b.stale - a.stale ||
      Number(a.latest_version !== null) - Number(b.latest_version !== null) ||
      (a.slug ?? a.component_id).localeCompare(b.slug ?? b.component_id),
  );

  return {
    agents: new Set(installs.map((r) => r.sub_account_id)).size,
    installs: installs.length,
    stale: components.reduce((n, c) => n + c.stale, 0),
    components,
  };
}
