import type { DiagramLabels } from "@/content/types";
import { layoutDiagram, NODE_HEIGHT, NODE_WIDTH } from "./layout";

/**
 * A vertical node-and-arrow diagram. Vertical stacking (rather than a
 * horizontal chain) is deliberate: it stays legible down to 375px without a
 * second responsive layout, because the whole SVG scales as one proportional
 * unit (guide 04 §3: "text that stays legible at mobile widths").
 *
 * Colors are CSS custom properties, not hard-coded hex, so the diagram flips
 * with the page's light/dark theme automatically (guide 04 §3). Geometry
 * comes from ./layout.ts, shared with the static exporter in
 * scripts/export-figures.ts so docs/figures/*.svg never drifts from this.
 *
 * Render this inside a `bg-surface` container — the edge-label backdrop is
 * painted `var(--bg-surface)` to break the connector line behind the text.
 */
export function FlowDiagram({
  labels,
  boundaryEdgeIndexes = [],
  titleId,
}: {
  labels: DiagramLabels;
  boundaryEdgeIndexes?: number[];
  titleId: string;
}) {
  const layout = layoutDiagram(labels, boundaryEdgeIndexes);
  const descId = `${titleId}-desc`;

  return (
    <svg
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      role="img"
      aria-labelledby={`${titleId} ${descId}`}
      className="h-auto w-full"
      style={{ maxWidth: "34rem" }}
    >
      <title id={titleId}>{labels.title}</title>
      <desc id={descId}>{labels.desc}</desc>

      <defs>
        <marker
          id={`${titleId}-arrow`}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M0,0 L10,5 L0,10 z" fill="var(--text-secondary)" />
        </marker>
        <marker
          id={`${titleId}-arrow-accent`}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M0,0 L10,5 L0,10 z" fill="var(--navy)" />
        </marker>
      </defs>

      {layout.nodes.map((node) => (
        <g key={node.id}>
          <rect
            x={node.x}
            y={node.y}
            width={NODE_WIDTH}
            height={NODE_HEIGHT}
            rx={10}
            fill="var(--bg-surface)"
            stroke="var(--border-strong)"
            strokeWidth={1.5}
          />
          <text x={node.centerX} y={node.y + 30} textAnchor="middle" fontSize={19} fontWeight={600} fill="var(--text-primary)">
            {node.label}
          </text>
          {node.sublabel && (
            <text x={node.centerX} y={node.y + 54} textAnchor="middle" fontSize={12.5} fill="var(--text-secondary)">
              {node.sublabel}
            </text>
          )}
        </g>
      ))}

      {layout.edges.map((edge) => (
        <g key={edge.index}>
          <line
            x1={edge.x1}
            y1={edge.y1}
            x2={edge.x2}
            y2={edge.y2}
            stroke={edge.isBoundary ? "var(--navy)" : "var(--text-secondary)"}
            strokeWidth={1.75}
            strokeDasharray={edge.isBoundary ? "5 4" : undefined}
            markerEnd={`url(#${titleId}-${edge.isBoundary ? "arrow-accent" : "arrow"})`}
          />
          {edge.label && (
            <g>
              <rect x={edge.labelX - edge.labelWidth / 2} y={edge.labelY - 14} width={edge.labelWidth} height={20} fill="var(--bg-surface)" />
              <text x={edge.labelX} y={edge.labelY} textAnchor="middle" fontSize={11.5} fill={edge.isBoundary ? "var(--navy)" : "var(--text-muted)"}>
                {edge.label}
              </text>
            </g>
          )}
        </g>
      ))}
    </svg>
  );
}
