import type { Metadata } from "next";
import { Section, Kicker, ProseP, ScrollTable, Pill, StatCard } from "@/components/ui";
import { VideoBlock } from "@/components/video-block";
import { productHero, deliverables, roadmapHeading, roadmapIntro } from "@/content/product";
import { phasePlan, scorecardNote } from "@/content/roadmap";
import { categoryClaim, competitiveMatrix, moatParagraph, competitiveSourceNote } from "@/content/competitive";
import { simulationRunStats, simulationRunMeta } from "@/content/simulation-data";

export const metadata: Metadata = { title: "Product" };

const statusPill: Record<string, { label: string; tone: "success" | "warning" | "neutral" }> = {
  shipped: { label: "Shipped", tone: "success" },
  in_progress: { label: "In progress", tone: "warning" },
  planned: { label: "Planned", tone: "neutral" },
};

export default function ProductPage() {
  return (
    <>
      <Section tone="dark" className="py-14 sm:py-20">
        <h1 className="m-0 mb-4 font-semibold" style={{ fontSize: "var(--font-h1)", maxWidth: "40rem", color: "var(--text-on-dark)" }}>
          {productHero.title}
        </h1>
        <p style={{ fontSize: "var(--font-lead)", maxWidth: "40rem", color: "var(--text-on-dark-secondary)", lineHeight: 1.6 }} className="m-0">
          {productHero.body}
        </p>
      </Section>

      {deliverables.map((d, i) => (
        <Section key={d.id} id={d.id} tone={i % 2 === 0 ? "default" : "surface"}>
          <Kicker>{d.kicker}</Kicker>
          <h2 className="m-0 mb-4" style={{ fontSize: "var(--font-h2)", maxWidth: "40rem" }}>
            {d.title}
          </h2>
          <ProseP className="mb-6">{d.summary}</ProseP>
          <ul className="m-0 mb-6 flex list-none flex-col gap-4 p-0" style={{ maxWidth: "44rem" }}>
            {d.details.map((detail) => (
              <li key={detail} className="flex gap-3">
                <span aria-hidden="true" style={{ color: "var(--gold)", fontWeight: 700 }}>
                  →
                </span>
                <span className="text-sm" style={{ color: "var(--text-secondary)", lineHeight: 1.7 }}>
                  {detail}
                </span>
              </li>
            ))}
          </ul>
          <p className="label-meta m-0" style={{ maxWidth: "44rem" }}>
            Out of scope: {d.scope}
          </p>

          {d.id === "adoption" && (
            <div className="mt-8" style={{ maxWidth: "32rem" }}>
              <VideoBlock
                src="/video/arm-video-2-structures.mp4"
                poster="/video/poster-org-structures.svg"
                title="Editing an organization structure"
                summary="A real screen recording of the org-tree editor: adding a department node and watching budget and headcount roll up automatically. Silent screen capture, no narration audio."
              />
            </div>
          )}
        </Section>
      ))}

      {/* ── Category claim (investor content, kept on / and /product per guide 04 §5) ── */}
      <Section id="category" tone="dark">
        <Kicker tone="dark">The category argument</Kicker>
        <h2 className="m-0 mb-4 font-semibold" style={{ fontSize: "var(--font-h2)", maxWidth: "42rem", color: "var(--text-on-dark)" }}>
          {categoryClaim.headline}
        </h2>
        <p className="m-0" style={{ maxWidth: "44rem", color: "var(--text-on-dark-secondary)", lineHeight: 1.7 }}>
          {categoryClaim.body}
        </p>
      </Section>

      <Section id="comparison" tone="surface">
        <h2 className="m-0 mb-6" style={{ fontSize: "var(--font-h2)" }}>
          Where ARM sits versus gateways and policy engines
        </h2>
        <ScrollTable>
          <thead>
            <tr>
              <th className="label-meta p-3 text-left" style={{ borderBottom: "1px solid var(--border)" }}>Capability</th>
              <th className="label-meta p-3 text-left" style={{ borderBottom: "1px solid var(--border)" }}>ARM</th>
              <th className="label-meta p-3 text-left" style={{ borderBottom: "1px solid var(--border)" }}>Gateways / policy engines</th>
            </tr>
          </thead>
          <tbody>
            {competitiveMatrix.map((row) => (
              <tr key={row.capability}>
                <td className="p-3 text-sm font-medium" style={{ borderBottom: "1px solid var(--border)" }}>{row.capability}</td>
                <td className="p-3 text-sm" style={{ borderBottom: "1px solid var(--border)", color: "var(--text-secondary)" }}>{row.arm}</td>
                <td className="p-3 text-sm" style={{ borderBottom: "1px solid var(--border)", color: "var(--text-secondary)" }}>{row.gateways}</td>
              </tr>
            ))}
          </tbody>
        </ScrollTable>
        <p className="m-0 mt-4 text-xs" style={{ color: "var(--text-muted)" }}>{competitiveSourceNote}</p>
      </Section>

      <Section id="moat">
        <h2 className="m-0 mb-4" style={{ fontSize: "var(--font-h2)", maxWidth: "40rem" }}>
          The moat
        </h2>
        <ProseP>{moatParagraph}</ProseP>
      </Section>

      {/* ── Evidence: a real, small, committed run — not a projection ── */}
      <Section id="evidence">
        <h2 className="m-0 mb-2" style={{ fontSize: "var(--font-h2)" }}>
          A real run, not a projection
        </h2>
        <ProseP className="mb-6">
          {simulationRunMeta.caveat} {simulationRunMeta.employees} employees across{" "}
          {simulationRunMeta.departments} departments, running {simulationRunMeta.agentTypes.join(", ")}.
        </ProseP>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {simulationRunStats.map((stat) => (
            <StatCard key={stat.label} {...stat} />
          ))}
        </div>
      </Section>

      {/* ── Built vs planned ── */}
      <Section id="roadmap" tone="surface">
        <h2 className="m-0 mb-2" style={{ fontSize: "var(--font-h2)" }}>{roadmapHeading}</h2>
        <ProseP className="mb-6">{roadmapIntro}</ProseP>
        <div className="flex flex-col gap-4">
          {phasePlan.map((row) => {
            const pill = statusPill[row.status]!;
            return (
              <div key={row.phase} className="inst-card p-5">
                <div className="mb-2 flex flex-wrap items-center gap-3">
                  <span className="label-meta" style={{ color: "var(--navy)" }}>
                    {row.phase}
                  </span>
                  <h3 className="m-0 text-base font-semibold">{row.title}</h3>
                  <Pill tone={pill.tone}>{pill.label}</Pill>
                </div>
                <p className="m-0 text-sm" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  {row.detail}
                </p>
              </div>
            );
          })}
        </div>
        <p className="m-0 mt-4 text-xs" style={{ color: "var(--text-muted)" }}>{scorecardNote}</p>
      </Section>
    </>
  );
}
