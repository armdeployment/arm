/**
 * Guide 04 §7: "Vitest component tests on the content-driven sections (they
 * must render from the content modules with no hard-coded copy)."
 *
 * Each page component is rendered directly (no Next.js server runtime — just
 * React + jsdom) and checked against text pulled from its own content
 * module. If someone hardcodes a headline directly in JSX instead of editing
 * the content module, these tests still pass (the JSX prints the string
 * either way) — what they actually guard is content-module/page drift: if a
 * content module's copy changes, the rendered page must change with it,
 * which is only true if the page reads from the module rather than from a
 * stale copy-pasted string.
 */
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import HomePage from "../src/app/page";
import ProductPage from "../src/app/product/page";
import ArchitecturePage from "../src/app/architecture/page";
import SecurityPage from "../src/app/security/page";
import DemoPage from "../src/app/demo/page";
import FaqPage from "../src/app/faq/page";

import { hero, problem, adoptionSection } from "../src/content/home";
import { productHero, deliverables } from "../src/content/product";
import { architectureHero, employeePathDiagram } from "../src/content/architecture";
import { securityHero, invariants } from "../src/content/security";
import { demoHero, clickPaths } from "../src/content/demo";
import { faqHero, faqItems } from "../src/content/faq";

afterEach(cleanup);

describe("/ renders from src/content/home.ts", () => {
  it("renders the hero headline and subhead from the content module", () => {
    render(<HomePage />);
    expect(screen.getByText(hero.headline)).toBeInTheDocument();
    expect(screen.getByText(hero.subhead)).toBeInTheDocument();
  });

  it("renders the problem statement", () => {
    render(<HomePage />);
    expect(screen.getByText(problem.title)).toBeInTheDocument();
  });

  it("renders adoption section screenshots with content-module alt text", () => {
    render(<HomePage />);
    for (const shot of adoptionSection.screenshots) {
      expect(screen.getByAltText(shot.alt)).toBeInTheDocument();
    }
  });
});

describe("/product renders from src/content/product.ts", () => {
  it("renders the hero and every deliverable title", () => {
    render(<ProductPage />);
    expect(screen.getByText(productHero.title)).toBeInTheDocument();
    for (const d of deliverables) {
      expect(screen.getByText(d.title)).toBeInTheDocument();
    }
  });
});

describe("/architecture renders from src/content/architecture.ts", () => {
  it("renders the hero and the first diagram's title", () => {
    render(<ArchitecturePage />);
    expect(screen.getByText(architectureHero.title)).toBeInTheDocument();
    expect(screen.getAllByText(employeePathDiagram.title).length).toBeGreaterThan(0);
  });
});

describe("/security renders from src/content/security.ts", () => {
  it("renders the hero and every invariant statement", () => {
    render(<SecurityPage />);
    expect(screen.getByText(securityHero.title)).toBeInTheDocument();
    for (const inv of invariants) {
      expect(screen.getByText(inv.statement)).toBeInTheDocument();
    }
  });
});

describe("/demo renders from src/content/demo.ts", () => {
  it("renders the hero and every click path", () => {
    render(<DemoPage />);
    expect(screen.getByText(demoHero.title)).toBeInTheDocument();
    for (const path of clickPaths) {
      expect(screen.getByText(path.title)).toBeInTheDocument();
    }
  });
});

describe("/faq renders from src/content/faq.ts", () => {
  it("renders every question and answer", () => {
    render(<FaqPage />);
    expect(screen.getByText(faqHero.title)).toBeInTheDocument();
    for (const item of faqItems) {
      expect(screen.getByText(item.question)).toBeInTheDocument();
      expect(screen.getByText(item.answer)).toBeInTheDocument();
    }
  });
});
