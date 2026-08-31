import { test, expect } from "@playwright/test";

const ROUTES = ["/", "/product", "/architecture", "/security", "/demo", "/faq"];

test.describe("navigation and console cleanliness", () => {
  for (const route of ROUTES) {
    test(`${route} loads with no console errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });
      page.on("pageerror", (err) => errors.push(err.message));

      const response = await page.goto(route);
      expect(response?.ok(), `${route} did not return a 2xx response`).toBe(true);
      await expect(page.locator("main#main-content")).toBeVisible();
      expect(errors, `console errors on ${route}:\n${errors.join("\n")}`).toEqual([]);
    });
  }

  test("every primary nav link resolves to a real route", async ({ page }) => {
    await page.goto("/");
    const links = page.getByRole("navigation", { name: "Primary" }).getByRole("link");
    const count = await links.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const href = await links.nth(i).getAttribute("href");
      expect(href).toBeTruthy();
      const response = await page.goto(href!);
      expect(response?.ok(), `nav link ${href} did not resolve`).toBe(true);
    }
  });

  test("/demo link to the dashboard opens in a new tab, not an iframe", async ({
    page,
    context,
  }) => {
    await page.goto("/demo");
    const cta = page.getByRole("link", { name: /open the dashboard/i });
    await expect(cta).toBeVisible();
    expect(await cta.getAttribute("target")).toBe("_blank");
    expect(await cta.getAttribute("rel")).toContain("noopener");
    // No iframe anywhere on the page (guide 04 §4: "Do not iframe it").
    expect(await page.locator("iframe").count()).toBe(0);
  });
});

test.describe("no horizontal overflow at required widths", () => {
  const widths = [375, 768, 1440];

  for (const route of ROUTES) {
    for (const width of widths) {
      test(`${route} has no horizontal scroll at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(route);
        const { scrollWidth, clientWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));
        expect(
          scrollWidth,
          `${route} at ${width}px: scrollWidth ${scrollWidth} > clientWidth ${clientWidth}`,
        ).toBeLessThanOrEqual(clientWidth);
      });
    }
  }
});

test.describe("videos", () => {
  test("/product and /demo videos have a poster and do not autoplay", async ({ page }) => {
    for (const route of ["/product", "/demo"]) {
      await page.goto(route);
      const video = page.locator("video").first();
      await expect(video).toBeVisible();
      expect(await video.getAttribute("poster")).toBeTruthy();
      expect(await video.getAttribute("autoplay")).toBeNull();
      // preload="none" keeps the video off the critical rendering path.
      expect(await video.getAttribute("preload")).toBe("none");
    }
  });
});
