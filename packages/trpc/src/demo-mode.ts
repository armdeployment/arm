/**
 * ARM_DEMO — guaranteed-read-only demo mode (guide 04 §demo, docs/guides/
 * 04-public-site-demo.md). Flagged during Wave-1 integration as a genuine
 * cross-guide gap: guide 04 asks for it, guide 02 never specs it, and no
 * Wave-1 agent owned it. Landed post-integration.
 *
 * The guarantee is structural, not per-procedure: every router's
 * `tenantProcedure` chain adds `demoModeGuard` after its auth check. When
 * `ARM_DEMO=1` and the incoming call is a mutation, every store registered
 * here is snapshotted before the resolver runs and restored immediately
 * after, regardless of what the resolver did. The resolver still executes
 * and returns its real, computed response — a promote/approve/issue click
 * in the demo looks and feels real — but nothing persists for the next
 * visitor or the next request. Registering a store is the only thing a
 * router needs to do to be protected; forgetting to register a new mutable
 * store is the one way this guarantee can silently fail, which is what
 * `scripts/guardrails/src/checks/demo-mode-readonly.ts` checks for.
 */

export function isDemoMode(): boolean {
  return process.env["ARM_DEMO"] === "1";
}

interface RegisteredStore {
  snapshot(): unknown;
  restore(snapshot: unknown): void;
}

const registry: RegisteredStore[] = [];

/** Register a mutable array (the `const store: T[] = [...]` pattern used
 *  by every router's in-memory fixture store) for demo-mode reset. */
export function registerDemoArray<T>(store: T[]): void {
  registry.push({
    snapshot: () => [...store],
    restore: (snap) => {
      store.length = 0;
      store.push(...(snap as T[]));
    },
  });
}

/** Register a mutable Map (setup-token stores, activation-code indexes,
 *  rate-limit counters) for demo-mode reset. */
export function registerDemoMap<K, V>(store: Map<K, V>): void {
  registry.push({
    snapshot: () => new Map(store),
    restore: (snap) => {
      store.clear();
      for (const [k, v] of snap as Map<K, V>) store.set(k, v);
    },
  });
}

/** Snapshot every registered store. Call before running a mutation resolver. */
export function snapshotAllDemoStores(): unknown[] {
  return registry.map((r) => r.snapshot());
}

/** Restore every registered store from a prior `snapshotAllDemoStores()` call. */
export function restoreAllDemoStores(snapshots: unknown[]): void {
  registry.forEach((r, i) => r.restore(snapshots[i]));
}

/** Test-only: how many stores are currently registered. */
export function demoStoreCount(): number {
  return registry.length;
}
