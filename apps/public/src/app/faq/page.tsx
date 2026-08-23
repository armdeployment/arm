import type { Metadata } from "next";
import { Section } from "@/components/ui";
import { faqHero, faqItems } from "@/content/faq";

export const metadata: Metadata = { title: "FAQ" };

export default function FaqPage() {
  return (
    <>
      <Section tone="dark" className="py-14 sm:py-20">
        <h1 className="m-0 mb-4 font-semibold" style={{ fontSize: "var(--font-h1)", maxWidth: "40rem", color: "var(--text-on-dark)" }}>
          {faqHero.title}
        </h1>
        <p style={{ fontSize: "var(--font-lead)", maxWidth: "42rem", color: "var(--text-on-dark-secondary)", lineHeight: 1.6 }} className="m-0">
          {faqHero.body}
        </p>
      </Section>

      <Section>
        <dl className="m-0 flex flex-col gap-8" style={{ maxWidth: "44rem" }}>
          {faqItems.map((item) => (
            <div key={item.question}>
              <dt className="m-0 mb-2 text-lg font-semibold">{item.question}</dt>
              <dd className="m-0 text-sm" style={{ color: "var(--text-secondary)", lineHeight: 1.7 }}>
                {item.answer}
              </dd>
            </div>
          ))}
        </dl>
      </Section>
    </>
  );
}
