import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { COLORS, FONT_SANS, FONT_MONO } from "../theme";
import { Monitor, Terminal } from "../components/Monitor";

export const SceneNetwork: React.FC = () => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bgDark, fontFamily: FONT_SANS, opacity: fadeIn, overflow: "hidden" }}>
      {/* Scene label */}
      <div style={{ position: "absolute", top: 24, left: 40, fontSize: 28, fontWeight: 700, color: COLORS.white }}>
        Enterprise Network Topology
      </div>
      <div style={{ position: "absolute", top: 60, left: 40, fontSize: 14, color: COLORS.textDarkMuted, fontFamily: FONT_MONO }}>
        REAL-TIME AGENT INFRASTRUCTURE
      </div>

      {/* Network topology — full width */}
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", display: "flex", gap: 32, alignItems: "center" }}>
        {/* Internet cloud */}
        <Monitor name="Internet" title="🌐 INTERNET GATEWAY" subtitle="edge-router-01" width={420} height={560} bezel="#0F172A" screenBg="#0F172A" glow="rgba(59,130,246,0.15)">
          <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 14, alignItems: "center", justifyContent: "center", height: "100%" }}>
            <div style={{
              width: 120, height: 120, borderRadius: 60, border: `3px dashed ${COLORS.textDarkMuted}`,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48,
            }}>☁️</div>
            <div style={{ color: COLORS.textDark, fontSize: 20, fontWeight: 600, fontFamily: FONT_MONO }}>LLM PROVIDERS</div>
            <div style={{ color: COLORS.textDarkMuted, fontSize: 15, fontFamily: FONT_MONO, textAlign: "center", lineHeight: 1.6 }}>
              OpenAI · Anthropic · Google<br/>DeepSeek · Z.ai · NVIDIA
            </div>
            <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
              {["IN", "OUT"].map((d, i) => (
                <div key={d} style={{
                  opacity: interpolate(frame, [30 + i * 10, 35 + i * 10], [0.3, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
                  background: i === 0 ? COLORS.green : COLORS.cyan, color: "white", borderRadius: 6, padding: "4px 14px", fontSize: 14, fontFamily: FONT_MONO, fontWeight: 700,
                }}>{d}</div>
              ))}
            </div>
          </div>
        </Monitor>

        {/* Arrow connector */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <div style={{ width: 3, height: 40, background: `linear-gradient(to bottom, ${COLORS.gold}, ${COLORS.navy})` }} />
          <div style={{ width: 22, height: 22, borderRight: `3px solid ${COLORS.gold}`, borderBottom: `3px solid ${COLORS.gold}`, transform: "rotate(-45deg)" }} />
          <span style={{ color: COLORS.goldLight, fontSize: 14, fontFamily: FONT_MONO }}>mTLS</span>
        </div>

        {/* ARM gateway server */}
        <Monitor name="ARM Gateway" title="🛡️ ARM GOVERNANCE PROXY" subtitle="arm-gw-01.prod" width={520} height={560} bezel="#172554" screenBg="#0F172A" glow="rgba(180,83,9,0.15)">
          <Terminal lines={[
            { text: "ARM Gateway v1.0 — booting...", dir: "ok" },
            { text: "mTLS upstream: internet-gw → arm-gw-01", dir: "ok" },
            { text: "Policy engine: loaded 142 rules", dir: "ok" },
            { text: "Budget ledger: ClickHouse connected", dir: "ok" },
            { text: "Identity provider: OIDC sync ready", dir: "ok" },
            { text: "━━━━━━━━━━━━━━━━━━━━━━━", dir: "ok" },
            { text: "INBOUND: agent-call-001", dir: "in" },
            { text: " → Auth OK (sub_account: eng-01)", dir: "ok" },
            { text: " → Policy: budget_check [PASS]", dir: "ok" },
            { text: " → Routing: gpt-4o-mini $0.15/M", dir: "out" },
            { text: " → Token budget: 47.2% remaining", dir: "ok" },
            { text: "INBOUND: agent-call-002", dir: "in" },
            { text: " → Auth OK (sub_account: manuf-03)", dir: "ok" },
          ]} />
        </Monitor>

        {/* Arrow connector to internal network */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <div style={{ width: 3, height: 40, background: `linear-gradient(to bottom, ${COLORS.navy}, ${COLORS.green})` }} />
          <div style={{ width: 22, height: 22, borderRight: `3px solid ${COLORS.green}`, borderBottom: `3px solid ${COLORS.green}`, transform: "rotate(-45deg)" }} />
          <span style={{ color: COLORS.greenDark, fontSize: 14, fontFamily: FONT_MONO }}>VPC</span>
        </div>

        {/* Internal network — employee agents */}
        <Monitor name="Internal Network" title="🏢 INTERNAL NETWORK" subtitle="armtest.com" width={420} height={560} bezel="#0F172A" screenBg="#0F172A" glow="rgba(34,197,94,0.12)">
          <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 14, height: "100%" }}>
            <div style={{ color: COLORS.textDark, fontSize: 18, fontWeight: 600, fontFamily: FONT_MONO, marginBottom: 8 }}>EMPLOYEE AGENTS</div>
            {[
              { name: "Sarah Chen", dept: "Engineering", agent: "Claude Code", color: COLORS.navy },
              { name: "Carlos Mendes", dept: "Manufacturing", agent: "OpenCode", color: COLORS.gold },
              { name: "Jenny Park", dept: "QA", agent: "Claude Code", color: COLORS.red },
              { name: "David Kim", dept: "Supply Chain", agent: "Copilot", color: COLORS.cyan },
              { name: "Mike Rodriguez", dept: "Engineering", agent: "OpenCode", color: COLORS.navy },
            ].map((emp, i) => {
              const o = interpolate(frame, [20 + i * 8, 28 + i * 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              const pulse = interpolate(frame, [30 + i * 12, 36 + i * 12, 42 + i * 12], [0.4, 1, 0.4], { extrapolateLeft: "clamp", extrapolateRight: "extend" });
              return (
                <div key={emp.name} style={{ opacity: o, display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "rgba(255,255,255,0.04)", borderRadius: 8, borderLeft: `3px solid ${emp.color}` }}>
                  <div style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: emp.color, opacity: pulse, boxShadow: `0 0 8px ${emp.color}` }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.textDark, fontFamily: FONT_MONO }}>{emp.name}</div>
                    <div style={{ fontSize: 12, color: COLORS.textDarkMuted, fontFamily: FONT_MONO }}>{emp.dept}</div>
                  </div>
                  <div style={{ fontSize: 12, color: emp.color, fontFamily: FONT_MONO, fontWeight: 600, background: "rgba(255,255,255,0.06)", padding: "3px 8px", borderRadius: 4 }}>{emp.agent}</div>
                </div>
              );
            })}
          </div>
        </Monitor>
      </div>
    </AbsoluteFill>
  );
};
