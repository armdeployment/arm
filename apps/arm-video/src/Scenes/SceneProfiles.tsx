import { interpolate, useCurrentFrame, Easing } from "remotion";
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
      fontFamily: FONT_SANS, padding: "36px 50px",
    }}>
      {/* Title */}
      <div style={{
        opacity: titleAppear, transform: `translateY(${titleY}px)`,
        textAlign: "center", marginBottom: 24,
      }}>
        <div style={{ fontSize: 13, color: COLORS.gold, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>
          D6 · Industry Profiles
        </div>
        <div style={{ fontSize: 34, fontWeight: 700, color: COLORS.text, letterSpacing: -0.5 }}>
          Real Org Structures — HQ · Plants · Subsidiaries
        </div>
        <div style={{ fontSize: 14, color: COLORS.textMuted, marginTop: 8, maxWidth: 750, margin: "8px auto 0" }}>
          Profiles set defaults at provisioning time — they never gate capabilities.
          A manufacturing company gets HQ + multiple plants; a holding company gets subsidiaries with their own orgs.
        </div>
      </div>

      {/* Profile cards */}
      <div style={{ display: "flex", gap: 18, marginTop: 6 }}>
        {profiles.map((p, i) => {
          const appear = interpolate(frame, [10 + i * 8, 25 + i * 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const y = interpolate(frame, [10 + i * 8, 25 + i * 8], [40, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });
          const isMfg = p.icon === "🏭";
          const isFin = p.icon === "🏦";
          const accent = isMfg ? COLORS.gold : isFin ? COLORS.navy : COLORS.green;

          return (
            <div key={i} style={{
              opacity: appear, transform: `translateY(${y}px)`,
              width: 380, backgroundColor: COLORS.white,
              borderRadius: 10, border: `1px solid ${COLORS.border}`,
              padding: 20, boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
              display: "flex", flexDirection: "column", gap: 10,
            }}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 10, borderBottom: `1px solid ${COLORS.border}` }}>
                <span style={{ fontSize: 28 }}>{p.icon}</span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.text }}>{p.label}</div>
                  <div style={{ fontSize: 10, fontFamily: FONT_MONO, color: accent }}>
                    {p.orgTree}
                  </div>
                </div>
              </div>

              {/* Org tree nodes */}
              {p.orgNodes.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {p.orgNodes.map((node, ni) => {
                    const nodeAppear = interpolate(frame, [25 + i * 8 + ni * 4, 35 + i * 8 + ni * 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
                    const isPlant = node.type === "plant";
                    const isOrg = node.type === "organization";
                    const isHq = node.type === "hq";
                    const icon = isPlant ? "🏭" : isOrg ? "🏛️" : isHq ? "🏢" : "▸";
                    const nodeColor = isPlant ? COLORS.green : isOrg ? COLORS.navy : isHq ? COLORS.gold : COLORS.text;

                    return (
                      <div key={ni} style={{
                        opacity: nodeAppear,
                        display: "flex", alignItems: "center", gap: 6,
                        padding: "4px 8px", borderRadius: 4,
                        backgroundColor: (isPlant || isHq || isOrg) ? COLORS.bg : "transparent",
                      }}>
                        <span style={{ fontSize: 13 }}>{icon}</span>
                        <span style={{ fontSize: 12, fontWeight: isPlant || isHq || isOrg ? 600 : 400, color: nodeColor, flex: 1 }}>
                          {node.name}
                        </span>
                        {node.location && (
                          <span style={{ fontSize: 9, color: COLORS.textMuted }}>📍 {node.location}</span>
                        )}
                        {node.regulatory && (
                          <span style={{
                            fontSize: 8, fontFamily: FONT_MONO, fontWeight: 700,
                            color: COLORS.red, backgroundColor: "rgba(220,38,38,0.08)",
                            padding: "1px 4px", borderRadius: 3,
                          }}>
                            {node.regulatory}
                          </span>
                        )}
                        <span style={{ fontSize: 10, fontFamily: FONT_MONO, color: COLORS.textMuted }}>{node.budget}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Metrics row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginTop: 4 }}>
                <Metric label="Nodes" value={p.departments} accent={accent} />
                <Metric label="Plants" value={p.plants} accent={accent} />
                <Metric label="Agents" value={p.seedAgents} accent={accent} />
              </div>

              {/* Classification */}
              <div style={{
                backgroundColor: COLORS.bg, borderRadius: 6, padding: "6px 10px",
                fontSize: 10, color: COLORS.text, lineHeight: 1.4,
              }}>
                <span style={{ fontWeight: 600, color: accent }}>Classification: </span>
                {p.classification}
              </div>
            </div>
          );
        })}
      </div>

      {/* Governing rule banner */}
      <div style={{
        opacity: interpolate(frame, [70, 85], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        marginTop: 22, padding: "10px 24px", backgroundColor: COLORS.navy, borderRadius: 8,
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <span style={{ fontSize: 16 }}>⚙</span>
        <span style={{ fontSize: 13, color: COLORS.white, fontWeight: 500 }}>
          <code style={{ fontFamily: FONT_MONO, color: COLORS.goldLight }}>no-profile-branching</code> guardrail enforced — runtime code never reads the profile id
        </span>
      </div>
    </div>
  );
};

function Metric({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div style={{
      backgroundColor: COLORS.bg, borderRadius: 5, padding: "6px 8px",
      display: "flex", flexDirection: "column", gap: 1,
    }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: accent, fontFamily: FONT_MONO }}>{value}</div>
      <div style={{ fontSize: 9, color: COLORS.textMuted }}>{label}</div>
    </div>
  );
}
