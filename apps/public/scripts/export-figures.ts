/**
 * Exports the three architecture diagrams to docs/figures/*.svg as
 * self-contained, theme-aware static files (guide 04 §3 + §10).
 *
 * Geometry comes from src/components/diagrams/layout.ts — the exact same
 * module the in-app <FlowDiagram> component uses — so these exports cannot
 * drift from what renders on /architecture. Run with:
 *
 *   pnpm --filter @arm-app/public exec tsx scripts/export-figures.ts
 *
 * These are plain XML string templates (no React, no JSX) so the script has
 * no dependency on a JSX runtime — just the shared layout math and the
 * content modules, both plain TypeScript data.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { layoutDiagram, type DiagramLayout } from "../src/components/diagrams/layout";
import {
  employeePathDiagram,
  trustBoundaryDiagram,
  trustBoundaryCrossingEdgeIndex,
  artifactoryDiagram,
} from "../src/content/architecture";
import type { DiagramLabels } from "../src/content/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIGURES_DIR = join(__dirname, "..", "..", "..", "docs", "figures");

const THEME_STYLE = `
    :root {
      --navy: #1E3A8A;
      --text-primary: #0F172A;
      --text-secondary: #475569;
      --text-muted: #94A3B8;
      --border-strong: #CBD5E1;
      --bg-surface: #FFFFFF;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --navy: #7FA2FF;
        --text-primary: #F1F5F9;
        --text-secondary: #CBD5E1;
        --text-muted: #7C8AA5;
        --border-strong: #2E3F61;
        --bg-surface: #10192E;
      }
    }
    text { font-family: "IBM Plex Sans", -apple-system, BlinkMacSystemFont, system-ui, sans-serif; }
`.trim();

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderSvg(labels: DiagramLabels, titleId: string, layout: DiagramLayout): string {
  const descId = `${titleId}-desc`;

  const defs = `
  <defs>
    <style>${THEME_STYLE}</style>
    <marker id="${titleId}-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="var(--text-secondary)" />
    </marker>
    <marker id="${titleId}-arrow-accent" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="var(--navy)" />
    </marker>
  </defs>`;

  const nodes = layout.nodes
    .map(
      (node) => `
  <g>
    <rect x="${node.x}" y="${node.y}" width="400" height="76" rx="10" fill="var(--bg-surface)" stroke="var(--border-strong)" stroke-width="1.5" />
    <text x="${node.centerX}" y="${node.y + 30}" text-anchor="middle" font-size="19" font-weight="600" fill="var(--text-primary)">${esc(node.label)}</text>
    ${node.sublabel ? `<text x="${node.centerX}" y="${node.y + 54}" text-anchor="middle" font-size="12.5" fill="var(--text-secondary)">${esc(node.sublabel)}</text>` : ""}
  </g>`,
    )
    .join("\n");

  const edges = layout.edges
    .map((edge) => {
      const markerId = edge.isBoundary ? `${titleId}-arrow-accent` : `${titleId}-arrow`;
      const stroke = edge.isBoundary ? "var(--navy)" : "var(--text-secondary)";
      const dash = edge.isBoundary ? ` stroke-dasharray="5 4"` : "";
      const label = edge.label
        ? `
    <rect x="${edge.labelX - edge.labelWidth / 2}" y="${edge.labelY - 14}" width="${edge.labelWidth}" height="20" fill="var(--bg-surface)" />
    <text x="${edge.labelX}" y="${edge.labelY}" text-anchor="middle" font-size="11.5" fill="${edge.isBoundary ? "var(--navy)" : "var(--text-muted)"}">${esc(edge.label)}</text>`
        : "";
      return `
  <g>
    <line x1="${edge.x1}" y1="${edge.y1}" x2="${edge.x2}" y2="${edge.y2}" stroke="${stroke}" stroke-width="1.75"${dash} marker-end="url(#${markerId})" />${label}
  </g>`;
    })
    .join("\n");

  return `<svg viewBox="0 0 ${layout.width} ${layout.height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="${titleId} ${descId}">
  <title id="${titleId}">${esc(labels.title)}</title>
  <desc id="${descId}">${esc(labels.desc)}</desc>${defs}
${nodes}
${edges}
</svg>
`;
}

function exportDiagram(name: string, labels: DiagramLabels, boundaryEdgeIndexes: number[] = []) {
  const layout = layoutDiagram(labels, boundaryEdgeIndexes);
  const svg = renderSvg(labels, name, layout);
  mkdirSync(FIGURES_DIR, { recursive: true });
  const outPath = join(FIGURES_DIR, `${name}.svg`);
  writeFileSync(outPath, svg, "utf8");
  console.log(`wrote ${outPath}`);
}

exportDiagram("employee-path", employeePathDiagram);
exportDiagram("trust-boundary", trustBoundaryDiagram, [trustBoundaryCrossingEdgeIndex]);
exportDiagram("artifactory", artifactoryDiagram);
