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

/**
 * Deep copy for snapshots.
 *
 * `[...store]` and `new Map(store)` are SHALLOW: they copy the container and
 * share every element. That was invisible while routers only ever pushed and
 * spliced, and wrong the moment one mutated a field on an existing object —
 * `request.status = "approved"` changes the object the snapshot is holding
 * too, so "restore" puts the mutated object straight back.
 *
 * ARM_DEMO's promise is that every mutation is rolled back. A shallow
 * snapshot quietly narrowed that to "every mutation that replaces an element",
 * which is not a distinction anyone writing a resolver would think to make.
 *
 * `structuredClone` falls back to the shallow copy for anything it cannot
 * clone (a store holding functions or class instances), because a demo store
 * that throws on snapshot would take down every mutation in the app. The
 * fixture stores this guards are all plain JSON-shaped data.
 */
function deepSnapshot<T>(value: T, shallow: () => T): T {
  try {
    return structuredClone(value);
  } catch {
    return shallow();
  }
}

/** Register a mutable array (the `const store: T[] = [...]` pattern used
 *  by every router's in-memory fixture store) for demo-mode reset. */
export function registerDemoArray<T>(store: T[]): void {
  registry.push({
    snapshot: () => deepSnapshot(store, () => [...store]),
    restore: (snap) => {
      store.length = 0;
      // Cloned again on restore: without this, two successive mutations would
      // both restore from — and mutate — the same snapshot objects.
      store.push(...deepSnapshot(snap as T[], () => [...(snap as T[])]));
    },
  });
}

/** Register a mutable Map (setup-token stores, activation-code indexes,
 *  rate-limit counters) for demo-mode reset. */
export function registerDemoMap<K, V>(store: Map<K, V>): void {
  registry.push({
    snapshot: () => deepSnapshot(store, () => new Map(store)),
    restore: (snap) => {
      store.clear();
      const restored = deepSnapshot(snap as Map<K, V>, () => new Map(snap as Map<K, V>));
      for (const [k, v] of restored) store.set(k, v);
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
