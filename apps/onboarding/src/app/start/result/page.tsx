"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Recommendation {
  packageId: string;
  packageVersionId: string;
  slug: string;
  name: string;
  exactMatch: boolean;
  approvalRequired: boolean;
}

interface SubmitResult {
  responseId: string;
  resolvedJobFunctionKey: string | null;
  recommendations: Recommendation[];
}

/**
 * /start/result — "We recommend the <Package> package." (guide 03 §3).
 * Shows what's in it in plain language and an escape hatch to the full
 * eligible list ("something else").
 */
export default function ResultPage() {
  const router = useRouter();
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("arm_onboarding_result");
    if (raw) setResult(JSON.parse(raw) as SubmitResult);
    else router.replace("/start");
  }, [router]);

  if (!result) return null;

  const top = result.recommendations[0];

  if (!top) {
    return (
      <div className="onboarding-shell">
        <div className="onboarding-card">
          <div className="onboarding-prompt">
            We don&apos;t have a standard package for that yet
          </div>
          <p className="onboarding-help">
            Your answers didn&apos;t match one of our standard roles. We&apos;ve flagged this as a
            coverage gap for the library team — no free text was recorded, just a structured marker.
            Ask your admin for a manual setup in the meantime.
          </p>
          <div className="onboarding-nav">
            <button
              type="button"
              className="onboarding-button onboarding-button-secondary"
              onClick={() => router.push("/start")}
            >
              Retake the questionnaire
            </button>
          </div>
        </div>
      </div>
    );
  }

  function choosePackage(pkg: Recommendation) {
    sessionStorage.setItem(
      "arm_onboarding_selected_package",
      JSON.stringify({
        packageVersionId: pkg.packageVersionId,
        name: pkg.name,
        approvalRequired: pkg.approvalRequired,
      }),
    );
    router.push("/download");
  }

  return (
    <div className="onboarding-shell">
      <div className="onboarding-card">
        <div className="onboarding-prompt">
          We recommend the <strong>{top.name}</strong> package
        </div>
        <p className="onboarding-help">
          {top.approvalRequired
            ? "Your agent installs right away — tool access waits on your manager's approval."
            : "This package auto-approves — you'll have full tool access as soon as it installs."}
        </p>
        <div className="onboarding-nav" style={{ justifyContent: "flex-start", gap: "0.75rem" }}>
          <button
            type="button"
            className="onboarding-button onboarding-button-primary"
            onClick={() => choosePackage(top)}
          >
            Get {top.name}
          </button>
          <button
            type="button"
            className="onboarding-button onboarding-button-secondary"
            onClick={() => setShowAll((v) => !v)}
          >
            Something else
          </button>
        </div>

        {showAll && result.recommendations.length > 1 ? (
          <div style={{ marginTop: "1.5rem" }}>
            <div className="onboarding-help">Other packages you're eligible for:</div>
            <div className="onboarding-options">
              {result.recommendations.slice(1).map((pkg) => (
                <button
                  key={pkg.packageVersionId}
                  type="button"
                  className="onboarding-option"
                  onClick={() => choosePackage(pkg)}
                >
                  {pkg.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
