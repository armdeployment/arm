"use client";

/**
 * Package card — reused from the retired /catalog page's card layout (guide
 * 02 §4: "Reuse the card layout from the existing /catalog page, then
 * delete that page"). The Request button now calls `catalog.requestAssignment`
 * for real (it was visual-only with a TODO before this PR).
 */

import { useState } from "react";
import { trpc } from "../../lib/trpc/client";

/** Dev-mode stand-in for the authenticated user. The API route handler
 *  (apps/control-plane/web/src/app/api/trpc/[trpc]/route.ts) already
 *  hardcodes a dev tenant/user (`sub: "dev-user"`) until real OIDC lands
 *  (TODO tracked there) — `sub` isn't a UUID, so `requestAssignment`
 *  (which validates `assigneeId` as `.uuid()`) needs a placeholder that IS
 *  a valid UUID. Matches the existing fixture-id convention in
 *  packages/trpc/src/catalog-router.ts (60000000-... range). */
const DEV_USER_ID = "70000000-0000-4000-8000-000000000099";

export interface PackageCardData {
  id: string;
  roleKey: string;
  name: string;
  family: string;
  mode: "copilot" | "automated";
  description: string;
  componentCount: number;
  monthlyUsdCap: number | null;
}

const MODE_STYLES: Record<string, string> = {
  copilot: "bg-teal-50 text-teal-700 ring-1 ring-teal-200",
  automated: "bg-amber-50 text-[var(--warning)] ring-1 ring-amber-200",
};

export function PackageCard({ pkg }: { pkg: PackageCardData }) {
  const [justRequested, setJustRequested] = useState(false);
  const utils = trpc.useUtils();
  const detail = trpc.catalog.getPackage.useQuery({ packageId: pkg.id });
  const request = trpc.catalog.requestAssignment.useMutation({
    onSuccess: () => {
      setJustRequested(true);
      void utils.catalog.listAssignments.invalidate();
    },
  });

  const latestVersionId = detail.data?.versions[detail.data.versions.length - 1]?.id;
  const requested = justRequested || request.isSuccess;

  function onRequest() {
    if (!latestVersionId) return;
    request.mutate({ packageVersionId: latestVersionId, assigneeType: "user", assigneeId: DEV_USER_ID });
  }

  return (
    <div
      className="flex flex-col rounded-lg border p-5"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)", boxShadow: "var(--shadow-sm)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{pkg.name}</div>
          <div className="mt-0.5 font-mono text-[11px]" style={{ color: "var(--gold)" }}>{pkg.roleKey}</div>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase ${MODE_STYLES[pkg.mode] ?? ""}`}>
          {pkg.mode}
        </span>
      </div>

      <div className="mt-1 text-[11px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{pkg.family}</div>

      <p className="mt-3 flex-1 text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{pkg.description}</p>

      <div className="mt-4 flex flex-wrap gap-1">
        <span className="rounded bg-[var(--navy-light)] px-1.5 py-0.5 text-[10px] font-semibold" style={{ color: "var(--navy)" }}>
          {pkg.componentCount} component{pkg.componentCount === 1 ? "" : "s"}
        </span>
        {pkg.monthlyUsdCap != null && (
          <span className="rounded bg-[var(--bg-elevated)] px-1.5 py-0.5 text-[10px]" style={{ color: "var(--text-secondary)" }}>
            ${pkg.monthlyUsdCap}/mo cap
          </span>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t pt-3" style={{ borderColor: "var(--border)" }}>
        <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
          {pkg.mode === "copilot" ? "human-in-the-loop" : "runs unattended"}
        </div>
        <button
          onClick={onRequest}
          disabled={requested || !latestVersionId || request.isPending}
          className="rounded-lg px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
          style={{ backgroundColor: requested ? "var(--success)" : "var(--navy)" }}
        >
          {requested ? "Requested ✓" : request.isPending ? "Requesting…" : "Request"}
        </button>
      </div>
      {request.isError && (
        <p className="mt-2 text-[11px]" style={{ color: "var(--danger)" }}>{request.error.message}</p>
      )}
    </div>
  );
}
