export const productHero = {
  title: "Three deliverables, one governed path from questionnaire to working agent",
  body: "ARM is built as three cooperating pieces. Each is described here at the level of detail in its own implementation guide — what it does, what it deliberately does not do, and its current build status (see /product#roadmap).",
};

export const deliverables = [
  {
    id: "downloader",
    kicker: "The employee path",
    title: "The questionnaire and the downloader",
    summary:
      "A non-technical employee opens a link, answers 6–9 multiple-choice questions about their job, and downloads one signed client. No role key, no config file, no terminal.",
    details: [
      "Every question is multiple-choice or multi-select — there is no free-text question anywhere in this path, on purpose. Free text is content, and content is not allowed to reach the control plane (Invariant 1). The questionnaire schema has no \"text\" question kind at all, so this isn't a policy that could be forgotten — it's not representable.",
      "\"Custom downloader\" means one signed generic client plus a per-user signed setup token, not a per-user compiled binary. A per-user binary breaks code signing and notarization and defeats CDN caching — the token carries the customization instead, either as a small companion file or a 6-character activation code.",
      "The setup token is short-lived (15 minutes), single-use, and stored as a hash — never the raw token. It never carries a credential, a secret, or free text.",
      "If a package needs approval, the install still completes — the agent is configured immediately and tool access waits on the approver. The employee is never blocked on someone else's queue.",
    ],
    scope: "Desktop GUI is explicitly out of scope (A7) — the surface is the web questionnaire plus signed platform installers wrapping the CLI.",
  },
  {
    id: "artifactory",
    kicker: "What gets installed",
    title: "The library — a real artifactory",
    summary:
      "Immutable, content-addressed, versioned storage for everything an agent can be given: MCP servers, skills, sub-agents, templates, prompt packs, connectors — organized by job function, not by an ad hoc tag.",
    details: [
      "Three layers, cleanly separated: a component is what a thing is (identity, kind, owner, review status); a component_version is what it has (an immutable manifest, optionally a blob digest); a component_blob is what it weighs (content-addressed bytes in a pluggable storage backend — filesystem, S3, or a stub for OCI).",
      "A published version is never edited. Corrections ship as a new version; the only mutable field on a version is a yank flag. Every install verifies a sha256 digest before use — a tampered blob is a hard failure, not a warning.",
      "Tenant-authored components (a skill someone wrote containing internal process knowledge) are content and live in the tenant's own storage, never the control plane's, regardless of where the artifact metadata lives (the blob-residency rule, Invariant 1).",
      "Work packages — pinned sets of component versions plus routing, budget, and permissions — reference the artifactory; the artifactory has no knowledge of packages. That dependency direction is enforced mechanically, not by convention.",
    ],
    scope: "Cross-tenant artifact sharing, paid/licensed components, and semantic search are explicitly out of scope for this phase.",
  },
  {
    id: "adoption",
    kicker: "What management sees",
    title: "Adoption dashboards, with cost as the second tab",
    summary:
      "The activation funnel, stalls, time-to-value, and coverage by job function — reframed from \"what did AI cost us\" to \"how much of the company is actually using agents, and where is it stalling.\"",
    details: [
      "The funnel tracks each step from invitation through weekly-active use, with error codes and abandonment surfaced, not hidden — a stalled activation is exactly as visible as a successful one.",
      "Coverage shows which job functions have a package and activated seats versus eligible seats — so a gap in the library shows up as a number on a dashboard, not just an anecdote.",
      "Cost moves down: the primary spend view becomes cost per active seat and cost per work product, with the closed-vs-self-hosted split demoted to a secondary panel, matching the locked value-prop order (A1).",
      "Every agent's stakeholder, budget lineage, and tool grants remain visible from the same surface — governance and adoption share one dashboard, not two.",
    ],
    scope: "Realtime is scoped to the two panels that need it (funnel, recent activations); everything else is server-rendered with revalidation, not a general-purpose live feed.",
  },
];

export const roadmapHeading = "What's built, what's in progress, what's planned";
export const roadmapIntro =
  "Investors and engineers get the same table. Full evidence: docs/implementation-audit.md.";
