import { interpolate, useCurrentFrame, Easing, Img, staticFile } from "remotion";
import { COLORS, FONT_SANS, FONT_MONO } from "../theme";
import { REAL } from "../real-data";

export const SceneProfiles: React.FC = () => {
  const frame = useCurrentFrame();

  const titleAppear = interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const titleY = interpolate(frame, [0, 15], [30, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });

  const profiles = [
    REAL.profiles.manufacturing,
    REAL.profiles.finance,
    REAL.profiles.holding,
  ];

  return (
    <div style={{
      width: "100%", height: "100%", backgroundColor: COLORS.bg,
      display: "flex", flexDirection: "column", alignItems: "center",
      fontFamily: FONT_SANS, padding: "40px 60px",
    }}>
      {/* Title */}
      <div style={{
        opacity: titleAppear, transform: `translateY(${titleY}px)`,
        textAlign: "center", marginBottom: 30,
      }}>
        <div style={{ fontSize: 13, color: COLORS.gold, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>
          D6 · Industry Profiles
        </div>
        <div style={{ fontSize: 36, fontWeight: 700, color: COLORS.text, letterSpacing: -0.5 }}>
          One Platform · Many Industries
        </div>
        <div style={{ fontSize: 15, color: COLORS.textMuted, marginTop: 8, maxWidth: 700, margin: "8px auto 0" }}>
          Profiles set defaults at provisioning time — they never gate capabilities.
          Any tenant can enable any feature regardless of profile.
        </div>
      </div>

      {/* Profile cards */}
      <div style={{ display: "flex", gap: 20, marginTop: 10 }}>
        {profiles.map((p, i) => {
          const appear = interpolate(frame, [10 + i * 8, 25 + i * 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const y = interpolate(frame, [10 + i * 8, 25 + i * 8], [40, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });
          const isMfg = p === REAL.profiles.manufacturing;
          const isFin = p === REAL.profiles.finance;
          const accent = isMfg ? COLORS.gold : isFin ? COLORS.navy : COLORS.green;

          return (
            <div key={i} style={{
              opacity: appear, transform: `translateY(${y}px)`,
              width: 360, backgroundColor: COLORS.white,
              borderRadius: 10, border: `2px solid ${i === Math.floor((frame - 10) / 8 % 3) ? accent : COLORS.border}`,
              padding: 24, boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
              display: "flex", flexDirection: "column", gap: 12,
            }}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 32 }}>{p.icon}</span>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text }}>{p.label}</div>
                  <div style={{ fontSize: 11, fontFamily: FONT_MONO, color: accent }}>
                    {isMfg ? "manufacturing" : isFin ? "finance" : "holding"}
                  </div>
                </div>
              </div>

              {/* Metrics grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <Metric label="Departments" value={p.departments} />
                <Metric label="Seed Agents" value={p.seedAgents} />
                <Metric label="DLP Patterns" value={p.dlpPatterns} />
                <Metric label="Resource Types" value={p.resourceTypes} />
                <Metric label="UI Panels" value={p.panels} />
                <Metric label="Budget Periods" value={p.budgetPeriods.split(" + ").length} />
              </div>

              {/* Classification */}
              <div style={{
                backgroundColor: COLORS.bg, borderRadius: 6, padding: "8px 12px",
                fontSize: 11, color: COLORS.text, lineHeight: 1.5,
              }}>
                <span style={{ fontWeight: 600, color: accent }}>Classification: </span>
                {p.classification}
              </div>

              {/* Model routing */}
              <div style={{ fontSize: 11, color: COLORS.textMuted, lineHeight: 1.5 }}>
                <span style={{ fontWeight: 600, color: COLORS.text }}>Routing: </span>
                {p.modelRouting}
              </div>
            </div>
          );
        })}
      </div>

      {/* Governing rule banner */}
      <div style={{
        opacity: interpolate(frame, [50, 65], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        marginTop: 28, padding: "12px 28px", backgroundColor: COLORS.navy, borderRadius: 8,
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <span style={{ fontSize: 18 }}>⚙</span>
        <span style={{ fontSize: 14, color: COLORS.white, fontWeight: 500 }}>
          Guardrail enforced: <code style={{ fontFamily: FONT_MONO, color: COLORS.goldLight }}>no-profile-branching</code> — runtime code never reads the profile id
        </span>
      </div>
    </div>
  );
};

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div style={{
      backgroundColor: COLORS.bg, borderRadius: 6, padding: "8px 10px",
      display: "flex", flexDirection: "column", gap: 2,
    }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.navy, fontFamily: FONT_MONO }}>{value}</div>
      <div style={{ fontSize: 10, color: COLORS.textMuted }}>{label}</div>
    </div>
  );
}
