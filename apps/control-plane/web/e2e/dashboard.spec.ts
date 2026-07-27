import { test, expect } from "@playwright/test";

/**
 * Token-conservative smoke test (spec §5.3, §9 1.0 exit gate).
 *
 * Verifies the dashboard renders with key surfaces present. Uses targeted
 * role-based assertions — no full-page screenshots, no DOM dumps.
 * This is the baseline; richer e2e (navigation, interactions) lands with 1.1.
 */

test.describe("ARM dashboard smoke", () => {
  test("dashboard renders with all key sections", async ({ page }) => {
    await page.goto("/");

    // App shell
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByText("Agent Resource Management")).toBeVisible();

    // Stat cards (spec §5.3 dashboard surfaces)
    await expect(page.getByText("Monthly Spend")).toBeVisible();
    await expect(page.getByText("Active Agents")).toBeVisible();
    await expect(page.getByText("Proxied Traffic")).toBeVisible();
    await expect(page.getByText("Budget Utilization")).toBeVisible();

    // Charts
    await expect(page.getByText("Spend Trend (30 days)")).toBeVisible();
    await expect(page.getByText("Spend by Model")).toBeVisible();
    await expect(page.getByText("Agents by Priority Tier")).toBeVisible();

    // Agents table
    await expect(page.getByText("Top Agents by Spend")).toBeVisible();
    await expect(page.getByText("incident-triage")).toBeVisible();
    await expect(page.getByText("hot-issue-resolver")).toBeVisible();
  });

  test("sidebar navigation links are present", async ({ page }) => {
    await page.goto("/");
    // Navigation items from §5.3 IA
    for (const label of ["Dashboard", "Agents", "Spend", "Access", "Audit"]) {
      await expect(page.getByRole("link", { name: label })).toBeVisible();
    }
  });
});
