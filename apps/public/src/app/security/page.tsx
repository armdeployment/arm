import type { Metadata } from "next";
import { Section, ScrollTable, ProseP } from "@/components/ui";
import {
  securityHero,
  invariants,
  guardrailPhilosophy,
  deploymentModels,
  onPremNote,
} from "@/content/security";

export const metadata: Metadata = { title: "Security" };

export default function SecurityPage() {
  return (
    <>
      <Section tone="dark" className="py-14 sm:py-20">
        <h1
          className="m-0 mb-4 font-semibold"
          style={{ fontSize: "var(--font-h1)", maxWidth: "40rem", color: "var(--text-on-dark)" }}
        >
          {securityHero.title}
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
          {securityHero.body}
        </p>
      </Section>

      <Section id="invariants">
        <h2 className="m-0 mb-6" style={{ fontSize: "var(--font-h2)" }}>
          The eight invariants
        </h2>
        <ScrollTable>
          <thead>
            <tr>
              <th
                className="label-meta p-3 text-left"
                style={{ borderBottom: "1px solid var(--border)", width: "3rem" }}
              >
                #
              </th>
              <th
                className="label-meta p-3 text-left"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                Invariant
              </th>
              <th
                className="label-meta p-3 text-left"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                Enforced by
              </th>
            </tr>
          </thead>
          <tbody>
            {invariants.map((row) => (
              <tr key={row.n}>
                <td
                  className="p-3 text-sm tabular"
                  style={{ borderBottom: "1px solid var(--border)", color: "var(--text-muted)" }}
                >
                  {row.n}
                </td>
                <td className="p-3 text-sm" style={{ borderBottom: "1px solid var(--border)" }}>
                  {row.statement}
                </td>
                <td
                  className="p-3 text-sm"
                  style={{
                    borderBottom: "1px solid var(--border)",
                    color: "var(--text-secondary)",
                  }}
                >
                  {row.guardrail}
                </td>
              </tr>
            ))}
          </tbody>
        </ScrollTable>
      </Section>

      <Section tone="surface" id="guardrail-philosophy">
        <h2 className="m-0 mb-4" style={{ fontSize: "var(--font-h2)", maxWidth: "40rem" }}>
          {guardrailPhilosophy.title}
        </h2>
        <ProseP>{guardrailPhilosophy.body}</ProseP>
      </Section>

      <Section id="deployment-models">
        <h2 className="m-0 mb-4" style={{ fontSize: "var(--font-h2)", maxWidth: "40rem" }}>
          {deploymentModels.title}
        </h2>
        <ProseP className="mb-6">{deploymentModels.body}</ProseP>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {deploymentModels.rows.map((row) => (
            <div key={row.label} className="inst-card p-5">
              <h3 className="m-0 mb-2 text-base font-semibold">{row.label}</h3>
              <p
                className="m-0 text-sm"
                style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}
              >
                {row.detail}
              </p>
            </div>
          ))}
        </div>
        <p className="m-0 mt-6 text-sm" style={{ color: "var(--text-muted)" }}>
          {onPremNote}
        </p>
      </Section>
    </>
  );
}
