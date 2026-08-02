import type { NextConfig } from "next";

const config: NextConfig = {
  // Transpile all workspace packages (they export raw .ts).
  transpilePackages: [
    "@arm/proto", "@arm/config", "@arm/db", "@arm/clickhouse",
    "@arm/policy", "@arm/billing", "@arm/auth", "@arm/trpc", "@arm/profiles",
  ],
  // TypeScript 7 requires the CLI mode (Next.js's compiler API integration is TS ≤6).
  experimental: { useTypeScriptCli: true },
};

export default config;
