import type { Metadata } from "next";
import { Section, ScrollTable } from "@/components/ui";
import { DiagramFigure } from "@/components/diagrams/diagram-figure";
import {
  architectureHero,
  employeePathDiagram,
  trustBoundaryDiagram,
  trustBoundaryCrossingEdgeIndex,
  artifactoryDiagram,
  boundaryTable,
  boundarySourceNote,
} from "@/content/architecture";

export const metadata: Metadata = { title: "Architecture" };

export default function ArchitecturePage() {
  return (
    <>
      <Section tone="dark" className="py-14 sm:py-20">
        <h1
          className="m-0 mb-4 font-semibold"
          style={{ fontSize: "var(--font-h1)", maxWidth: "40rem", color: "var(--text-on-dark)" }}
        >
          {architectureHero.title}
        </h1>
        <p
          style={{
            fontSize: "var(--font-lead)",
            maxWidth: "42rem",
            color: "var(--text-on-dark-secondary)",
            lineHeight: 1.6,
          }}
          className="m-0"
        >
          {architectureHero.body}
        </p>
      </Section>

      <Section id="employee-path">
        <h2 className="m-0 mb-6" style={{ fontSize: "var(--font-h2)" }}>
          {employeePathDiagram.title}
        </h2>
        <DiagramFigure labels={employeePathDiagram} titleId="employeePathDiagram" />
      </Section>

      <Section id="trust-boundary" tone="surface">
        <h2 className="m-0 mb-6" style={{ fontSize: "var(--font-h2)" }}>
          {trustBoundaryDiagram.title}
        </h2>
        <DiagramFigure
          labels={trustBoundaryDiagram}
          boundaryEdgeIndexes={[trustBoundaryCrossingEdgeIndex]}
          titleId="trustBoundaryDiagram"
        />

        <div className="mt-10">
          <h3 className="m-0 mb-4 text-lg font-semibold">What crosses, what never does</h3>
          <ScrollTable>
            <thead>
              <tr>
                <th
                  className="label-meta p-3 text-left"
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  Boundary
                </th>
                <th
                  className="label-meta p-3 text-left"
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  What crosses
                </th>
                <th
                  className="label-meta p-3 text-left"
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  What never crosses
                </th>
              </tr>
            </thead>
            <tbody>
              {boundaryTable.map((row) => (
                <tr key={row.boundary}>
                  <td
                    className="p-3 text-sm font-medium"
                    style={{ borderBottom: "1px solid var(--border)" }}
                  >
                    {row.boundary}
                  </td>
                  <td
                    className="p-3 text-sm"
                    style={{
                      borderBottom: "1px solid var(--border)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {row.crosses}
                  </td>
                  <td
                    className="p-3 text-sm font-medium"
                    style={{
                      borderBottom: "1px solid var(--border)",
                      color: row.neverCrosses === "—" ? "var(--text-muted)" : "var(--danger)",
                    }}
                  >
                    {row.neverCrosses}
                  </td>
                </tr>
              ))}
            </tbody>
          </ScrollTable>
          <p className="m-0 mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
            {boundarySourceNote}
          </p>
        </div>
      </Section>

      <Section id="artifactory">
        <h2 className="m-0 mb-6" style={{ fontSize: "var(--font-h2)" }}>
          {artifactoryDiagram.title}
        </h2>
        <DiagramFigure labels={artifactoryDiagram} titleId="artifactoryDiagram" />
      </Section>
    </>
  );
}
