---
title: "Guide 04 — Public site + live demo"
date: 2026-08-21
status: proposed
owner_agent: site
---

# Guide 04 — Public Site and Live Demo

**Mission.** A page that explains ARM to an investor in ninety seconds and to a
prospective customer in five minutes, plus a click-through demo of the real
dashboard on fixture data. Honest, specific, and self-contained.

**Prerequisite:** guide 00 landed. You are the least coupled of the four modules —
start immediately.

**You own:** `apps/public/**` (currently an empty directory) and `docs/figures/**`.

---

## 1. Shape

New Next.js app in `apps/public`, port **3200**, statically exported where possible.
It shares the design tokens with the dashboard (import the same CSS custom
properties) so the marketing surface and the product look like one system — but it
has its own layout, wider type, and no sidebar.

```
/                 the ninety-second story
/product          the three deliverables, in depth
/architecture     how it works, with real diagrams
/security         invariants, data boundaries, deployment models
/demo             → the live demo (see §4)
/faq
```

---

## 2. Narrative — lead with adoption (A1)

The order of the argument is the order of the value prop. Do not lead with cost;
cost is the second beat, and on-prem is a line in the deployment table.

**Above the fold.** One sentence on the problem, one on what ARM does, one CTA to
the demo. The problem, stated plainly: _companies buy AI seats and a small technical
minority uses them; everyone else never gets a correctly configured agent, so
adoption stalls and nobody can see it._

**Then, in order:**

1. **Adoption at scale** — the questionnaire → download → working agent path, shown
   as three screenshots. The claim to make concrete: an employee who has never
   opened a terminal is productive in minutes. Then the management half: the
   activation funnel, so a CIO can see which departments are actually using AI and
   where people are stalling.
2. **Governance that comes with it** — every agent has one accountable human, budgets
   inherit down the org tree, tool access is authorized and audited, prompt bodies
   never leave the customer's network.
3. **Cost control** — cost per active seat and cost per work product; budgets and
   priority tiers; the savings ledger. Secondary beat, one screen.
4. **Deployment** — SaaS or self-hosted, and _"bring your own models, including
   self-hosted open models, if you want them"_. One row in a table. Do not build a
   page around on-prem LLMs.

**Honesty constraints — non-negotiable:**

- No invented customers, logos, testimonials, case studies, or adoption numbers.
- No fabricated metrics. Where a number would go, either use a figure computed from
  the committed simulation dataset and say so, or write the target and label it a
  target.
- Anything not yet built is described in future tense or omitted. The phase status is
  in `docs/implementation-audit.md` — read it before writing a capability claim.
- Screenshots come from the real dashboard. `demo/profiles/*.png` and the two videos
  in `demo/` already exist and are real captures; prefer them over mockups.

---

## 3. Diagrams

Three inline SVGs, hand-authored, theme-aware (define colours as CSS variables that
flip with the theme, never hard-coded hex inside the SVG), with `<title>`/`<desc>`
for screen readers and text that stays legible at mobile widths:

1. **The employee path** — questionnaire → signed token → download → configured,
   metered agent. Four boxes and the artifacts that move between them.
2. **Control plane / data plane split** — showing the boundary explicitly: metadata
   and audit cross it; prompt bodies and resource content never do. Derive it from
   spec §3.1/§3.3 rather than inventing a topology.
3. **The artifactory** — component → version → digest → package → installed agent.

Source them from the spec's existing diagrams so they cannot drift into fiction.
Save exports to `docs/figures/` so the spec can reference the same assets.

---

## 4. `/demo` — the live demo

Do **not** rebuild the dashboard. Run the real one in demo mode.

**Mechanism.** `@arm-app/web` already runs entirely on fixtures through the real
tRPC pipeline. Add a deployment of it with:

- `ARM_FIXTURE_MODE=1` (the flag the `server` agent introduces) — fixture reads.
- `ARM_DEMO=1` — auth bypassed onto a fixed demo tenant, persona switcher exposed in
  the header (exec / plant manager / engineer / InfoSec), and **every mutation
  procedure short-circuits to a no-op** that returns a "demo mode — not saved" toast.
- The "sample data" badge the `server` agent adds is visible on every page. A viewer
  must never be able to mistake fixture numbers for a real customer's.

