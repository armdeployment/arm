import type { DiagramLabels } from "@/content/types";

/**
 * Pure layout math shared by the in-app React diagram (flow-diagram.tsx) and
 * the static exporter (scripts/export-figures.ts), so docs/figures/*.svg is
 * generated from exactly the same geometry as what renders on /architecture
 * — one source of truth, no drift between the two.
 */

export const DIAGRAM_WIDTH = 480;
export const NODE_WIDTH = 400;
export const NODE_HEIGHT = 76;
export const EDGE_REGION = 58;
export const TOP_PAD = 16;

export interface LaidOutNode {
  id: string;
  label: string;
  sublabel?: string;
  x: number;
  y: number;
  centerX: number;
}

export interface LaidOutEdge {
  index: number;
  label: string | undefined;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  labelX: number;
  labelY: number;
  labelWidth: number;
  isBoundary: boolean;
}

export interface DiagramLayout {
  width: number;
  height: number;
  centerX: number;
  nodes: LaidOutNode[];
  edges: LaidOutEdge[];
}

export function layoutDiagram(labels: DiagramLabels, boundaryEdgeIndexes: number[] = []): DiagramLayout {
  const marginX = (DIAGRAM_WIDTH - NODE_WIDTH) / 2;
  const rowHeight = NODE_HEIGHT + EDGE_REGION;
  const height = TOP_PAD * 2 + labels.nodes.length * NODE_HEIGHT + (labels.nodes.length - 1) * EDGE_REGION;
  const centerX = DIAGRAM_WIDTH / 2;

  const nodes: LaidOutNode[] = labels.nodes.map((node, i) => ({
    id: node.id,
    label: node.label,
    sublabel: node.sublabel,
    x: marginX,
    y: TOP_PAD + i * rowHeight,
    centerX,
  }));

  const edges: LaidOutEdge[] = labels.edges
    .map((edge, i) => {
      if (i >= labels.nodes.length - 1) return null;
      const y = TOP_PAD + i * rowHeight;
      const labelWidth = edge.label ? Math.min(NODE_WIDTH - 16, edge.label.length * 5.6 + 16) : 0;
      return {
        index: i,
        label: edge.label,
        x1: centerX,
        y1: y + NODE_HEIGHT,
        x2: centerX,
        y2: y + NODE_HEIGHT + EDGE_REGION,
        labelX: centerX,
        labelY: y + NODE_HEIGHT + EDGE_REGION / 2 + 4,
        labelWidth,
        isBoundary: boundaryEdgeIndexes.includes(i),
      };
    })
    .filter((e): e is LaidOutEdge => e !== null);

  return { width: DIAGRAM_WIDTH, height, centerX, nodes, edges };
}
