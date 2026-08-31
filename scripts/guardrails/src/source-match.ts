/**
 * Whitespace-tolerant source matching for the guards that read schema files.
 *
 * Three guards assert that a Drizzle column carries a particular modifier by
 * looking for the literal call chain in the schema source:
 *
 *   taxonomy-scope      uuid("tenant_id").notNull()
 *   package-integrity   text("manifest_sha256").notNull()
 *   tool-endpoint-scope text("data_classification").notNull()
 *
 * The chain is one expression to TypeScript but not to a plain `includes()`:
 * the moment it grows past the print width, Prettier wraps it onto its own
 * lines and the needle stops matching a schema that is still exactly correct.
 * That happened to `taxonomy-scope` when `.references(() => tenantTable.id)`
 * pushed the `tenant_id` column over 100 columns — the guard went red on
 * formatting, not on the invariant it defends.
 *
 * `normalizeChains` closes only that gap: it joins a chain back together by
 * dropping the whitespace that precedes a `.`, and touches nothing else. It
 * deliberately does NOT collapse all whitespace — that would also flatten
 * comments and string literals, so a guard could be satisfied by prose
 * describing the column rather than by the column itself.
 */

/**
 * Joins wrapped method chains onto one line so a literal needle matches
 * regardless of where the formatter broke it.
 *
 *   uuid("tenant_id")\n  .notNull()\n  .references(fn)
 *     → uuid("tenant_id").notNull().references(fn)
 */
export function normalizeChains(source: string): string {
  return source.replace(/\s+\./g, ".");
}

/** `String.includes`, but blind to how the formatter wrapped a call chain. */
export function includesChain(haystack: string, needle: string): boolean {
  return normalizeChains(haystack).includes(normalizeChains(needle));
}

/** Counts non-overlapping occurrences of `needle`, ignoring chain wrapping. */
export function countChain(haystack: string, needle: string): number {
  return normalizeChains(haystack).split(normalizeChains(needle)).length - 1;
}
