import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { COLORS, FONT_SANS, FONT_MONO } from "../theme";
import { REAL } from "../real-data";
import { Monitor } from "../components/Monitor";

export const SceneBlocking: React.FC = () => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bgDark, fontFamily: FONT_SANS, opacity: fadeIn, overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 24, left: 40, fontSize: 28, fontWeight: 700, color: COLORS.white }}>
        DLP Policy Enforcement — Real Blocks
      </div>
      <div style={{ position: "absolute", top: 60, left: 40, fontSize: 14, color: COLORS.textDarkMuted, fontFamily: FONT_MONO }}>
        ACTUAL TERMINAL OUTPUT FROM SIMULATION
      </div>

      {/* Left: Real Jenny terminal output */}
      <div style={{ position: "absolute", left: 60, top: 100 }}>
        <Monitor name="Jenny Terminal" title="💻 emp-jenny-1 · Quality Assurance" subtitle="Claude Code · real docker logs" width={840} height={620} bezel="#1E293B" screenBg="#0F172A">
          <div style={{ padding: 24, fontFamily: FONT_MONO, fontSize: 15, lineHeight: 1.7, height: "100%", overflow: "hidden" }}>
            {REAL.jennyTerminal.map((line, i) => {
              const o = interpolate(frame, [i * 6, i * 6 + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              if (o <= 0) return null;
              const isBlock = line.dir === "block";
              const isIn = line.dir === "in";
              return (
                <div key={i} style={{
                  opacity: o,
                  color: isBlock ? COLORS.red : isIn ? COLORS.cyan : COLORS.textDark,
                  fontWeight: isBlock ? 700 : 400,
                  padding: isBlock ? "6px 0" : "2px 0",
                }}>
                  {isBlock ? "🛡️  " : isIn ? "⬆️  " : "   "}{line.text || "\u00A0"}
                </div>
              );
            })}
          </div>
        </Monitor>
      </div>

      {/* Right: Real ClickHouse policy events */}
      <div style={{ position: "absolute", right: 60, top: 100 }}>
        <Monitor name="Policy Query" title="🔒 CLICKHOUSE POLICY EVENTS" subtitle="real query result" width={840} height={620} bezel="#172554" screenBg="#0F172A" glow={frame > 30 ? "rgba(220,38,38,0.2)" : undefined}>
          <div style={{ padding: 28, fontFamily: FONT_MONO, fontSize: 14, height: "100%", overflow: "hidden" }}>
            <div style={{ color: COLORS.green, marginBottom: 16, opacity: interpolate(frame, [0, 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
              clickhouse-client --query "SELECT decision, reason, count()<br/>FROM arm.policy_events GROUP BY decision, reason"
            </div>
            <div style={{ borderTop: `1px solid rgba(255,255,255,0.1)`, paddingTop: 16 }}>
              {REAL.policyEvents.map((p, i) => {
                const o = interpolate(frame, [10 + i * 10, 18 + i * 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
                return (
                  <div key={i} style={{ opacity: o, marginBottom: 24 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
                      <span style={{ fontSize: 16, fontWeight: 700, color: COLORS.red, background: "rgba(239,68,68,0.12)", padding: "6px 16px", borderRadius: 6, border: `1px solid rgba(239,68,68,0.3)` }}>
                        {p.decision.toUpperCase()}
                      </span>
                      <span style={{ fontSize: 40, fontWeight: 800, color: COLORS.red }}>{p.events}</span>
                      <span style={{ fontSize: 16, color: COLORS.textDarkMuted }}>events</span>
                    </div>
                    <div style={{ paddingLeft: 4, fontSize: 18, color: COLORS.textDark, fontFamily: FONT_MONO }}>
                      reason: {p.reason}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Real impact summary */}
            <div style={{
              marginTop: 20, padding: "16px 20px",
              background: "rgba(239,68,68,0.08)", borderRadius: 10,
              border: `1px solid rgba(239,68,68,0.25)`,
              opacity: interpolate(frame, [35, 45], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            }}>
              <div style={{ fontSize: 16, color: COLORS.redDark, fontWeight: 700, fontFamily: FONT_MONO, marginBottom: 8 }}>
                DLP ENGINE IMPACT
              </div>
              <div style={{ display: "flex", gap: 32 }}>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: COLORS.red }}>3</div>
                  <div style={{ fontSize: 12, color: COLORS.textDarkMuted }}>prompts blocked</div>
                </div>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: COLORS.green }}>0</div>
                  <div style={{ fontSize: 12, color: COLORS.textDarkMuted }}>API keys leaked</div>
                </div>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: COLORS.cyan }}>100%</div>
                  <div style={{ fontSize: 12, color: COLORS.textDarkMuted }}>audited</div>
                </div>
              </div>
            </div>
          </div>
        </Monitor>
      </div>
    </AbsoluteFill>
  );
};
