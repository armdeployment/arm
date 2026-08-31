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
  `rootDir: "src"`) and `"build": "tsup && tsc --project tsconfig.build.json"`.
- **Superseded (2026-08-31): the `tsc` step was originally wrapped `|| true`.**
  The reason was real at the time — `@arm/catalog` and `@arm/client-core`
  carried pre-existing type errors from the D10 manifest-v2 migration, and
  `tsc` emits best-effort `.d.ts` anyway (no `noEmitOnError` is set in this
  repo), so swallowing the exit code kept `build` and `typecheck` decoupled
  rather than blocking every downstream app on two packages' drift.

  That drift is gone: all ten packages now compile clean under
  `tsconfig.build.json`, so the wrapper protects nothing and costs something.
  It let a **failed** declaration build produce a dist/ that turbo then cached
  as a successful one, so consumers hit `TS7016` against a package that had
  quietly shipped no types — far from the cause and with no failing build to
  point at. The `|| true` is removed.

  Note what removing it does _not_ buy: the worst instance of this bug had
  `tsc` exiting **0**. `tsconfig.build.tsbuildinfo` used to sit outside
  `dist/`, so tsup's clean took the outputs and left the state file behind;
  tsc read it, concluded it was up to date, and emitted nothing, successfully.
  Two things close that: `tsBuildInfoFile` now lives inside `dist/` (fixed
  2026-08-30), and the `declared-types-shipped` guardrail checks the artifact
  rather than the exit code — the only way to catch a toolchain that succeeds
  at doing nothing.

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
  its consumers. When this was written, `@arm/catalog` and
  `@arm/client-core` carried type errors against `@arm/proto`'s manifest-v2
  schema (D10 migration drift), and before this change those errors leaked
  into every transitive consumer's `tsc --noEmit` — `@arm/trpc`,
  `@arm/guardrails`, `apps/control-plane/web`, `apps/cli` and
  `apps/data-plane/plugin-ingest` all failed typecheck because of it. The
  build split confined the failure to the two packages that actually had it.
- **Resolved (2026-08-31).** The D10 drift this section describes is gone.
  All ten dist-backed packages compile clean under `tsconfig.build.json`;
  `toolSchema` no longer appears in `@arm/client-core`'s `manifest.ts`, and
  the runtime failure it caused (`toolSchema.extend(...)` on an `undefined`)
  no longer reproduces — `@arm/client-core` imports and resolves 49 exports
  from both `apps/cli` and `apps/data-plane/plugin-ingest`, and
  `@arm/catalog` resolves 18 from `@arm/trpc`. That the drift is gone is
  what made removing `|| true` safe.
