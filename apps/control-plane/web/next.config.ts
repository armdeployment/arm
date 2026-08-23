import type { NextConfig } from "next";
import { resolve } from "node:path";

/**
 * This repo is sometimes checked out as a git worktree nested under a
 * parent checkout's own tree (e.g. `<repo>/.claude/worktrees/<id>/…`, which
 * is itself a full copy of the repo root, pnpm-workspace.yaml included).
 * Next/Turbopack's root auto-detection walks up from this file and, on
 * such a layout, finds TWO pnpm-workspace.yaml files (this worktree's own,
 * and the outer parent checkout's) and picks the wrong one — breaking every
 * relative `./foo.js`-style import into a workspace `.ts` source file (see
 * the "detected multiple lockfiles" build warning). Pinning `turbopack.root`
 * explicitly to THIS worktree's own repo root fixes it.
 *
 * Deliberately uses `process.cwd()` rather than `import.meta.url` — Next's
 * config loader compiles `next.config.ts` as CJS when this package's
 * `package.json` has no `"type": "module"`, and `import.meta.url` has no
 * CJS equivalent (throws "exports is not defined in ES module scope" at
 * load time). `next build`/`dev`/`start` always run with this app's own
 * directory as cwd (see package.json scripts), so this is stable.
 */
const workspaceRoot = resolve(process.cwd(), "../../..");

const config: NextConfig = {
  // Transpile all workspace packages (they export raw .ts).
  transpilePackages: [
    "@arm/proto", "@arm/config", "@arm/db", "@arm/clickhouse",
    "@arm/policy", "@arm/billing", "@arm/auth", "@arm/trpc", "@arm/profiles",
  ],
  // TypeScript 7 requires the CLI mode (Next.js's compiler API integration is TS ≤6).
  experimental: { useTypeScriptCli: true },
  turbopack: { root: workspaceRoot },
};

export default config;
