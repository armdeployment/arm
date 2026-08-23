import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const config: NextConfig = {
  // Transpile all workspace packages (they export raw .ts).
  transpilePackages: ["@arm/proto", "@arm/config", "@arm/trpc", "@arm/questionnaire", "@arm/client-core"],
  // TypeScript 7 requires the CLI mode (Next.js's compiler API integration is TS ≤6).
  experimental: { useTypeScriptCli: true },
  // Pin the workspace root to THIS app's own pnpm-workspace.yaml — when this
  // checkout lives inside a nested git worktree (a second pnpm-workspace.yaml
  // exists above it), Turbopack's root inference otherwise picks the outer
  // one and every workspace-package import resolves against the wrong path.
  // KNOWN ISSUE (environment/tooling, not app code): Next.js 16.2.12's
  // Turbopack bundler (both `next dev` and `next build`) fails to resolve
  // ".js"-suffixed relative imports to sibling ".ts" files ACROSS a
  // `transpilePackages` boundary (moduleResolution: NodeNext requires this
  // extension convention — tsconfig.base.json, every package in this repo
  // uses it). Reproduces identically for @arm/questionnaire AND
  // @arm/client-core (both pre-date and post-date this app), so it is not
  // specific to this app's code — no other Next app here has previously
  // imported a multi-file workspace package as runtime (not type-only)
  // code, so nothing tripped it before. `tsc --noEmit` and `vitest` (both
  // used for this project's actual pass/fail bar) resolve these imports
  // correctly; only Turbopack's bundling step is affected. Tried:
  // turbopack.root (below, legitimately needed for the nested-worktree
  // workspace-root warning) and turbopack.resolveExtensions (no effect).
  // Fix likely requires either a real build step (dist/*.js) for shared
  // packages or a Next.js/Turbopack version change — out of this guide's
  // scope; flagged separately.
  turbopack: { root: dirname(dirname(dirname(fileURLToPath(import.meta.url)))) },
};

export default config;
