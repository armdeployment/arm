import { AbsoluteFill, interpolate, useCurrentFrame, Easing } from "remotion";
import { COLORS, FONT_SANS, FONT_MONO, SIM_RESULTS } from "../theme";
import { Monitor } from "../components/Monitor";

export const SceneDashboard: React.FC = () => {
  const frame = useCurrentFrame();
  const maxCalls = Math.max(...SIM_RESULTS.departments.map(d => d.calls));
  const fadeIn = interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bgDark, fontFamily: FONT_SANS, opacity: fadeIn, overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 24, left: 40, fontSize: 28, fontWeight: 700, color: COLORS.white }}>
        Management Dashboard
      </div>
      <div style={{ position: "absolute", top: 60, left: 40, fontSize: 14, color: COLORS.textDarkMuted, fontFamily: FONT_MONO }}>
        SIMULATION RESULTS — REAL CLICKHOUSE METERING
      </div>

      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", display: "flex", gap: 40 }}>
        {/* Left: KPI cards */}
        <Monitor name="KPIs" title="📊 KEY METRICS" subtitle="simulation" width={820} height={620} bezel="#1E293B" screenBg="#0F172A">
          <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              { label: "Total LLM Calls", value: SIM_RESULTS.totalCalls, color: COLORS.white },
              { label: "Successful", value: SIM_RESULTS.successfulCalls, color: COLORS.green },
              { label: "Denied (Budget/Policy)", value: SIM_RESULTS.deniedCalls, color: COLORS.red },
              { label: "Errors", value: SIM_RESULTS.errorCalls, color: COLORS.amber },
              { label: "Total Tokens", value: SIM_RESULTS.totalTokens.toLocaleString(), color: COLORS.white },
              { label: "Cloud Cost", value: `$${SIM_RESULTS.cloudCostCents.toFixed(2)}`, color: COLORS.cyan },
              { label: "Savings (vs list)", value: `$${SIM_RESULTS.savingsCents.toFixed(2)}`, color: COLORS.greenDark },
            ].map((kpi, i) => {
              const o = interpolate(frame, [8 + i * 5, 14 + i * 5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              return (
                <div key={kpi.label} style={{ opacity: o, display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: 8 }}>
                  <span style={{ fontSize: 16, color: COLORS.textDarkMuted, fontFamily: FONT_MONO }}>{kpi.label}</span>
                  <span style={{ fontSize: 26, fontWeight: 700, color: kpi.color, fontFamily: FONT_MONO }}>{kpi.value}</span>
                </div>
              );
            })}
          </div>
        </Monitor>

        {/* Right: bar chart by department */}
        <Monitor name="Bar Chart" title="📈 CALLS BY DEPARTMENT" subtitle="metered" width={820} height={620} bezel="#1E293B" screenBg="#0F172A">
          <div style={{ padding: "32px 28px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 18, height: "100%" }}>
            <div style={{ display: "flex", gap: 28, alignItems: "flex-end", height: 280, paddingBottom: 24 }}>
              {SIM_RESULTS.departments.map((dept, i) => {
                const h = interpolate(frame, [10 + i * 6, 22 + i * 6], [0, (dept.calls / maxCalls) * 250], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });
                const o = interpolate(frame, [6 + i * 6, 12 + i * 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
                return (
                  <div key={dept.name} style={{ opacity: o, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: 1 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: COLORS.textDark, fontFamily: FONT_MONO }}>{dept.calls}</span>
                    <div style={{ width: 60, height: 250, background: "rgba(255,255,255,0.04)", borderRadius: 6, display: "flex", alignItems: "flex-end", overflow: "hidden" }}>
                      <div style={{ width: "100%", height: h, background: dept.color, borderRadius: 6, minHeight: h > 0 ? 4 : 0 }} />
                    </div>
                    <span style={{ fontSize: 12, color: COLORS.textDarkMuted, textAlign: "center", fontFamily: FONT_MONO }}>{dept.name}</span>
                  </div>
                );
              })}
            </div>
            {/* Legend */}
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 12 }}>
              {SIM_RESULTS.departments.map(dept => (
                <div key={dept.name} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: dept.color }} />
                  <span style={{ fontSize: 13, color: COLORS.textDarkMuted, fontFamily: FONT_MONO }}>{dept.name}</span>
                </div>
              ))}
            </div>
          </div>
        </Monitor>
      </div>
    </AbsoluteFill>
  );
};
