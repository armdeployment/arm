import { defineConfig, devices } from "@playwright/test";

/**
 * Token-conservative Playwright config.
 * - Single worker, single project (chromium only)
 * - No video, no trace, no screenshots on failure by default
 * - Serves the static export (`next build` with output: "export") via `next start`-free
 *   static file server, matching how the site actually ships.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3200",
    screenshot: "off",
    video: "off",
    trace: "off",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: "pnpm build && pnpm exec serve out -l 3200",
    url: "http://localhost:3200",
    timeout: 120_000,
    reuseExistingServer: true,
  },
});