`/demo` on the marketing site is a landing page — what to look at, three suggested
click paths, then a link that opens the dashboard deployment. Do not iframe it;
iframing a Next app inside another Next app buys nothing and breaks the persona
switcher's routing.

**Demo dataset.** `apps/simulation` generates realistic org trees, agents, spend and
classification data. Generate a 90-day dataset once, snapshot it to committed JSON
under `apps/control-plane/web/src/lib/demo-data/`, and load it when `ARM_DEMO=1`.
Committed and deterministic — a demo that regenerates differently on each deploy is
a demo that breaks during a call. Include the unflattering parts: stalled
activations, an over-budget department, a denied access request. A demo with no
problems in it reads as fake to anyone who has run an enterprise.

**Guard.** Add `demo-mode-readonly` to the guardrail suite: when `ARM_DEMO=1`, no
tRPC mutation may reach a write path. Mutation-proof it.

---

## 5. Investor-specific content

Keep it on `/` and `/product` rather than a separate gated page:

- The category claim: gateways meter traffic, policy engines evaluate rules; neither
  gets an agent into the hands of an employee who has never used one. Source the
  competitive framing from `docs/solutions/competitive-analysis.md` — it is already
  researched, and it names the competitors accurately.
- What is built vs what is planned, stated plainly with the phase plan. Investors
  respond better to a legible roadmap than to a vague "platform".
- The moat argument in one paragraph: the job-function library plus the adoption data
  compound — every questionnaire answer that finds no package is a roadmap item, and
  every install makes the next role's package easier.

---

## 6. Technical requirements

- Self-contained: no external hosts except Google Fonts. Inline CSS/JS or bundle it;
  images optimized and served from the app.
- Responsive, desktop-first but genuinely usable at 375px. No horizontal page scroll;
  wide tables and diagrams scroll inside their own container.
- Dark mode via the same CSS-variable pattern as the dashboard; define the full light
  palette on `:root` and override only what changes.
- WCAG 2.1 AA: contrast, focus rings, skip link, landmarks, alt text on every image,
  reduced-motion honoured on any animation.
- Lighthouse ≥ 95 on performance and accessibility for `/`.
- Videos (`demo/*.mp4`): poster image, no autoplay with sound, captions or a text
  summary beside them.
- No third-party analytics, tag managers, or session recorders. If usage measurement
  is wanted later, that is a decision with a privacy review, not a default.
- Copy lives in typed content modules (`src/content/*.ts`), not scattered through
  JSX, so it can be edited without touching layout.

---

## 7. Tests

- Vitest component tests on the content-driven sections (they must render from the
  content modules with no hard-coded copy).
- Playwright: `/` loads, every nav link resolves, `/demo` link opens the dashboard,
  no console errors, no horizontal overflow at 375/768/1440.
- axe accessibility pass on every route.
- A link-integrity test: no dead internal links, no external link to a domain that is
  not on an allowlist committed in the repo.
- A content honesty test — grep the content modules for a committed list of banned
  patterns (customer-logo filenames, "trusted by", testimonial markup) and fail if
  one appears. Cheap, and it keeps the constraint enforceable after you are gone.

---

## 8. Acceptance criteria

- [ ] `apps/public` runs on 3200; all six routes render; static export works.
- [ ] Narrative order is adoption → governance → cost → deployment (A1).
- [ ] Zero fabricated customers, logos, testimonials, or metrics; every number traceable to the committed dataset or labelled a target.
- [ ] Three theme-aware inline SVG diagrams, also exported to `docs/figures/`.
- [ ] `/demo` opens the real dashboard in demo mode with the persona switcher, sample-data badge, and no-op mutations.
- [ ] Committed 90-day demo dataset, deterministic, including stalls and an over-budget scope.
- [ ] `demo-mode-readonly` guardrail added and mutation-proofed.
- [ ] Lighthouse ≥ 95 (perf + a11y) on `/`; axe clean on all routes.
- [ ] `pnpm typecheck && pnpm test && pnpm guardrails` green; Playwright suite passes.

## 9. Out of scope

Pricing pages, a signup or billing flow, a CMS, a blog, email capture, and any change
to `apps/control-plane/web` beyond reading the flags the `server` agent provides —
if a demo-mode hook is missing there, report it rather than editing that app.

## 10. Docs to update

`README.md` (add `apps/public` to the layout and a run command);
`docs/arm-spec.md` §15 (repo layout); `docs/figures/` (diagram sources committed
alongside exports).
