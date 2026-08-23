import type { DiagramLabels } from "@/content/types";
import { FlowDiagram } from "./flow-diagram";

export function DiagramFigure({
  labels,
  boundaryEdgeIndexes,
  titleId,
}: {
  labels: DiagramLabels;
  boundaryEdgeIndexes?: number[];
  titleId: string;
}) {
  return (
    <figure className="inst-card m-0 flex flex-col items-center gap-4 p-6">
      <FlowDiagram labels={labels} boundaryEdgeIndexes={boundaryEdgeIndexes} titleId={titleId} />
      <figcaption className="text-sm" style={{ color: "var(--text-secondary)", maxWidth: "34rem" }}>
        {labels.desc}
      </figcaption>
    </figure>
  );
}
