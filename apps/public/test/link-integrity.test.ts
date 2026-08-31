/**
 * Guide 04 §7: "A link-integrity test: no dead internal links, no external
 * link to a domain that is not on an allowlist committed in the repo."
 *
 * Internal links: every href pointing at this site (starts with "/") must
 * resolve to one of the six routes guide 04 §1 defines.
 *
 * External links: every href with a hostname must be either on
 * src/content/link-allowlist.ts, or be a plain "localhost" URL — the /demo
 * page's link to the dashboard deployment is a cross-app link inside the
 * same product, not a third party, so it is exempted explicitly rather than
 * added to the third-party allowlist.
 */
import { describe, it, expect } from "vitest";
import { primaryNav, footerNav } from "../src/content/nav";
import { hero } from "../src/content/home";
import { demoCta } from "../src/content/demo";
import { externalLinkAllowlist } from "../src/content/link-allowlist";

const VALID_ROUTES = ["/", "/product", "/architecture", "/security", "/demo", "/faq"];

const internalHrefs = [
  ...primaryNav.map((l) => l.href),
  ...footerNav.map((l) => l.href),
  hero.ctaHref,
  hero.secondaryCtaHref,
];

const externalHrefs = [demoCta.fallbackUrl];

describe("link integrity", () => {
  it("has a non-empty set of internal links to check", () => {
    expect(internalHrefs.length).toBeGreaterThan(0);
  });

  it("every internal nav/CTA href resolves to a route this site defines", () => {
    for (const href of internalHrefs) {
      expect(VALID_ROUTES, `Dead internal link: ${href}`).toContain(href);
    }
  });

  it("every external href is either localhost or on the committed allowlist", () => {
    for (const href of externalHrefs) {
      const url = new URL(href);
      const allowed = url.hostname === "localhost" || externalLinkAllowlist.includes(url.hostname);
      expect(allowed, `External link to a non-allowlisted domain: ${href}`).toBe(true);
    }
  });

  it("the Google Fonts stylesheet host is the only third-party asset host referenced by the layout", () => {
    // apps/public/src/app/layout.tsx hard-codes the two Google Fonts hosts
    // for <link rel="preconnect">/<link rel="stylesheet"> — the one
    // exception the guide allows for self-contained pages. This test pins
    // the allowlist to exactly those two hosts so a new external host can't
    // sneak onto the allowlist unnoticed.
    expect(externalLinkAllowlist.sort()).toEqual(
      ["fonts.googleapis.com", "fonts.gstatic.com"].sort(),
    );
  });
});
