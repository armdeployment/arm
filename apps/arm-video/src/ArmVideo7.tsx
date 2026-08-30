import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";
import { COLORS } from "./theme";
import { SceneV7Intro } from "./Scenes/Video7/SceneV7Intro";
import { SceneV7Outro } from "./Scenes/Video7/SceneV7Outro";
import { ActCard } from "./Scenes/Video7/ActCard";
import { ShowcaseScene, type ShowcaseSceneProps } from "./Scenes/Video7/ShowcaseScene";

const FPS = 30;
const T = 12;

const EMPLOYEE = COLORS.cyan;
const MANAGER = COLORS.gold;
const SERVER = COLORS.green;

/** Every showcase beat, in order. Durations in seconds. */
const SHOWCASE: Array<ShowcaseSceneProps & { name: string; seconds: number }> = [
  // ── Act 1 · Employee ──────────────────────────────────────────────────
  {
    name: "Questionnaire",
    seconds: 6,
    accent: EMPLOYEE,
    kicker: "Employee · localhost:3300/start",
    title: "Six Questions. No Free Text, Ever.",
    image: "install-e2e/01-role-cluster.png",
    imagePosition: "50% 12%",
    caption: "Real screenshot — the manufacturing questionnaire graph",
    facts: [
      { label: "Deterministic by construction", detail: "score() is pure — no LLM, no I/O. The same answers always rank the same job function, so a manager can be told exactly why someone got a package.", tone: "good" },
      { label: "Structured answers only", detail: "No free-text field exists in this flow. Invariant 1 holds at the UI layer, not just the API.", tone: "accent" },
    ],
  },
  {
    name: "Recommendation",
    seconds: 6,
    accent: EMPLOYEE,
    kicker: "Employee · recommendation → activation code",
    title: "One Package, One Real Code",
    image: "install-e2e/03-download.png",
    imagePosition: "50% 20%",
    caption: "Real screenshot — a real 6-character code with a real 15-minute expiry",
    facts: [
      { label: "Recommended", value: "Senior Manager", tone: "neutral" },
      { label: "Auto-approves", detail: "A6: low-risk packages install immediately; higher-risk ones install anyway and gate tool access on approval. The install never blocks.", tone: "good" },
      { label: "One signed generic client", detail: "Never a per-user compiled binary — the per-user part is the token, not the executable.", tone: "accent" },
    ],
  },
  {
    name: "GuiInstall",
    seconds: 7,
    accent: EMPLOYEE,
    kicker: "Employee · arm setup, no arguments",
    title: "The Installer Opens a Browser, Not a Prompt",
    image: "install-e2e/04-gui-activate.png",
    imagePosition: "50% 18%",
    caption: "Real screenshot — a local server on 127.0.0.1 the CLI just started",
    facts: [
      { label: "Zero terminal typing", detail: "Paste the code or drop the .armsetup file. That is the entire interaction.", tone: "good" },
      { label: "Runtimes come bundled", detail: "MCPs needing python3 or node get a verified portable build downloaded automatically — never 'go install Python first'.", tone: "accent" },
    ],
  },
  {
    name: "Installed",
    seconds: 7,
    accent: EMPLOYEE,
    kicker: "Employee · real redemption",
    title: "Installed, Online, Tools Ready to Connect",
    image: "install-e2e/05-gui-installed.png",
    imagePosition: "50% 4%",
    caption: "Real screenshot — package, budget, 8 components, guided connection steps",
    facts: [
      { label: "Package", value: "senior_manager", tone: "neutral" },
      { label: "Budget", value: "$300/mo", tone: "neutral" },
      { label: "No secret ever written to disk", detail: "Configs carry env-var references only; the token lands in .arm-env at mode 0600. assertNoSecretsInConfig fails the install otherwise.", tone: "accent" },
    ],
  },
  {
    name: "ChatRefine",
    seconds: 7,
    accent: EMPLOYEE,
    kicker: "Employee · optional refinement",
    title: "Describe the Job. Scan the Projects.",
    image: "install-e2e/07-gui-refine.png",
    imagePosition: "50% 58%",
    caption: "Real screenshot — a real LLM reply and a real two-folder scan",
    facts: [
      { label: "Chat runs through the tenant's own proxy", detail: "Same armProxyUrl + agentToken as every other tool call. Never a third party, never ARM's control plane.", tone: "accent" },
      { label: "Folders read extensions only", detail: "Never file names, never contents. All local. Only the derived tags travel.", tone: "good" },
    ],
  },

  // ── Act 2 · Manager ───────────────────────────────────────────────────
  {
    name: "Adoption",
    seconds: 8,
    accent: MANAGER,
    kicker: "Manager · /adoption",
    title: "Where Adoption Actually Stalls",
    image: "full-demo/mgr-02-adoption.png",
    imagePosition: "0% 6%",
    caption: "Real screenshot — live ClickHouse activation_event rows",
    facts: [
      { label: "Weekly active", value: "103", tone: "good" },
      { label: "Activated / eligible", value: "132 / 383", tone: "neutral" },
      { label: "Top stall cause", detail: "MDM push failed on corporate device (35) — the funnel names WHERE and WHY people fall out, not just that spend is low.", tone: "accent" },
    ],
    note: "Adoption failure is the thesis-level risk: if nobody activates, the metering backbone collapses no matter how correct the platform is.",
  },
  {
    name: "Governance",
    seconds: 8,
    accent: MANAGER,
    kicker: "Manager · /governance",
    title: "Budgets, Approvals, Cost per Work Product",
    image: "full-demo/mgr-04-governance.png",
    imagePosition: "0% 4%",
    caption: "Real screenshot — package budgets and a live approvals inbox",
    facts: [
      { label: "Material Planner over cap", value: "$612 / $600", tone: "neutral" },
      { label: "Cost per work product", detail: "$214 per 8D report — with a rework-rate counterweight, so re-opened work re-burns tokens and the number stays honest.", tone: "accent" },
      { label: "One-tap approvals", detail: "The package is the unit of governance: budget, approval, and metering all attach to it.", tone: "good" },
    ],
  },
  {
    name: "Organization",
    seconds: 7,
    accent: MANAGER,
    kicker: "Manager · /organization",
    title: "Every Company Shape, One Tool",
    image: "full-demo/mgr-06-organization.png",
    imagePosition: "0% 6%",
    caption: "Real screenshot — HQ + three plants, with regulatory tags",
    facts: [
      { label: "22 nodes · 3 plants", detail: "Manufacturing HQ + plants, holding-company subsidiaries, or a flat fintech with Chinese walls — provisioned from industry profiles.", tone: "neutral" },
      { label: "Profiles set defaults, never gate", detail: "Runtime code never reads the profile id. A tech tenant can define a plant_manager role too — enforced by the no-profile-branching guardrail.", tone: "accent" },
    ],
  },

  // ── Act 3 · Server / library ──────────────────────────────────────────
  {
    name: "LibraryPackages",
    seconds: 7,
    accent: SERVER,
    kicker: "Server · /library — packages",
    title: "The Library: Signed, Versioned, Immutable",
    image: "full-demo/srv-01-library-packages.png",
    imagePosition: "0% 6%",
    caption: "Real screenshot — work packages served from Postgres",
    facts: [
      { label: "A package is a role's whole toolkit", detail: "MCP tools, skills, sub-agents, permissions, model routing, budget template, starter prompts — pinned to exact versions.", tone: "neutral" },
      { label: "Content-addressed", detail: "Every version carries a sha256 over its canonical manifest. The client recomputes it and refuses to install on mismatch.", tone: "accent" },
    ],
  },
  {
    name: "LibraryComponents",
    seconds: 7,
    accent: SERVER,
    kicker: "Server · /library — components",
    title: "79 Components, Faceted Live",
    image: "full-demo/srv-02-library-components.png",
    imagePosition: "0% 6%",
    caption: "Real screenshot — facet counts computed over real Postgres rows",
    facts: [
      { label: "Kinds", detail: "21 CLI · 20 skill · 15 http_api · 13 template · 5 subagent · 2 MCP · 2 connector · 1 prompt pack", tone: "neutral" },
      { label: "Source", value: "78 / 1", detail: "first_party vs tenant_authored — provenance is a first-class facet, not a footnote.", tone: "accent" },
    ],
  },
  {
    name: "LibraryDiscovery",
    seconds: 7,
    accent: SERVER,
    kicker: "Server · /library — discovery",
    title: "New Tools Enter Through One Reviewed Door",
    image: "full-demo/srv-03-library-discovery.png",
    imagePosition: "0% 10%",
    caption: "Real screenshot — a candidate awaiting scope-admin triage",
    facts: [
      { label: "Promote writes a real component", detail: "review_status='draft', source_kind='imported' — it enters the same signed pipeline as anything first-party.", tone: "good" },
      { label: "Built for the tools with no MCP yet", detail: "Plenty of engineering software has none. Candidates can be drafted from vendor docs, then reviewed — never auto-trusted.", tone: "accent" },
    ],
  },
  {
    name: "Assignments",
    seconds: 7,
    accent: SERVER,
    kicker: "Server · /assignments",
    title: "Who Has What, and Who Approved It",
    image: "full-demo/mgr-03-assignments.png",
    imagePosition: "0% 4%",
    caption: "Real screenshot — the D9 assignment state machine in Postgres",
    facts: [
      { label: "requested → approved → active → revoked", detail: "Every transition is a real row with an approver and a timestamp — this is the audit trail, not a log line.", tone: "accent" },
      { label: "Assignees are users, org nodes, or agents", detail: "A whole plant can hold a package, not just a person.", tone: "neutral" },
    ],
  },
];

