/**
 * Check in with the control plane and apply whatever it says is stale.
 *
 * Deliberately client-initiated. An employee laptop has no inbound route — it
 * is behind NAT, asleep half the day, and runs no ARM daemon — so there is no
 * socket for the control plane to push down. What makes updates feel automatic
 * is that this runs on its own during `arm setup` and `arm doctor`, and can be
 * put on a schedule (docs/component-updates.md). The server still decides
 * *what* changes; the client only decides *when* to ask.
 */
import { readInstalledState, writeInstalledState, mergeInstalled } from "./installed-state.js";
import { pullComponentBlob, installDirFor } from "./components.js";
import { checkInResponseSchema, type ComponentUpdate } from "@arm/proto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

export interface UpdateArgs {
  agentHome: string;
  controlPlaneUrl: string;
  token: string;
  /** Artifact cache base URL — required to actually download new blobs. */
  dataPlaneUrl?: string;
  clientVersion?: string;
  /** Report what would change without writing anything. */
  dryRun?: boolean;
}

export interface UpdateResult {
  /** Null when this machine has no lockfile — nothing has been installed yet. */
  checkedAt: string | null;
  available: ComponentUpdate[];
  applied: ComponentUpdate[];
  /** Updates deliberately not applied, each with the reason. */
  skipped: { update: ComponentUpdate; reason: string }[];
  /** Installed components the registry no longer publishes. Reported only. */
  unknown: string[];
}

/** POST the inventory; returns what the server says is stale. */
export async function checkIn(args: {
  controlPlaneUrl: string;
  token: string;
  tenantId: string;
  subAccountId: string;
  clientVersion: string;
  components: Parameters<typeof writeInstalledState>[1]["components"];
}): Promise<{ updates: ComponentUpdate[]; unknown: string[]; checkedAt: string }> {
  const endpoint = `${normalizeBaseUrl(args.controlPlaneUrl)}/api/components/check-in`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sub_account_id: args.subAccountId,
      client_version: args.clientVersion,
      components: args.components,
    }),
  });
  if (!res.ok) {
    throw new Error(`component check-in failed: HTTP ${res.status} ${res.statusText}`);
  }
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new Error("component check-in failed: response is not JSON");
  }
  const parsed = checkInResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new Error(
      `component check-in failed: invalid payload — ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    );
  }
  return {
    updates: parsed.data.updates,
    unknown: parsed.data.unknown,
    checkedAt: parsed.data.checked_at,
  };
}

/**
 * Check in, then install every update that can be safely installed.
 *
 * An update is skipped rather than forced when the client is too old for it,
 * when it carries no blob (callable components are config entries — rewriting
 * the rendered config is `runSetup`'s job, not a partial update's), or when no
 * artifact-cache URL is known. Skipping is reported, never silent: an update
 * that quietly did not happen is the failure mode this whole feature exists
 * to remove.
 */
export async function runUpdate(args: UpdateArgs): Promise<UpdateResult> {
  const state = await readInstalledState(args.agentHome);
  if (state === null) {
    return { checkedAt: null, available: [], applied: [], skipped: [], unknown: [] };
  }

  const clientVersion = args.clientVersion ?? state.client_version;
  const { updates, unknown, checkedAt } = await checkIn({
    controlPlaneUrl: args.controlPlaneUrl,
    token: args.token,
    tenantId: state.tenant_id,
    subAccountId: state.sub_account_id,
    clientVersion,
    components: state.components,
  });

  const applied: ComponentUpdate[] = [];
  const skipped: UpdateResult["skipped"] = [];
  if (args.dryRun === true) {
    return { checkedAt, available: updates, applied, skipped, unknown };
  }

  for (const update of updates) {
    if (update.requires_client_upgrade) {
      skipped.push({ update, reason: "needs a newer ARM client — upgrade the client first" });
      continue;
    }
    const dir = installDirFor(update.kind);
    if (dir === null || update.blob_digest === null) {
      skipped.push({
        update,
        reason: "callable component — re-run `arm setup` to update the rendered config",
      });
      continue;
    }
    if (args.dataPlaneUrl === undefined) {
      skipped.push({ update, reason: "no artifact cache URL (set ARM_DATA_PLANE_URL)" });
      continue;
    }
    // pullComponentBlob verifies the digest and throws rather than return
    // unverified bytes, so a corrupted or substituted blob never lands.
    const bytes = await pullComponentBlob(args.dataPlaneUrl, update.blob_digest);
    const targetDir = join(args.agentHome, dir);
    await mkdir(targetDir, { recursive: true });
    await writeFile(join(targetDir, update.slug), bytes);
    applied.push(update);
  }

  if (applied.length > 0) {
    const now = new Date().toISOString();
    const bumped = applied.map((u) => ({
      component_id: u.component_id,
      slug: u.slug,
      kind: u.kind,
      version: u.to_version,
      blob_digest: u.blob_digest,
      installed_path: join(args.agentHome, installDirFor(u.kind)!, u.slug),
      installed_at: now,
    }));
    await writeInstalledState(args.agentHome, {
      ...state,
      client_version: clientVersion,
      updated_at: now,
      components: mergeInstalled(state.components, bumped),
    });
  }

  return { checkedAt, available: updates, applied, skipped, unknown };
}
