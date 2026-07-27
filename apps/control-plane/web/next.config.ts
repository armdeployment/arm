import type { NextConfig } from "next";

const config: NextConfig = {
  // Transpile workspace packages (they export raw .ts).
  transpilePackages: ["@arm/proto", "@arm/config"],
  // TypeScript 7 requires the CLI mode (Next.js's compiler API integration is TS ≤6).
  experimental: { useTypeScriptCli: true },
};

export default config;
