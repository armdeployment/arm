import { test, expect } from "@playwright/test";

/**
 * Token-conservative smoke tests (spec §5.3, §9 1.0 exit gate).
 *
 * Verifies the dashboard + sub-pages render via the real tRPC pipeline
 * (client → /api/trpc → tenant middleware → fixture data → UI).
 * Targeted assertions only — no screenshots, no DOM dumps.
 */

test.describe("ARM dashboard (tRPC-wired)", () => {
  test("dashboard renders with live tRPC data", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByText("Live via tRPC")).toBeVisible();

    // Stat cards populated from spend.summary query
    await expect(page.getByText("Monthly Spend")).toBeVisible();
    await expect(page.getByText("$5,975")).toBeVisible();
    await expect(page.getByText("84%")).toBeVisible();

    // Charts (data from spend.trend + spend.byModel queries)
    await expect(page.getByText("Spend Trend (30 days)")).toBeVisible();
    await expect(page.getByText("Spend by Model")).toBeVisible();

    // Agents table (from agents.list query)
    await expect(page.getByText("incident-triage")).toBeVisible();
    await expect(page.getByText("hot-issue-resolver")).toBeVisible();
  });

  test("sidebar navigation works", async ({ page }) => {
    await page.goto("/");
    for (const label of ["Dashboard", "Agents", "Spend", "Access", "Audit"]) {
      await expect(page.getByRole("link", { name: label })).toBeVisible();
    }
  });
});

test.describe("sub-pages", () => {
  test("/agents renders full agent list", async ({ page }) => {
    await page.goto("/agents");
    await expect(page.getByRole("heading", { name: "Agents", exact: true })).toBeVisible();
    await expect(page.getByText("Invariant §11.7")).toBeVisible();
    await expect(page.getByText("code-review-bot")).toBeVisible();
  });

  test("/spend renders cost breakdown", async ({ page }) => {
    await page.goto("/spend");
    await expect(page.getByRole("heading", { name: "Spend", exact: true })).toBeVisible();
    await expect(page.getByText("Total Monthly")).toBeVisible();
    await expect(page.getByText("Savings Opportunity")).toBeVisible();
  });

  test("/access renders JIT approval queue", async ({ page }) => {
    await page.goto("/access");
    await expect(page.getByRole("heading", { name: "Access", exact: true })).toBeVisible();
    await expect(page.getByText("Pending Approvals")).toBeVisible();
    // Fixture data has 2 pending requests
    await expect(page.getByText("SEV-1 incident")).toBeVisible();
  });

  test("/audit renders placeholder with schema info", async ({ page }) => {
    await page.goto("/audit");
    await expect(page.getByRole("heading", { name: "Audit", exact: true })).toBeVisible();
    await expect(page.getByText("access_audit_event")).toBeVisible();
  });
});
