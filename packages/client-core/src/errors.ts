/**
 * Failure taxonomy (docs/guides/03-client-downloader.md §5.1).
 *
 * Every client-side failure gets a stable code, a plain-language message,
 * and a fix. Codes go to `activation_event.error_code` and drive
 * `/adoption`'s stall panel (server-owned) and `apps/onboarding`'s
 * `/help/[step]` pages (client-owned) — so this set is a shared contract.
 * Do not rename a code without updating both.
 */

export const ARM_ERROR_CODES = [
  "RUNTIME_MISSING",
  "RUNTIME_TOO_OLD",
  "TOKEN_EXPIRED",
  "TOKEN_ALREADY_USED",
  "MANIFEST_TAMPERED",
  "DIGEST_MISMATCH",
  "PROXY_UNREACHABLE",
  "NO_AGENT_TOKEN",
  "CONNECTION_DECLINED",
  "DISK_PERMISSION",
] as const;

export type ArmErrorCode = (typeof ARM_ERROR_CODES)[number];

/** Plain-language, non-technical fix for each failure code — shown by `arm
 *  doctor` and rendered by `apps/onboarding`'s /help/[step] pages. */
export const ARM_ERROR_FIXES: Record<ArmErrorCode, string> = {
  RUNTIME_MISSING:
    "The agent runtime is not installed. Re-run the ARM installer — it bundles the runtime — or install opencode manually and try again.",
  RUNTIME_TOO_OLD:
    "Your agent runtime is older than this package requires. Update it (the installer's `arm doctor` command can do this) and re-run setup.",
  TOKEN_EXPIRED:
    "This setup link expired 15 minutes after it was issued. Ask your admin for a fresh link or activation code from the questionnaire.",
  TOKEN_ALREADY_USED: "This setup link was already used — ask IT for a new one.",
  MANIFEST_TAMPERED:
    "The package manifest failed integrity verification. Do not proceed — this can indicate a compromised network or server. Contact IT.",
  DIGEST_MISMATCH:
    "A downloaded component did not match its verified digest. Do not proceed — this can indicate a compromised download. Contact IT.",
  PROXY_UNREACHABLE:
    "ARM could not reach the metering proxy. Check your network connection (VPN required for on-prem tenants) and try again.",
  NO_AGENT_TOKEN:
    "No metered agent token was supplied, so ARM could not verify metered access. Re-run setup with a control-plane minted token.",
  CONNECTION_DECLINED:
    "A required tool connection was declined. Some capabilities will be unavailable until you connect it from the connections wizard.",
  DISK_PERMISSION:
    "ARM could not write to your local config directory. Check folder permissions (or free up disk space) and try again.",
};

/** A client-side failure carrying one of the stable codes above. Every
 *  failure surfaced to a user (CLI output, `arm doctor`, `/help/[step]`)
 *  should be one of these, not a bare Error. */
export class ArmClientError extends Error {
  readonly code: ArmErrorCode;

  constructor(code: ArmErrorCode, message: string) {
    super(message);
    this.name = "ArmClientError";
    this.code = code;
  }

  /** Plain-language fix for this error's code. */
  get fix(): string {
    return ARM_ERROR_FIXES[this.code];
  }
}

export function fixFor(code: ArmErrorCode): string {
  return ARM_ERROR_FIXES[code];
}
