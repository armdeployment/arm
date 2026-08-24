import type { NextConfig } from "next";

const config: NextConfig = {
  // Transpile all workspace packages (they export raw .ts).
  // @arm/db, @arm/policy, and @arm/trpc ship a real build (dist/*.js via
  // tsup) so they resolve like any other npm package — no transpile needed.
  transpilePackages: [
    "@arm/proto", "@arm/config", "@arm/clickhouse",
    "@arm/billing", "@arm/auth", "@arm/profiles",
  ],
  // TypeScript 7 requires the CLI mode (Next.js's compiler API integration is TS ≤6).
  experimental: { useTypeScriptCli: true },
};

export default config;
