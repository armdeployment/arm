"use client";

/**
 * /rollout — the admin side of adoption (docs/guides/02-server-panels.md
 * §3). Everything here calls `onboarding.*`, which is a Wave-0 placeholder
 * (packages/trpc/src/onboarding-router.ts, owned by the `client` Wave-1
 * agent, docs/guides/03-client-downloader.md) — every procedure returns a
 * typed empty fixture until that module lands.
 *
 * ── A flagged contract gap ───────────────────────────────────────────────
 * Guide 02 §3 describes four admin surfaces: a questionnaire-VERSION
 * designer (list/edit/PUBLISH), campaign CREATE with a shareable link +
 * per-user codes + CSV export, a DOWNLOAD-ARTIFACTS list (installers,
 * SHA256s, MDM links), and a campaign-scoped live funnel. The onboarding
 * procedure names are frozen by guide 00 §8:
 *   getQuestionnaire, submitResponse, recommend, issueSetupToken,
 *   redeemSetupToken, resolveActivationCode
 * None of these list versions, publish, create/list a "campaign", or list
 * installer artifacts — guide 00 shipped a single-questionnaire /
 * single-token surface, not a batch-campaign one, and no download-artifact
 * procedure exists AT ALL. `onboarding-router.ts` is `client`-owned (not
 * `server`'s to extend, docs/guides/README.md file-ownership table), so
 * this page is built against the six procedures as they exist:
 *   - "Questionnaire" shows the current published definition
 *     (`getQuestionnaire`) rather than a version list/editor.
 *   - "Campaigns" issues ONE setup token/activation code at a time
 *     (`issueSetupToken`) rather than a batch invite with CSV export.
 *   - "Download artifacts" has no procedure to read at all — rendered as
 *     an explicit, labeled gap, not fabricated data.
 *   - "Live campaign funnel" reuses this PR's own `adoption.funnel`,
 *     scoped org-wide (no per-campaign scope exists yet).
 * Flagged in the PR description / final report as a guide-02/guide-00
 * mismatch worth resolving upstream, per the instruction to report rather
 * than silently improvise a new contract shape into a file this agent
 * doesn't own.
 */

import { useState } from "react";
import { FunnelPanel } from "../../components/adoption/funnel-panel";
import { trpc } from "../../lib/trpc/client";

export default function RolloutPage() {
  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Rollout</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Questionnaire designer, campaigns, download artifacts — the admin side of adoption
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <QuestionnaireDesigner />
        <CampaignIssuer />
      </div>

      <DownloadArtifacts />

      <div>
        <h2 className="label-meta mb-3">Live Campaign Funnel</h2>
        <p className="mb-3 text-[11px]" style={{ color: "var(--text-muted)" }}>
          Org-wide (no per-campaign scoping in the current onboarding contract — see file header).
        </p>
        <FunnelPanel scope={null} />
      </div>
    </div>
  );
}

// ── Questionnaire designer ──────────────────────────────────────────────

function QuestionnaireDesigner() {
  const q = trpc.onboarding.getQuestionnaire.useQuery();

  return (
    <section className="inst-card p-5">
      <h3 className="label-meta mb-1">Questionnaire</h3>
      <p className="mb-4 text-[11px]" style={{ color: "var(--text-muted)" }}>
        Graph editing is a form over the node list, not a visual editor. Definitions are immutable once published.
      </p>

      {q.isLoading && <div className="h-24 animate-pulse rounded" style={{ backgroundColor: "var(--bg-elevated)" }} />}
      {q.isError && (
        <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>Couldn&apos;t load the questionnaire.</p>
      )}
      {q.data && !q.data.questionnaire && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border py-10 text-center" style={{ borderColor: "var(--border)" }}>
          <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>No questionnaire published yet</span>
          <span className="max-w-xs text-[11px]" style={{ color: "var(--text-muted)" }}>
            Lands with docs/guides/03-client-downloader.md (packages/questionnaire). This card reads
            <code> onboarding.getQuestionnaire</code> and will populate automatically.
          </span>
          <button
            disabled
            title="Publishing requires an onboarding.publishQuestionnaire procedure not yet in the frozen contract"
            className="mt-2 rounded-lg px-4 py-1.5 text-xs font-semibold text-white opacity-50"
            style={{ backgroundColor: "var(--navy)" }}
          >
            Publish new version
          </button>
        </div>
      )}
    </section>
  );
}

// ── Campaigns (single setup-token issuance — see file header) ──────────────

function CampaignIssuer() {
  const [packageVersionIds, setPackageVersionIds] = useState("");
  const issue = trpc.onboarding.issueSetupToken.useMutation();

  const ids = packageVersionIds
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  return (
    <section className="inst-card p-5">
      <h3 className="label-meta mb-1">Campaigns</h3>
      <p className="mb-4 text-[11px]" style={{ color: "var(--text-muted)" }}>
        Issues a setup token + activation code for one or more work-package versions (single-token surface — see file header for the batch-campaign gap).
      </p>

      <div className="flex gap-2">
        <input
          value={packageVersionIds}
          onChange={(e) => setPackageVersionIds(e.target.value)}
          placeholder="Package version id(s), comma-separated"
          aria-label="Package version ids"
          className="flex-1 rounded-md border px-3 py-1.5 text-[12px]"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}
        />
        <button
          onClick={() => issue.mutate({ packageVersionIds: ids })}
          disabled={issue.isPending || ids.length === 0}
          className="rounded-lg px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          style={{ backgroundColor: "var(--navy)" }}
        >
          {issue.isPending ? "Issuing…" : "Issue setup token"}
        </button>
      </div>

      {issue.data && (
        <div className="mt-4 rounded-md border p-3 text-[11px]" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-elevated)" }}>
          <div>
            Activation code: <strong>{issue.data.activationCode}</strong>
          </div>
          <div className="mt-1" style={{ color: "var(--text-muted)" }}>
            Expires: {new Date(issue.data.expiresAt).toLocaleString()}
          </div>
          <p className="mt-1" style={{ color: "var(--text-muted)" }}>
            `/start` link, per-user activation codes, and CSV export populate once a batch-campaign procedure lands
            (docs/guides/03-client-downloader.md) — for now this issues one token per click.
          </p>
        </div>
      )}
    </section>
  );
}

// ── Download artifacts — explicit contract gap, no fabricated data ─────────

function DownloadArtifacts() {
  return (
    <section className="inst-card p-5">
      <h3 className="label-meta mb-1">Download Artifacts</h3>
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border py-10 text-center" style={{ borderColor: "var(--border)" }}>
        <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Not available yet</span>
        <span className="max-w-md text-[11px]" style={{ color: "var(--text-muted)" }}>
          Installer versions, SHA256s, and MDM package links (guide 02 §3) have no corresponding procedure in the
          frozen onboarding contract (guide 00 §8) — this is a genuine gap, not a loading state. See this file&apos;s
          header comment. Populates once `client` publishes those artifacts (docs/guides/03-client-downloader.md).
        </span>
      </div>
    </section>
  );
}
