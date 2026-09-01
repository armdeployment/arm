import { redirect } from "next/navigation";
import { resolveAuthMode } from "@arm/auth";
import { config } from "@arm/config";

/**
 * Root — sends employees to the questionnaire, unless this deployment cannot
 * authenticate them at all.
 *
 * The gate is narrow on purpose. ARM verifies bearer tokens; it does not run
 * the browser login redirect that obtains one (docs/sso-setup.md), so there is
 * no session for a server component to check and nothing here can stand in for
 * a real SSO gate. What it CAN do is stop walking someone through a
 * questionnaire that will fail on submit: in `refuse` mode — production with no
 * IdP configured, or a half-configured one — every tRPC call returns 401, so
 * the questionnaire is a dead end dressed as a working page.
 *
 * Setup-token redemption stays reachable regardless. That flow is
 * authenticated by the signed token itself (A4), and the employee redeeming it
 * on a brand-new machine has no session by design.
 */
export default function RootPage() {
  const authMode = resolveAuthMode(config);

  if (authMode.kind === "refuse") {
    return (
      <main
        style={{
          maxWidth: "42rem",
          margin: "4rem auto",
          padding: "0 1.5rem",
          fontFamily: "system-ui, sans-serif",
          lineHeight: 1.6,
        }}
      >
        <h1 style={{ fontSize: "1.5rem", marginBottom: "0.75rem" }}>Sign-in isn’t configured</h1>
        <p>
          This ARM deployment can’t authenticate you yet, so starting the questionnaire would fail
          when you submit it. Nothing is wrong with your account.
        </p>
        <p style={{ color: "#555" }}>
          For whoever runs ARM here: set <code>ARM_OIDC_ISSUER_URL</code>,{" "}
          <code>ARM_OIDC_JWKS_URL</code> and <code>ARM_OIDC_AUDIENCE</code>. See{" "}
          <code>docs/sso-setup.md</code>.
        </p>
        <p style={{ color: "#555" }}>
          If you were sent here with an activation code, redemption still works — it doesn’t need a
          sign-in.
        </p>
      </main>
    );
  }

  redirect("/start");
}
