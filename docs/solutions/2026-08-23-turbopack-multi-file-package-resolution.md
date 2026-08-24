---
title: "Turbopack + multi-file @arm/* packages — ship a real dist build"
date: 2026-08-23
status: decided
supersedes: none
---

# Turbopack can't resolve `.js`-extension imports to `.ts` files

## Decision

Any `@arm/*` workspace package whose files use NodeNext-style relative
imports (`export { x } from "./foo.js"` resolving to `foo.ts`, per
`tsconfig.base.json`) **and** has more than one source file must ship a real
build — `tsup` emitting `dist/index.js` (+ `.d.ts`) — instead of pointing
`package.json` `main`/`types`/`exports` straight at raw `src/index.ts`.
Single-file packages (no internal relative imports) are unaffected and can
keep shipping raw `.ts`.

Converted so far: `@arm/agent-sdk`, `@arm/catalog`, `@arm/client-core`,
`@arm/db`, `@arm/policy`, `@arm/trpc`. Any new multi-file package (e.g. a
future `@arm/questionnaire` for `apps/onboarding`) needs the same treatment
**before** a Next.js app imports it as runtime code.

## Context

`apps/control-plane/web` (Next.js 16.2.12, Turbopack) failed to build the
moment it imported `@arm/trpc` (multi-file, `.js`-extension internal
imports) via its tRPC API route:

```
Module not found: Can't resolve './catalog-router.js'
```

Root cause: Turbopack has no equivalent of webpack's
`resolve.extensionAlias` (which lets a `.js` specifier resolve to a sibling
`.ts` file). This is confirmed, open, and tracked upstream — see
[vercel/next.js#82945](https://github.com/vercel/next.js/issues/82945)
(Linear PACK-5449, "Confirmed by team", no fix version). Next.js's own
`experimental.extensionAlias` config option is explicitly listed as
unsupported under Turbopack (`next/dist/lib/turbopack-warning.js`).

Packages whose internal relative imports omit the extension (e.g.
`@arm/profiles`, `@arm/classifier` — both use `moduleResolution: "bundler"`
in their own `tsconfig.json` rather than extending the NodeNext
`tsconfig.base.json`) don't hit this; Turbopack's default extension
resolution handles those fine. It's specifically the explicit-`.js`
NodeNext convention colliding with raw-`.ts`-as-`main` that breaks.

## Options considered

- **(a) Real build (chosen)** — `tsup` bundles each package to a single
  `dist/index.js` per entry point (esbuild inlines all internal relative
  imports, so the `.js`→`.ts` question never reaches Turbopack). Fixes the
  bug for every consumer (Turbopack, webpack, plain Node), not just Next.js.
- **(b) Turbopack config workaround** — tried `turbopack.resolveExtensions`
  (wrong knob — only affects extension-less specifiers, not explicit `.js`
  ones) and searched for a `resolveAlias`-based wildcard workaround; none
  exists today (confirmed both by our own testing and by the upstream issue
  thread, where the reporter also couldn't get `resolveAlias` to work).
- **(c) Pin/upgrade Next.js** — not available; the upstream issue is open
  with no fix version.

## Implementation notes

- `tsup.config.ts` per package: `entry`, `format: ["esm"]`, `dts: false`,
  `clean: true`, `outDir: "dist"`.
- `.d.ts` generation is **not** done via `tsup`'s built-in `dts`/
  `--experimental-dts` — both crash in this repo, because they go through
  the TypeScript Compiler API (`rollup-plugin-dts`, or `parseJsonConfigFileContent`
  directly), and the pinned `typescript@7.0.2` here is the native/Go preview
  compiler, which only implements the CLI surface (see `useTypeScriptCli` in
  `apps/control-plane/web/next.config.ts`). Instead, each package has a
  `tsconfig.build.json` (`extends` the package's own `tsconfig.json`,
  `noEmit: false`, `emitDeclarationOnly: true`, `outDir: "dist"`,
  `rootDir: "src"`) and `"build": "tsup && (tsc --project tsconfig.build.json || true)"`.
- The `|| true` matters: `tsc` still emits best-effort `.d.ts` output even
  when there are type errors (no `noEmitOnError` is set anywhere in this
  repo), but its exit code would otherwise fail the package's `build`
  script. `build` (JS/`.d.ts` emission) and `typecheck` (the strict gate)
  are intentionally decoupled — the same split CI already relies on
  (`typecheck.yml` runs `pnpm typecheck` separately from `pnpm build`).
- Root `package.json` gained `"postinstall": "turbo run build --filter='./packages/*'"`.
  Without it, a bare `pnpm --filter <app> test` (bypassing turbo's own
  `dependsOn: ["^build"]` on the `test`/`typecheck` tasks) breaks the moment
  it imports a converted package fresh after clone, with a cryptic
  `Failed to resolve entry for package "@arm/..."`. The postinstall hook is
  scoped to `./packages/*` only (never `apps/*`) so it can't turn `pnpm
  install` into a slow `next build`.
- `dist/` was already gitignored; nothing new to ignore.

## Consequences

- Pre-built declarations also **isolate** each package's type errors from
  its consumers. `@arm/catalog` has pre-existing type errors against
  `@arm/proto`'s manifest-v2 schema (unrelated D10 migration drift, not
  fixed here) — before this change those errors leaked into every
  transitive consumer's `tsc --noEmit` (`@arm/trpc`, `@arm/guardrails`,
  `apps/control-plane/web`, `apps/cli`, `apps/data-plane/plugin-ingest` all
  failed typecheck because of it). After this change only `@arm/catalog`
  and `@arm/client-core` themselves report the error — everything
  downstream typechecks clean again.
- That same drift still causes a **runtime** failure
  (`@arm/client-core`'s `manifest.ts` does `toolSchema.extend(...)` where
  `toolSchema` is `undefined`) in anything that actually imports
  `@arm/client-core` — `apps/cli`, `apps/data-plane/plugin-ingest`. This is
  pre-existing (reproduces identically on a clean `git stash` of this
  change) and out of scope here; it needs a `@arm/proto`/`@arm/catalog`
  schema-alignment fix, tracked separately.
