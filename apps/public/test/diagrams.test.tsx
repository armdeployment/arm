import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { FlowDiagram } from "../src/components/diagrams/flow-diagram";
import {
  employeePathDiagram,
  trustBoundaryDiagram,
  trustBoundaryCrossingEdgeIndex,
  artifactoryDiagram,
} from "../src/content/architecture";

afterEach(cleanup);

describe("FlowDiagram — renders diagram content module data, with accessible title/desc", () => {
  it.each([
    ["employee-path", employeePathDiagram, []],
    ["trust-boundary", trustBoundaryDiagram, [trustBoundaryCrossingEdgeIndex]],
    ["artifactory", artifactoryDiagram, []],
  ] as const)(
    "%s: every node label, sublabel, and edge label is present in the SVG",
    (id, labels, boundaryEdgeIndexes) => {
      const { container } = render(
        <FlowDiagram labels={labels} boundaryEdgeIndexes={[...boundaryEdgeIndexes]} titleId={id} />,
      );
      const svg = container.querySelector("svg");
      expect(svg).toBeTruthy();
      expect(svg?.getAttribute("role")).toBe("img");

      const text = container.textContent ?? "";
      expect(text).toContain(labels.title);
      expect(text).toContain(labels.desc);
      for (const node of labels.nodes) {
        expect(text).toContain(node.label);
        if (node.sublabel) expect(text).toContain(node.sublabel);
      }
      for (const edge of labels.edges) {
        if (edge.label) expect(text).toContain(edge.label);
      }

      // Colors must come from CSS custom properties, never hard-coded hex,
      // so the diagram flips with the page's theme (guide 04 §3).
      const html = container.innerHTML;
      expect(html).not.toMatch(/#[0-9a-fA-F]{3,6}/);
      expect(html).toMatch(/var\(--/);
    },
  );

  it("has a <title> and <desc> wired to aria-labelledby for screen readers", () => {
    const { container } = render(<FlowDiagram labels={employeePathDiagram} titleId="a11y-check" />);
    const svg = container.querySelector("svg");
    const title = container.querySelector("title");
    const desc = container.querySelector("desc");
    expect(title?.id).toBe("a11y-check");
    expect(desc?.id).toBe("a11y-check-desc");
    expect(svg?.getAttribute("aria-labelledby")).toBe("a11y-check a11y-check-desc");
  });
});
