import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/cli-entry.ts"],
  format: ["esm"],
  dts: false,
  sourcemap: true,
  clean: true,
  outDir: "dist",
});