const showcaseFrames = SHOWCASE.reduce((sum, s) => sum + s.seconds, 0) * FPS;
const CARD_SECONDS = 4;
const INTRO_SECONDS = 8;
const OUTRO_SECONDS = 9;

/** 3 act cards + intro + outro + every showcase, minus one transition each. */
export const ARM_VIDEO_7_DURATION =
  (INTRO_SECONDS + CARD_SECONDS * 3 + OUTRO_SECONDS) * FPS + showcaseFrames - (SHOWCASE.length + 4) * T;

/**
 * VIDEO 7 — "ARM: The Complete System"
 * The full product in one pass: what it is and why it splits into two
 * planes, then three acts — the employee installing an agent, the manager
 * governing adoption and spend, and the server-side library that makes
 * both possible. Every screenshot is a real capture from a live run
 * against real Postgres + ClickHouse.
 */
export const ArmVideo7: React.FC = () => {
  const acts = {
    employee: (
      <ActCard
        act="Act 1 of 3"
        title="The Employee"
        blurb="Someone who has never heard of ARM needs a working agent, and has about a minute of patience. No terminal, no config file, no API key."
        bullets={["questionnaire", "recommendation", "one-click install", "guided connections", "optional refinement"]}
        accent={EMPLOYEE}
      />
    ),
    manager: (
      <ActCard
        act="Act 2 of 3"
        title="The Manager"
        blurb="The person who signs off on the spend needs to know it worked. Adoption first, cost second — because an unused agent costs nothing and returns nothing."
        bullets={["adoption funnel", "stall causes", "budgets", "approvals", "org structure"]}
        accent={MANAGER}
      />
    ),
    server: (
      <ActCard
        act="Act 3 of 3"
        title="The Server Side"
        blurb="The library is the supply side of the whole system: every package an employee can install, every component inside it, and the one reviewed door new tools come through."
        bullets={["work packages", "component registry", "discovery + triage", "assignment state machine"]}
        accent={SERVER}
      />
    ),
  };

  const beats: Array<{ key: string; seconds: number; node: React.ReactNode }> = [
    { key: "intro", seconds: INTRO_SECONDS, node: <SceneV7Intro /> },
    { key: "act-employee", seconds: CARD_SECONDS, node: acts.employee },
  ];

  SHOWCASE.forEach((s, i) => {
    if (s.name === "Adoption") beats.push({ key: "act-manager", seconds: CARD_SECONDS, node: acts.manager });
    if (s.name === "LibraryPackages") beats.push({ key: "act-server", seconds: CARD_SECONDS, node: acts.server });
    beats.push({ key: `showcase-${i}-${s.name}`, seconds: s.seconds, node: <ShowcaseScene {...s} /> });
  });

  beats.push({ key: "outro", seconds: OUTRO_SECONDS, node: <SceneV7Outro /> });

  return (
    <TransitionSeries>
      {beats.flatMap((b, i) => [
        ...(i > 0
          ? [
              <TransitionSeries.Transition
                key={`t-${b.key}`}
                presentation={slide({ direction: "from-left" })}
                timing={linearTiming({ durationInFrames: T })}
              />,
            ]
          : []),
        <TransitionSeries.Sequence key={b.key} durationInFrames={b.seconds * FPS} name={b.key}>
          {b.node}
        </TransitionSeries.Sequence>,
      ])}
    </TransitionSeries>
  );
};
