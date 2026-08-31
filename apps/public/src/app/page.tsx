import Link from "next/link";
import { Container, Section, Kicker, ProseP, ScrollTable } from "@/components/ui";
import { ScreenshotGrid } from "@/components/screenshot-grid";
import {
  hero,
  problem,
  adoptionSection,
  governanceSection,
  costSection,
  deploymentSection,
  deploymentTable,
  honestyNote,
} from "@/content/home";

export default function HomePage() {
  return (
    <>
      {/* ── Hero — the ninety-second story starts here ── */}
      <Section tone="dark" className="py-16 sm:py-24">
        <p className="label-meta m-0 mb-4" style={{ color: "var(--text-on-dark-secondary)" }}>
          {hero.eyebrow}
        </p>
        <h1
          className="m-0 mb-6 font-semibold"
          style={{
            fontSize: "var(--font-display)",
            maxWidth: "44rem",
            color: "var(--text-on-dark)",
          }}
        >
          {hero.headline}
        </h1>
        <p
          className="m-0 mb-8"
          style={{
            fontSize: "var(--font-lead)",
            maxWidth: "42rem",
            color: "var(--text-on-dark-secondary)",
            lineHeight: 1.6,
          }}
        >
          {hero.subhead}
        </p>
        <div className="flex flex-wrap gap-4">
          <Link
            href={hero.ctaHref}
            className="rounded-md px-6 py-3 text-sm font-semibold no-underline"
            style={{ background: "var(--gold)", color: "#fff" }}
          >
            {hero.ctaLabel}
          </Link>
          <Link
            href={hero.secondaryCtaHref}
            className="rounded-md px-6 py-3 text-sm font-semibold no-underline"
            style={{ border: "1px solid var(--border-strong)", color: "var(--text-on-dark)" }}
          >
            {hero.secondaryCtaLabel}
          </Link>
        </div>
      </Section>

      {/* ── Problem statement ── */}
      <Section>
        <h2 className="m-0 mb-4" style={{ fontSize: "var(--font-h2)" }}>
          {problem.title}
        </h2>
        <ProseP>{problem.body}</ProseP>
      </Section>

      {/* ── 01 Adoption at scale (A1: primary) ── */}
      <Section tone="surface" id="adoption">
        <Kicker>{adoptionSection.kicker}</Kicker>
        <h2 className="m-0 mb-4" style={{ fontSize: "var(--font-h2)", maxWidth: "42rem" }}>
          {adoptionSection.title}
        </h2>
        <ProseP className="mb-8">{adoptionSection.body}</ProseP>

        <ScreenshotGrid items={adoptionSection.screenshots} />

        <div className="mt-10">
          <p className="m-0 mb-2 text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            {adoptionSection.managementLede}
          </p>
          <ProseP>{adoptionSection.managementBody}</ProseP>
        </div>
      </Section>

      {/* ── 02 Governance ── */}
      <Section id="governance">
        <Kicker>{governanceSection.kicker}</Kicker>
        <h2 className="m-0 mb-8" style={{ fontSize: "var(--font-h2)", maxWidth: "42rem" }}>
          {governanceSection.title}
        </h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {governanceSection.points.map((point) => (
            <div key={point.title} className="inst-card p-5">
              <h3 className="m-0 mb-2 text-base font-semibold">{point.title}</h3>
              <p
                className="m-0 text-sm"
                style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}
              >
                {point.body}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── 03 Cost control (secondary beat, one screen) ── */}
      <Section tone="surface" id="cost">
        <Kicker>{costSection.kicker}</Kicker>
        <h2 className="m-0 mb-4" style={{ fontSize: "var(--font-h2)", maxWidth: "40rem" }}>
          {costSection.title}
        </h2>
        <ProseP>{costSection.body}</ProseP>
      </Section>

      {/* ── 04 Deployment — one row in a table, not a page ── */}
      <Section id="deployment">
        <Kicker>{deploymentSection.kicker}</Kicker>
        <h2 className="m-0 mb-4" style={{ fontSize: "var(--font-h2)", maxWidth: "40rem" }}>
          {deploymentSection.title}
        </h2>
        <ProseP className="mb-6">{deploymentSection.body}</ProseP>

        <ScrollTable>
          <thead>
            <tr>
              <th
                className="label-meta p-3 text-left"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                Dimension
              </th>
              <th
                className="label-meta p-3 text-left"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                SaaS
              </th>
              <th
                className="label-meta p-3 text-left"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                Self-hosted
              </th>
            </tr>
          </thead>
          <tbody>
            {deploymentTable.map((row) => (
              <tr key={row.dimension}>
                <td
                  className="p-3 text-sm font-medium"
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  {row.dimension}
                </td>
                <td
                  className="p-3 text-sm"
                  style={{
                    borderBottom: "1px solid var(--border)",
                    color: "var(--text-secondary)",
                  }}
                >
                  {row.saas}
                </td>
                <td
                  className="p-3 text-sm"
                  style={{
                    borderBottom: "1px solid var(--border)",
                    color: "var(--text-secondary)",
                  }}
                >
                  {row.selfHosted}
                </td>
              </tr>
            ))}
          </tbody>
        </ScrollTable>
      </Section>

      <Section tone="surface">
        <p className="m-0 text-sm" style={{ color: "var(--text-muted)" }}>
          {honestyNote}
        </p>
      </Section>
    </>
  );
}
