import { interpolate } from "remotion";
import { FONT_SANS, FONT_MONO } from "../theme";

const trafficLights = (
  <div style={{ display: "flex", gap: 6, alignItems: "center", paddingLeft: 10 }}>
    <div style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#FF5F57" }} />
    <div style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#FEBC2E" }} />
    <div style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#28C840" }} />
  </div>
);

export const WindowChrome: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({ title, subtitle, children }) => (
  <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
    <div style={{ height: 32, background: "#2D2D2D", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
      {trafficLights}
      <span style={{ fontSize: 11, color: "#CCCCCC", fontFamily: FONT_SANS, fontWeight: 600 }}>{title}</span>
      {subtitle && <span style={{ fontSize: 10, color: "#888", fontFamily: FONT_MONO, marginLeft: "auto", paddingRight: 12 }}>{subtitle}</span>}
    </div>
    <div style={{ flex: 1, overflow: "hidden" }}>{children}</div>
  </div>
);

export const VSCOdeEditor: React.FC<{ frame: number }> = ({ frame }) => (
  <WindowChrome title="VS Code — review_pr_3421.tsx" subtitle="Claude Code">
    <div style={{ display: "flex", height: "100%", fontFamily: FONT_MONO, fontSize: 13 }}>
      <div style={{ width: 160, background: "#252526", padding: "8px 0", flexShrink: 0 }}>
        {["src/api/routes.ts", "src/api/validators.ts", "src/components/UserTable.tsx", "src/lib/utils.ts", "src/types/index.ts", "src/hooks/useAuth.ts"].map((f, i) => {
          const o = interpolate(frame, [10 + i * 4, 16 + i * 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return <div key={f} style={{ opacity: o, padding: "3px 12px", color: i === 0 ? "#569CD6" : "#999", background: i === 0 ? "#37373D" : "transparent", borderLeft: i === 0 ? "2px solid #569CD6" : "2px solid transparent" }}>{f}</div>;
        })}
      </div>
      <div style={{ flex: 1, background: "#1E1E1E", padding: "12px 16px", lineHeight: 1.6 }}>
        {[
          { text: "import { z } from 'zod';", color: "#569CD6" },
          { text: "", color: "" },
          { text: "// REVIEW: PR #3421 — API route validation", color: "#6A9955" },
          { text: "export const createUserSchema = z.object({", color: "#DCDCAA" },
          { text: "  email: z.string().email(),", color: "#9CDCFE" },
          { text: "  role:  z.enum(['admin', 'user']),", color: "#9CDCFE" },
          { text: "  plan:  z.enum(['free', 'pro', 'enterprise']).default('free'),", color: "#9CDCFE" },
          { text: "  name:  z.string().min(2).max(100),", color: "#9CDCFE" },
          { text: "});", color: "#DCDCAA" },
          { text: "", color: "" },
          { text: "export async function POST(req: Request) {", color: "#DCDCAA" },
          { text: "  const body = await req.json();", color: "#9CDCFE" },
          { text: "  const parsed = createUserSchema.safeParse(body);", color: "#9CDCFE" },
          { text: "  if (!parsed.success) {", color: "#DCDCAA" },
          { text: "    return Response.json({ error: parsed.error }, { status: 400 });", color: "#9CDCFE" },
          { text: "  }", color: "#DCDCAA" },
          { text: "  /* TODO: add rate limiting per ticket PLAT-889 */", color: "#6A9955", dim: true },
          { text: "  return Response.json({ ok: true });", color: "#9CDCFE" },
          { text: "}", color: "#DCDCAA" },
        ].map((l, i) => {
          const o = interpolate(frame, [15 + i * 3, 20 + i * 3], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return <div key={i} style={{ opacity: l.dim ? o * 0.5 : o, color: l.color, height: 14 }}>{l.text || "\u00A0"}</div>;
        })}
      </div>
      <div style={{ width: 200, background: "#252526", padding: "8px 12px", flexShrink: 0 }}>
        <div style={{ fontSize: 9, color: "#888", marginBottom: 8, fontFamily: FONT_SANS, fontWeight: 600 }}>PROBLEMS</div>
        <div style={{ fontSize: 10, color: "#F44747", lineHeight: 1.8 }}>
          {[{ msg: "Type 'undefined' is not assignable...", line: "L23" }, { msg: "Property 'email' does not exist...", line: "L31" }].map((p, i) => {
            const o = interpolate(frame, [60 + i * 10, 66 + i * 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            return <div key={i} style={{ opacity: o, display: "flex", gap: 4 }}><span>✕</span><span style={{ flex: 1 }}>{p.msg}</span><span style={{ color: "#888" }}>{p.line}</span></div>;
          })}
        </div>
      </div>
    </div>
  </WindowChrome>
);

export const Terminal: React.FC<{ frame: number }> = ({ frame }) => (
  <WindowChrome title="OpenCode — arm-tasks" subtitle="Pi">
    <div style={{ background: "#0D1117", height: "100%", padding: "12px 14px", fontFamily: FONT_MONO, fontSize: 14, lineHeight: 1.8 }}>
      {[
        { text: "$ pi --model glm-5.2 --thinking max", color: "#7EE787" },
        { text: "━━━ Pi Coding Agent v0.82.1 ━━━", color: "#58A6FF" },
        { text: "task: generate_component UserTable.tsx", color: "#C9D1D9" },
        { text: "", color: "" },
        { text: "  → Analyzing project structure...", color: "#8B949E" },
        { text: "  → Detected: Next.js 16 + shadcn/ui", color: "#8B949E" },
        { text: "  → Reading src/types/user.ts", color: "#8B949E" },
        { text: "  → ARM auth: sub_account eng-02 ✓", color: "#7EE787" },
        { text: "", color: "" },
        { text: "  Model     minicpm5-1b     (0.08$/M)", color: "#58A6FF" },
        { text: "  Tokens    892 in / 3,445 out", color: "#58A6FF" },
        { text: "  Budget    $6.80 / $10.00   (68%)", color: "#D29922" },
        { text: "", color: "" },
        { text: "  Generating UserTable component...", color: "#C9D1D9" },
        { text: "  ✓ UserTable.tsx written to src/components/", color: "#7EE787" },
        { text: "  ✓ UserTable.test.tsx written", color: "#7EE787" },
        { text: "  ✓ Story added to docs/", color: "#7EE787" },
        { text: "", color: "" },
        { text: "  $ npm run lint", color: "#7EE787" },
        { text: "  → All checks passed", color: "#7EE787" },
      ].map((l, i) => {
        const o = interpolate(frame, [8 + i * 5, 13 + i * 5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return <div key={i} style={{ opacity: o, color: l.color, height: 15 }}>{l.text || "\u00A0"}</div>;
      })}
    </div>
  </WindowChrome>
);

export const ProductionDashboard: React.FC<{ frame: number }> = ({ frame }) => (
  <WindowChrome title="MES Dashboard — Production Q3" subtitle="OpenCode">
    <div style={{ background: "#0F172A", height: "100%", padding: 12, fontFamily: FONT_SANS, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 8 }}>
        {[{ label: "OEE", value: "87%", color: "#22C55E" }, { label: "THROUGHPUT", value: "1,204", color: "#3B82F6" }, { label: "SCRAP", value: "2.1%", color: "#EAB308" }].map((k, i) => {
          const o = interpolate(frame, [10 + i * 6, 16 + i * 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return <div key={k.label} style={{ opacity: o, flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: 6, padding: "8px 10px", borderLeft: `3px solid ${k.color}` }}>
            <div style={{ fontSize: 9, color: "#94A3B8", fontFamily: FONT_MONO }}>{k.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: k.color, fontFamily: FONT_MONO }}>{k.value}</div>
          </div>;
        })}
      </div>
      <div style={{ flex: 1, background: "rgba(255,255,255,0.03)", borderRadius: 6, padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: 9, color: "#94A3B8", fontFamily: FONT_MONO, fontWeight: 600 }}>PRODUCTION LINE — HOURLY</div>
        {[{ name: "Line A", val: 95, color: "#22C55E" }, { name: "Line B", val: 72, color: "#EAB308" }, { name: "Line C", val: 88, color: "#3B82F6" }].map((line, i) => {
          const o = interpolate(frame, [25 + i * 6, 31 + i * 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const w = interpolate(frame, [28 + i * 6, 38 + i * 6], [0, line.val], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return <div key={line.name} style={{ opacity: o, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 40, fontSize: 10, color: "#94A3B8", fontFamily: FONT_MONO }}>{line.name}</span>
            <div style={{ flex: 1, height: 14, background: "rgba(255,255,255,0.06)", borderRadius: 3 }}>
              <div style={{ width: `${w}%`, height: "100%", background: line.color, borderRadius: 3 }} />
            </div>
            <span style={{ fontSize: 10, color: line.color, fontFamily: FONT_MONO, fontWeight: 700 }}>{line.val}%</span>
          </div>;
        })}
        <div style={{ marginTop: "auto", padding: "6px 8px", background: "rgba(239,68,68,0.12)", borderRadius: 4, border: "1px solid rgba(239,68,68,0.3)", opacity: interpolate(frame, [50, 56], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
          <span style={{ fontSize: 9, color: "#EF4444", fontFamily: FONT_MONO }}>⚠ Budget exceeded: $11.12 / $10.00 (112%) — escalated to approved by stakeholder</span>
        </div>
      </div>
    </div>
  </WindowChrome>
);

export const QATestRunner: React.FC<{ frame: number }> = ({ frame }) => (
  <WindowChrome title="QA Runner — test suite" subtitle="Claude Code">
    <div style={{ background: "#1E1E2E", height: "100%", padding: "10px 12px", fontFamily: FONT_MONO, fontSize: 13 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        {[{ label: "PASSED", value: "14", color: "#22C55E" }, { label: "FAILED", value: "2", color: "#EF4444" }, { label: "SKIPPED", value: "1", color: "#EAB308" }].map((s, i) => {
          const o = interpolate(frame, [8 + i * 5, 14 + i * 5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return <div key={s.label} style={{ opacity: o, background: "rgba(255,255,255,0.04)", borderRadius: 4, padding: "4px 8px" }}>
            <div style={{ fontSize: 8, color: "#888" }}>{s.label}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>;
        })}
      </div>
      {[
        { name: "Auth.login()", status: "✓", color: "#22C55E" },
        { name: "Auth.logout()", status: "✓", color: "#22C55E" },
        { name: "UserTable.render()", status: "✓", color: "#22C55E" },
        { name: "API.createUser.validation", status: "✓", color: "#22C55E" },
        { name: "API.createUser.rateLimit", status: "✕", color: "#EF4444" },
        { name: "Billing.invoice()", status: "✓", color: "#22C55E" },
        { name: "Search.fullText()", status: "✓", color: "#22C55E" },
        { name: "Email.sendBatch()", status: "✓", color: "#22C55E" },
        { name: "Export.csv.largeFile", status: "✕", color: "#EF4444" },
        { name: "Notifications.realtime", status: "○", color: "#EAB308" },
        { name: "Webhook.retry()", status: "✓", color: "#22C55E" },
      ].map((t, i) => {
        const o = interpolate(frame, [15 + i * 4, 20 + i * 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return <div key={t.name} style={{ opacity: o, display: "flex", gap: 6, padding: "2px 0", alignItems: "center" }}>
          <span style={{ color: t.color, fontWeight: 700 }}>{t.status}</span>
          <span style={{ color: "#C9D1D9" }}>{t.name}</span>
        </div>;
      })}
    </div>
  </WindowChrome>
);

export const SupplyChainView: React.FC<{ frame: number }> = ({ frame }) => (
  <WindowChrome title="Supply Chain Portal — PO-2024-07" subtitle="GitHub Copilot">
    <div style={{ background: "#FFFFFF", height: "100%", padding: 8, fontFamily: FONT_SANS, fontSize: 10 }}>
      <div style={{ background: "#F8FAFC", borderRadius: 6, padding: 8, border: "1px solid #E2E8F0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontWeight: 700, color: "#0F172A" }}>Purchase Orders</span>
          <span style={{ color: "#64748B", fontSize: 9 }}>Q3 2026</span>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ color: "#64748B", fontSize: 8, textAlign: "left", borderBottom: "1px solid #E2E8F0" }}>
              {["PO #", "Supplier", "Item", "Qty", "Status", "$"].map(h => <th key={h} style={{ padding: "4px 2px" }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {[
              { po: "PO-1024", sup: "Acme Parts", item: "Bolt M8x30", qty: "5,000", st: "Shipped", cost: "$450", sc: "#22C55E" },
              { po: "PO-1025", sup: "TechWire Inc", item: "Harness 12AWG", qty: "200", st: "In Transit", cost: "$1,200", sc: "#3B82F6" },
              { po: "PO-1026", sup: "Global Logistics", item: "Pallet Racking", qty: "12", st: "Delayed", cost: "$8,400", sc: "#EF4444" },
              { po: "PO-1027", sup: "Local Mfg Co", item: "Sensor Kit", qty: "50", st: "Processing", cost: "$3,200", sc: "#EAB308" },
              { po: "PO-1028", sup: "Acme Parts", item: "Bolt M10x40", qty: "10,000", st: "Shipped", cost: "$780", sc: "#22C55E" },
            ].map((row, i) => {
              const o = interpolate(frame, [12 + i * 5, 18 + i * 5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              return <tr key={row.po} style={{ opacity: o, borderBottom: "1px solid #F1F5F9" }}>
                <td style={{ padding: "3px 2px", fontFamily: FONT_MONO, fontWeight: 600, color: "#0F172A" }}>{row.po}</td>
                <td style={{ padding: "3px 2px", color: "#334155" }}>{row.sup}</td>
                <td style={{ padding: "3px 2px", color: "#334155" }}>{row.item}</td>
                <td style={{ padding: "3px 2px", fontFamily: FONT_MONO, color: "#64748B" }}>{row.qty}</td>
                <td style={{ padding: "3px 2px", color: row.sc, fontWeight: 600 }}>{row.st}</td>
                <td style={{ padding: "3px 2px", fontFamily: FONT_MONO, color: "#0F172A" }}>{row.cost}</td>
              </tr>;
            })}
          </tbody>
        </table>
        <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 8, color: "#64748B" }}>Total POs: 5 · Delayed: 1</span>
          <span style={{ fontWeight: 700, color: "#0F172A" }}>$14,030</span>
        </div>
      </div>
    </div>
  </WindowChrome>
);

export const VPNStatusView: React.FC<{ frame: number }> = ({ frame }) => (
  <WindowChrome title="ARM Remote Access — VPN Client" subtitle="Terminal (Pi)">
    <div style={{ background: "#1A1A2E", height: "100%", padding: "14px 16px", fontFamily: FONT_MONO, fontSize: 13, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ opacity: interpolate(frame, [5, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 6, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#22C55E" }} />
        <span style={{ color: "#22C55E", fontWeight: 700, fontSize: 11 }}>CONNECTED — arm-vpn.prod (1.2.3.4)</span>
        <span style={{ color: "#6B7280", marginLeft: "auto" }}>session: 2h 14m</span>
      </div>
      <div style={{ opacity: interpolate(frame, [12, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
        <div style={{ color: "#9CA3AF", marginBottom: 6 }}>╔══ Connection Details ══╗</div>
        {[
          ["Endpoint", "arm-vpn-01.us-east-1.prod"],
          ["Protocol", "WireGuard (mTLS)"],
          ["Encryption", "AES-256-GCM"],
          ["Bandwidth", "142 Mbps ↓ / 38 Mbps ↑"],
          ["Latency", "23 ms"],
          ["ARM Proxy", "arm-gw-01.prod (mTLS: OK)"],
        ].map(([k, v], i) => {
          const o = interpolate(frame, [18 + i * 4, 24 + i * 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return <div key={k} style={{ opacity: o, display: "flex", gap: 8, padding: "2px 0" }}>
            <span style={{ color: "#6B7280", width: 80 }}>{k}</span>
            <span style={{ color: "#D1D5DB" }}>{v}</span>
          </div>;
        })}
      </div>
      <div style={{ opacity: interpolate(frame, [38, 44], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), marginTop: "auto", background: "rgba(59,130,246,0.08)", borderRadius: 4, padding: "6px 8px" }}>
        <span style={{ color: "#60A5FA", fontSize: 9 }}>→ Last task: async data sync via ARM · tokens: 245 · cost: $0.03</span>
      </div>
    </div>
  </WindowChrome>
);
