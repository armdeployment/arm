/**
 * Component version resolution — `slug@range` → concrete component_version
 * (guide 01 §2.3).
 *
 * Pure function over a supplied version list, so it is unit-testable without
 * a DB. Picks the highest non-yanked version satisfying the semver range,
 * scoped to the tenant, falling back to `first_party` components when the
 * tenant has no own copy of that slug.
 *
 * No external semver dependency (`packages/artifactory`'s deps are fixed —
 * `@arm/proto`/`@arm/config`/`@arm/db` — guide 01 §2) — a small comparator +
 * range matcher is implemented locally. Supported range grammar: an exact
 * version (`"1.2.3"`, matches only that version — the convention already
 * used by pinned seeds elsewhere in the repo, e.g.
 * `packages/db/src/schema/catalog.ts` `WorkPackageComponentSeedInput.componentVersion`),
 * `^1.2.3` (same major, >= given), `~1.2.3` (same major.minor, >= given),
 * `>=`/`<=`/`>`/`<` prefixed exact bounds, and `*` (any).
 */

export interface ResolvableComponentVersion {
  componentId: string;
  /** Component Registry slug (`component.slug`). */
  slug: string;
  version: string;
  yanked: boolean;
  /** `null` tenantId marks a control-plane first-party fallback candidate. */
  tenantId: string | null;
  sourceKind: "first_party" | "tenant_authored" | "imported";
}

export interface ResolveResult {
  componentId: string;
  version: string;
}

interface SemVer {
  major: number;
  minor: number;
  patch: number;
}

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)$/;

function parseSemVer(v: string): SemVer {
  const m = SEMVER_RE.exec(v);
  if (!m) throw new Error(`not a valid semver triplet: "${v}"`);
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

/** -1 / 0 / 1, standard comparator ordering. */
export function compareSemVer(a: string, b: string): number {
  const pa = parseSemVer(a);
  const pb = parseSemVer(b);
  if (pa.major !== pb.major) return pa.major - pb.major;
  if (pa.minor !== pb.minor) return pa.minor - pb.minor;
  return pa.patch - pb.patch;
}

/** Does `version` satisfy `range` under the grammar documented above? */
export function satisfiesRange(version: string, range: string): boolean {
  const r = range.trim();
  if (r === "*" || r === "") return SEMVER_RE.test(version);
  if (r.startsWith(">=")) return compareSemVer(version, r.slice(2).trim()) >= 0;
  if (r.startsWith("<=")) return compareSemVer(version, r.slice(2).trim()) <= 0;
  if (r.startsWith(">")) return compareSemVer(version, r.slice(1).trim()) > 0;
  if (r.startsWith("<")) return compareSemVer(version, r.slice(1).trim()) < 0;
  if (r.startsWith("^")) {
    const base = parseSemVer(r.slice(1).trim());
    const v = parseSemVer(version);
    return v.major === base.major && compareSemVer(version, r.slice(1).trim()) >= 0;
  }
  if (r.startsWith("~")) {
    const base = parseSemVer(r.slice(1).trim());
    const v = parseSemVer(version);
    return (
      v.major === base.major &&
      v.minor === base.minor &&
      compareSemVer(version, r.slice(1).trim()) >= 0
    );
  }
  // Bare version — EXACT match only (the pinned-seed convention).
  return version === r;
}

export interface ResolveOptions {
  tenantId: string;
}

/**
 * Resolve `slug@range` against a supplied version list. Non-yanked versions
 * only. Prefers the tenant's own component; falls back to a `first_party`
 * (control-plane, `tenantId === null`) candidate when the tenant has none.
 * Among candidates, picks the highest version satisfying `range`. Returns
 * `null` on no match — callers (e.g. `@arm/catalog`'s `buildPackageVersionFromSeed`)
 * turn that into a hard "unmapped slug" provisioning error (guide 01 §4.4).
 */
export function resolve(
  slug: string,
  range: string,
  versions: readonly ResolvableComponentVersion[],
  opts: ResolveOptions,
): ResolveResult | null {
  const candidates = versions.filter((v) => v.slug === slug && !v.yanked);
  const tenantOwn = candidates.filter((v) => v.tenantId === opts.tenantId);
  const firstPartyFallback = candidates.filter(
    (v) => v.tenantId === null && v.sourceKind === "first_party",
  );
  const pool = tenantOwn.length > 0 ? tenantOwn : firstPartyFallback;

  const matching = pool.filter((v) => satisfiesRange(v.version, range));
  if (matching.length === 0) return null;

  const best = [...matching].sort((a, b) => compareSemVer(b.version, a.version))[0]!;
  return { componentId: best.componentId, version: best.version };
}
