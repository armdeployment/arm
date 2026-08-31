"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "../../lib/trpc/client";
import { emitOnboardingEvent } from "../../lib/activation";

interface SelectedPackage {
  packageVersionId: string;
  name: string;
  approvalRequired: boolean;
}

type Platform = "windows" | "macos" | "linux" | "unknown";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (/Win/i.test(ua)) return "windows";
  if (/Mac/i.test(ua)) return "macos";
  if (/Linux/i.test(ua)) return "linux";
  return "unknown";
}

const PLATFORM_LABELS: Record<Exclude<Platform, "unknown">, string> = {
  windows: "Windows (.msi)",
  macos: "macOS (.pkg)",
  linux: "Linux (.deb/.rpm)",
};

/**
 * /download — platform-detected primary button + all platforms + the
 * 6-character activation code + "send me the link" (docs/guides/
 * 03-client-downloader.md §3). This is where the setup token is issued.
 *
 * A4: the download is the SAME signed generic client for every platform —
 * only the `.armsetup` companion file (a real, downloadable artifact this
 * page produces: `{version, token, control_plane_url}`) is per-user. The
 * platform installer BINARIES themselves are built by `packaging/` and
 * signed in CI (out of this scaffold's reach — no fabricated binaries are
 * served here); each platform button below downloads the same `.armsetup`
 * file, since that is the actual per-user artifact the guide describes —
 * the employee pairs it with whichever signed installer IT distributes.
 */
export default function DownloadPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<SelectedPackage | null>(null);
  const [platform, setPlatform] = useState<Platform>("unknown");
  const issue = trpc.onboarding.issueSetupToken.useMutation();
  const issuedRef = useRef(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("arm_onboarding_selected_package");
    if (!raw) {
      router.replace("/start");
      return;
    }
    setSelected(JSON.parse(raw) as SelectedPackage);
    setPlatform(detectPlatform());
  }, [router]);

  useEffect(() => {
    if (selected && !issuedRef.current) {
      issuedRef.current = true;
      issue.mutate(
        { packageVersionIds: [selected.packageVersionId] },
        {
          onSuccess: () => {
            void emitOnboardingEvent("token_issued", {
              packageVersionId: selected.packageVersionId,
            });
          },
        },
      );
    }
  }, [selected, issue]);

  if (!selected) return null;

  const setupFileHref =
    issue.data && typeof window !== "undefined"
      ? `data:application/json;base64,${window.btoa(
          JSON.stringify({
            version: 1,
            token: issue.data.token,
            control_plane_url: window.location.origin,
          }),
        )}`
      : undefined;

  function trackDownload() {
    void emitOnboardingEvent("downloaded", { packageVersionId: selected!.packageVersionId });
  }

  const platforms: Exclude<Platform, "unknown">[] = ["windows", "macos", "linux"];
  const ordered =
    platform === "unknown" ? platforms : [platform, ...platforms.filter((p) => p !== platform)];

  return (
    <div className="onboarding-shell">
      <div className="onboarding-card">
        <div className="onboarding-prompt">Download your {selected.name} setup</div>
        <p className="onboarding-help">
          One file, no config, no terminal. Install the ARM client for your platform, then
          double-click the file below — it activates automatically.
        </p>

        {issue.isPending ? <p className="onboarding-help">Preparing your setup link…</p> : null}

        {setupFileHref ? (
          <div className="onboarding-platform-row" style={{ flexDirection: "column" }}>
            {ordered.map((p, i) => (
              <a
                key={p}
                href={setupFileHref}
                download="arm-setup.armsetup"
                onClick={trackDownload}
                className={`onboarding-button ${i === 0 ? "onboarding-button-primary" : "onboarding-button-secondary"}`}
                style={{ textAlign: "center", textDecoration: "none" }}
              >
                {i === 0 ? `Download for ${PLATFORM_LABELS[p]}` : PLATFORM_LABELS[p]}
              </a>
            ))}
          </div>
        ) : null}

        {issue.data ? (
          <>
            <p className="onboarding-help" style={{ marginTop: "1.5rem" }}>
              Setting up on a shared or offline machine? Use this activation code with{" "}
              <code>arm setup</code> instead:
            </p>
            <div className="onboarding-code">{issue.data.activationCode}</div>
            <p className="onboarding-help">
              Expires {new Date(issue.data.expiresAt).toLocaleTimeString()} — 15 minutes from now.
            </p>
            <a
              href={`mailto:?subject=${encodeURIComponent("Your ARM setup link")}&body=${encodeURIComponent(
                `Your activation code is ${issue.data.activationCode} — enter it at ${
                  typeof window !== "undefined" ? window.location.origin : ""
                }/start when running "arm setup".`,
              )}`}
              className="onboarding-button onboarding-button-secondary"
              style={{
                textAlign: "center",
                textDecoration: "none",
                display: "inline-block",
                marginTop: "0.75rem",
              }}
            >
              Send me the link
            </a>
          </>
        ) : null}
      </div>
    </div>
  );
}
