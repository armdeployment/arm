import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { COLORS, FONT_SANS, FONT_MONO } from "../theme";
import { REAL } from "../real-data";
import { Monitor } from "../components/Monitor";

export const SceneServer: React.FC = () => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bgDark, fontFamily: FONT_SANS, opacity: fadeIn, overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 24, left: 40, fontSize: 28, fontWeight: 700, color: COLORS.white }}>
        ARM Infrastructure — Live State
      </div>
      <div style={{ position: "absolute", top: 60, left: 40, fontSize: 14, color: COLORS.textDarkMuted, fontFamily: FONT_MONO }}>
        REAL DATA FROM POSTGRES + CLICKHOUSE + DOCKER
      </div>

      {/* 4 monitors showing real infrastructure data */}
      <div style={{
        position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        display: "flex", gap: 24,
      }}>
        {/* Real Docker containers */}
        <Monitor name="Docker" title="🐳 DOCKER CONTAINERS" subtitle="docker ps" width={400} height={560} bezel="#1E293B" screenBg="#0F172A">
          <div style={{ padding: 20, fontFamily: FONT_MONO, fontSize: 13, lineHeight: 1.6, height: "100%", overflow: "hidden" }}>
            <div style={{ display: "flex", color: COLORS.textDarkMuted, fontSize: 11, borderBottom: `1px solid rgba(255,255,255,0.1)`, paddingBottom: 8, marginBottom: 8 }}>
              <span style={{ flex: 2 }}>CONTAINER</span>
              <span style={{ flex: 2 }}>STATUS</span>
            </div>
            {REAL.containers.map((c, i) => {
              const o = interpolate(frame, [8 + i * 4, 14 + i * 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              const isHealthy = c.status.includes("healthy") || c.status.includes("Up");
              const isExited = c.status.includes("Exited");
              return (
                <div key={c.name} style={{ opacity: o, display: "flex", padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <span style={{ flex: 2, fontSize: 11, color: COLORS.textDark, fontWeight: 600 }}>{c.name.replace("simulation-", "")}</span>
                  <span style={{ flex: 2, fontSize: 11, color: isExited ? COLORS.textDarkMuted : isHealthy ? COLORS.green : COLORS.amber }}>
                    {isExited ? "✓ done" : "● " + c.status.replace("Up 2 hours", "running")}
                  </span>
                </div>
              );
            })}
          </div>
        </Monitor>

        {/* Real Postgres agents */}
        <Monitor name="Postgres" title="🐘 POSTGRESQL" subtitle="SELECT * FROM agents" width={420} height={560} bezel="#1E293B" screenBg="#0F172A">
          <div style={{ padding: 20, fontFamily: FONT_MONO, fontSize: 12, lineHeight: 1.6, height: "100%", overflow: "hidden" }}>
            <div style={{ display: "flex", color: COLORS.textDarkMuted, fontSize: 10, borderBottom: `1px solid rgba(255,255,255,0.1)`, paddingBottom: 8, marginBottom: 8 }}>
              <span style={{ flex: 2 }}>AGENT</span>
              <span style={{ flex: 1.5 }}>DEPT</span>
              <span style={{ flex: 1 }}>TIER</span>
            </div>
            {REAL.agents.map((a, i) => {
              const o = interpolate(frame, [8 + i * 4, 14 + i * 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              const tierColor = a.tier === "critical" ? COLORS.red : a.tier === "standard" ? COLORS.cyan : COLORS.textDarkMuted;
              return (
                <div key={a.name} style={{ opacity: o, display: "flex", padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", alignItems: "center" }}>
                  <span style={{ flex: 2, fontSize: 11, color: COLORS.textDark, fontWeight: 600 }}>{a.name}</span>
                  <span style={{ flex: 1.5, fontSize: 10, color: COLORS.textDarkMuted }}>{a.dept}</span>
                  <span style={{ flex: 1, fontSize: 10, color: tierColor, fontWeight: 700 }}>{a.tier}</span>
                </div>
              );
            })}
            <div style={{ marginTop: 12, padding: "8px 10px", background: "rgba(34,197,94,0.06)", borderRadius: 6, opacity: interpolate(frame, [50, 58], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
              <span style={{ fontSize: 12, color: COLORS.green, fontFamily: FONT_MONO }}>10 agents · 5 depts · 4 models · all active</span>
            </div>
          </div>
        </Monitor>

        {/* Real ClickHouse metering */}
        <Monitor name="ClickHouse" title="📊 CLICKHOUSE METERING" subtitle="SELECT FROM llm_events" width={400} height={560} bezel="#1E293B" screenBg="#0F172A">
          <div style={{ padding: 20, fontFamily: FONT_MONO, fontSize: 12, lineHeight: 1.6, height: "100%", overflow: "hidden" }}>
            <div style={{ display: "flex", color: COLORS.textDarkMuted, fontSize: 10, borderBottom: `1px solid rgba(255,255,255,0.1)`, paddingBottom: 8, marginBottom: 8 }}>
              <span style={{ flex: 2 }}>DEPARTMENT</span>
              <span style={{ flex: 1, textAlign: "right" }}>CALLS</span>
              <span style={{ flex: 1, textAlign: "right" }}>TOKENS</span>
            </div>
            {REAL.metering.map((m, i) => {
              const o = interpolate(frame, [8 + i * 4, 14 + i * 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              const isDenied = m.status === "denied";
              return (
                <div key={i} style={{ opacity: o, display: "flex", padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", alignItems: "center" }}>
                  <span style={{ flex: 2, fontSize: 11, color: COLORS.textDark, fontWeight: 600 }}>{m.department}</span>
                  <span style={{ flex: 1, textAlign: "right", fontSize: 12, color: isDenied ? COLORS.red : COLORS.green, fontWeight: 700 }}>{m.calls}{isDenied ? " ✗" : ""}</span>
                  <span style={{ flex: 1, textAlign: "right", fontSize: 11, color: COLORS.textDarkMuted }}>{m.tokens}</span>
                </div>
              );
            })}
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6, opacity: interpolate(frame, [40, 48], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", background: "rgba(59,130,246,0.08)", borderRadius: 6 }}>
                <span style={{ fontSize: 11, color: COLORS.textDarkMuted }}>Total tokens</span>
                <span style={{ fontSize: 13, color: COLORS.cyan, fontWeight: 700 }}>{REAL.totals.totalTokens.toLocaleString()}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", background: "rgba(34,197,94,0.08)", borderRadius: 6 }}>
                <span style={{ fontSize: 11, color: COLORS.textDarkMuted }}>Cloud-equiv cost</span>
                <span style={{ fontSize: 13, color: COLORS.green, fontWeight: 700 }}>${(REAL.totals.cloudCostCents / 100).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </Monitor>

        {/* Real policy events */}
        <Monitor name="Policy" title="🔒 POLICY EVENTS" subtitle="SELECT FROM policy_events" width={340} height={560} bezel="#1E293B" screenBg="#0F172A">
          <div style={{ padding: 20, fontFamily: FONT_MONO, fontSize: 13, lineHeight: 1.6, height: "100%", overflow: "hidden" }}>
            <div style={{ color: COLORS.textDarkMuted, fontSize: 10, borderBottom: `1px solid rgba(255,255,255,0.1)`, paddingBottom: 8, marginBottom: 12 }}>
              DECISION · REASON · COUNT
            </div>
            {REAL.policyEvents.map((p, i) => {
              const o = interpolate(frame, [10 + i * 8, 18 + i * 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              return (
                <div key={i} style={{ opacity: o, marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.red, background: "rgba(239,68,68,0.1)", padding: "3px 8px", borderRadius: 4 }}>{p.decision.toUpperCase()}</span>
                    <span style={{ fontSize: 20, fontWeight: 800, color: COLORS.red }}>{p.events}</span>
                    <span style={{ fontSize: 11, color: COLORS.textDarkMuted }}>events</span>
                  </div>
                  <div style={{ fontSize: 12, color: COLORS.textDark, fontFamily: FONT_MONO, paddingLeft: 4 }}>{p.reason}</div>
                </div>
              );
            })}
            <div style={{ marginTop: 20, padding: "12px 14px", background: "rgba(239,68,68,0.06)", borderRadius: 8, border: `1px solid rgba(239,68,68,0.2)`, opacity: interpolate(frame, [30, 38], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
              <div style={{ fontSize: 12, color: COLORS.red, fontFamily: FONT_MONO, fontWeight: 600 }}>
                DLP Engine: 3 prompts blocked
              </div>
              <div style={{ fontSize: 11, color: COLORS.textDarkMuted, fontFamily: FONT_MONO, marginTop: 4 }}>
                Pattern: API Key (sk-ant-)<br/>
                Action: blocked + audited
              </div>
            </div>
          </div>
        </Monitor>
      </div>
    </AbsoluteFill>
  );
};
