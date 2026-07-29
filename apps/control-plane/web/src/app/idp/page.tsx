export default function IdPPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Identity Providers</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Enterprise IdP integration — ARM authenticates via your existing identity provider
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { name: "Microsoft Entra ID", provider: "entra", desc: "Azure AD / Microsoft 365" },
          { name: "Okta Workforce", provider: "okta", desc: "Enterprise workforce identity" },
          { name: "Google Cloud Identity", provider: "google", desc: "Google Workspace identity" },
          { name: "AWS IAM Identity Center", provider: "aws", desc: "AWS-native SSO" },
          { name: "Auth0", provider: "auth0", desc: "Developer-focused identity" },
          { name: "Generic OIDC", provider: "oidc", desc: "Any OpenID Connect provider" },
          { name: "SAML 2.0", provider: "saml", desc: "Any SAML 2.0 provider" },
        ].map((idp) => (
          <div key={idp.provider} className="rounded-2xl border p-5" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)", boxShadow: "var(--shadow-sm)" }}>
            <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{idp.name}</div>
            <div className="text-[10px] font-mono mb-2" style={{ color: "var(--text-muted)" }}>{idp.provider}</div>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{idp.desc}</p>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border p-6" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)", boxShadow: "var(--shadow-sm)" }}>
        <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Agent Onboarding Flow</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { step: "1", title: "Human authenticates via IdP", desc: "Engineer logs in with corporate account. ARM resolves department+team scope." },
            { step: "2", title: "ARM creates agent identity", desc: "Agent + SubAccount provisioned, API credentials issued, stakeholder assigned." },
            { step: "3", title: "Agent runs via ARM proxy", desc: "Agent tool configured with ARM credentials. All calls flow through proxy with enforcement." },
          ].map((s) => (
            <div key={s.step} className="rounded-xl border p-4" style={{ borderColor: "var(--border)" }}>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white bg-blue-600">{s.step}</div>
              <div className="mt-3 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{s.title}</div>
              <p className="mt-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-2xl border p-5" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)", boxShadow: "var(--shadow-sm)" }}>
        <h3 className="mb-3 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Example: Entra ID Config</h3>
        <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs text-green-400">{`provider: entra
issuer_url: https://login.microsoftonline.com/acmecorp/v2.0
claim_mapping:
  email: "email"           → ARM user.email
  department: "department" → ARM org scope
  groups: "groups"         → ARM role assignment`}</pre>
      </div>
    </div>
  );
}
