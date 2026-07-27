import { defineConfig } from "@playwright/test";

/**
 * Token-conservative Playwright config.
 * - Single worker, single project (chromium only)
 * - No video, no trace, no screenshots on failure by default
 * - Web server auto-starts the Next.js production build
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3100",
    screenshot: "off",
    video: "off",
    trace: "off",
  },
  webServer: {
    command: "pnpm build && pnpm start",
    url: "http://localhost:3100",
    timeout: 120_000,
    reuseExistingServer: true,
  },
});
