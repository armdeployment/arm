import Link from "next/link";
import { ARM_ERROR_CODES, ARM_ERROR_FIXES, type ArmErrorCode } from "@arm/client-core";

/**
 * /help/[step] — plain-language fixes for each installer failure code
 * (docs/guides/03-client-downloader.md §3, §5.1). `step` is one of the ten
 * stable error codes `@arm/client-core` emits (errors.ts) — the same set
 * `arm doctor` prints and `activation_event.error_code` carries, so this
 * page, the CLI, and the adoption stall panel never drift out of sync.
 */
export default async function HelpPage({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  const code = step.toUpperCase() as ArmErrorCode;
  const known = (ARM_ERROR_CODES as readonly string[]).includes(code);

  return (
    <div className="onboarding-shell">
      <div className="onboarding-card">
        {known ? (
          <>
            <div className="onboarding-prompt">{code.replaceAll("_", " ")}</div>
            <p className="onboarding-help">{ARM_ERROR_FIXES[code]}</p>
          </>
        ) : (
          <>
            <div className="onboarding-prompt">We don&apos;t recognize that error code</div>
            <p className="onboarding-help">
              Run <code>arm doctor</code> from a terminal for a full diagnostic, or contact your IT team.
            </p>
          </>
        )}
        <div className="onboarding-help" style={{ marginTop: "1.5rem" }}>
          Still stuck? Every code:
        </div>
        <div className="onboarding-options">
          {ARM_ERROR_CODES.map((c) => (
            <Link key={c} href={`/help/${c}`} className="onboarding-option" data-selected={c === code}>
              {c.replaceAll("_", " ")}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
