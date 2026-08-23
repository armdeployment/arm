import type { NextConfig } from "next";

const config: NextConfig = {
  // Marketing site is fully static — no server-side data dependencies.
  output: "export",
  images: {
    // Static export cannot use the Next.js image optimization API (no server).
    // Screenshots are pre-sized and served as-is from /public.
    unoptimized: true,
  },
  // TypeScript 7 requires the CLI mode (Next.js's compiler API integration is TS ≤6).
  experimental: { useTypeScriptCli: true },
};

export default config;
