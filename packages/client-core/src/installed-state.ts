/**
 * The client's record of what it has installed, and at which version.
 *
 * Before this file, `installComponents` (components.ts) wrote bytes to disk
 * and returned paths that `runSetup` put in a `SetupResult` nobody persisted.
 * Nothing on the machine — and so nothing on the server — could answer "which
 * version of this skill is on that laptop?". The lockfile is that answer.
 *
 * It lives at `<agentHome>/.arm/installed.json` rather than beside the
 * components themselves: an operator clearing `skills/` to force a reinstall
 * should not silently also erase the inventory the control plane reconciles
 * against.
 *
 * Writes are atomic (temp file + rename). A torn lockfile is worse than a
 * missing one, because a half-written JSON file reads as "nothing installed"
 * and triggers a full reinstall of components already on disk.
 */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  installedStateSchema,
  type InstalledComponentRecord,
  type InstalledState,
} from "@arm/proto";

export type { InstalledComponentRecord, InstalledState };

/** Lockfile path for an agent home. Exported so `arm doctor` can name it. */
export function installedStatePath(agentHome: string): string {
  return join(agentHome, ".arm", "installed.json");
}

/**
 * Read the lockfile. Returns null when absent — a fresh machine, which is a
 * normal state, not an error.
 *
 * Throws on a lockfile that exists but does not parse, rather than treating
 * it as absent: silently overwriting a corrupt-but-present inventory would
 * lose the record of everything already installed.
 */
export async function readInstalledState(agentHome: string): Promise<InstalledState | null> {
  const path = installedStatePath(agentHome);
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") return null;
    throw err;
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `installed-state lockfile at ${path} is not valid JSON (${err instanceof Error ? err.message : String(err)}). ` +
        `Delete it to force a clean reinstall, or repair it — ARM will not overwrite an inventory it cannot read.`,
    );
  }
  // A future client may write schema 2. Refusing beats guessing: a misread
  // lockfile either reinstalls what is already there or skips a real update.
  const declared = (json as { schema?: unknown })?.schema;
  if (typeof declared === "number" && declared > 1) {
    throw new Error(
      `installed-state lockfile at ${path} declares schema ${declared}, but this client only understands 1. Upgrade the ARM client.`,
    );
  }
  const parsed = installedStateSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(
      `installed-state lockfile at ${path} does not match schema 1: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    );
  }
  return parsed.data;
}

/** Write the lockfile atomically, creating `<agentHome>/.arm/` if needed. */
export async function writeInstalledState(
  agentHome: string,
  state: InstalledState,
): Promise<string> {
  const path = installedStatePath(agentHome);
  await mkdir(dirname(path), { recursive: true });
  const body = JSON.stringify(installedStateSchema.parse(state), null, 2) + "\n";
  const tmp = `${path}.${process.pid}.tmp`;
  await writeFile(tmp, body, { mode: 0o600 });
  await rename(tmp, path);
  return path;
}

/**
 * Merge freshly-installed components into an existing inventory, keyed by
 * `component_id`. Upsert rather than replace: a run that installs one
 * component must not erase the record of the other nine.
 *
 * Callers that want a replace (a full `runSetup`, which resolves the whole
 * manifest) pass `previous: null`.
 */
export function mergeInstalled(
  previous: InstalledComponentRecord[] | null,
  installed: InstalledComponentRecord[],
): InstalledComponentRecord[] {
  const byId = new Map<string, InstalledComponentRecord>();
  for (const entry of previous ?? []) byId.set(entry.component_id, entry);
  for (const entry of installed) byId.set(entry.component_id, entry);
  return [...byId.values()].sort((a, b) => a.slug.localeCompare(b.slug));
}
