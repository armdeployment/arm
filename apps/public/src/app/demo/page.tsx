import type { Metadata } from "next";
import { Section, ProseP } from "@/components/ui";
import { VideoBlock } from "@/components/video-block";
import { demoHero, demoStatusNote, clickPaths, demoCta, demoDatasetNote } from "@/content/demo";

export const metadata: Metadata = { title: "Demo" };

// Configurable at build time — defaults to the dashboard's documented local
// dev URL (README.md). Set NEXT_PUBLIC_DASHBOARD_URL when deploying this
// site against a hosted dashboard instance.
const dashboardUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? demoCta.fallbackUrl;

export default function DemoPage() {
  return (
    <>
      <Section tone="dark" className="py-14 sm:py-20">
        <h1
          className="m-0 mb-4 font-semibold"
          style={{ fontSize: "var(--font-h1)", maxWidth: "40rem", color: "var(--text-on-dark)" }}
        >
          {demoHero.title}
        </h1>
        <p
          style={{
            fontSize: "var(--font-lead)",
            maxWidth: "42rem",
            color: "var(--text-on-dark-secondary)",
            lineHeight: 1.6,
          }}
          className="m-0 mb-8"
        >
          {demoHero.body}
        </p>
        <a
          href={dashboardUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block rounded-md px-6 py-3 text-sm font-semibold no-underline"
          style={{ background: "var(--gold)", color: "#fff" }}
        >
          {demoCta.label} ↗
        </a>
        <p className="m-0 mt-3 text-xs" style={{ color: "var(--text-on-dark-secondary)" }}>
          {demoCta.note}
        </p>
      </Section>

      <Section tone="surface">
        <p
          className="m-0 text-sm"
          style={{ color: "var(--text-secondary)", lineHeight: 1.7, maxWidth: "44rem" }}
        >
          {demoStatusNote}
        </p>
      </Section>

      <Section id="click-paths">
        <h2 className="m-0 mb-6" style={{ fontSize: "var(--font-h2)" }}>
          Three ways to look at it
        </h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {clickPaths.map((path) => (
            <div key={path.title} className="inst-card p-5">
              <h3 className="m-0 mb-2 text-base font-semibold">{path.title}</h3>
              <p className="m-0 mb-3 text-sm" style={{ color: "var(--text-secondary)" }}>
                {path.description}
              </p>
              <ol
                className="m-0 flex flex-col gap-2 pl-5 text-sm"
                style={{ color: "var(--text-secondary)" }}
              >
                {path.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </Section>

      <Section tone="surface" id="dataset">
        <h2 className="m-0 mb-4" style={{ fontSize: "var(--font-h2)", maxWidth: "40rem" }}>
          Not a demo with no problems in it
        </h2>
        <ProseP className="mb-8">{demoDatasetNote}</ProseP>
        <div style={{ maxWidth: "34rem" }}>
          <VideoBlock
            src="/video/arm-enterprise-simulation.mp4"
            poster="/video/poster-simulation.svg"
            title="Prefer to watch first? A real simulation run"
            summary="A committed, real 9-container simulation: six employees across five departments, each running a different agent (Claude Code, OpenCode, Copilot, Pi), metered end to end through ARM with a DLP block along the way. Silent screen capture, no narration audio. Numbers from this run are on /product."
          />
        </div>
      </Section>
    </>
  );
}
