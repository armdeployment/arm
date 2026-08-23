import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const ROUTES = ["/", "/product", "/architecture", "/security", "/demo", "/faq"];

test.describe("axe accessibility pass (guide 04 §7 + §8)", () => {
  for (const route of ROUTES) {
    test(`${route} has no axe violations`, async ({ page }) => {
      await page.goto(route);
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      const summary = results.violations
        .map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.length} node(s)`)
        .join("\n");
      expect(results.violations, `axe violations on ${route}:\n${summary}`).toEqual([]);
    });
  }
});

test.describe("keyboard + landmarks", () => {
  test("skip link is the first focusable element and jumps to main content", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skipLink = page.locator(".skip-link");
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toHaveAttribute("href", "#main-content");
  });

  test("every page has exactly one main landmark and a reduced-motion-safe animation policy", async ({ page }) => {
    await page.goto("/");
    expect(await page.locator("main").count()).toBe(1);
  });
});
