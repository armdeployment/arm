import { interpolate, useCurrentFrame, Easing } from "remotion";
import { COLORS, FONT_SANS, FONT_MONO } from "../../theme";
import { V2 } from "../../data/video2-data";

export const SceneV2OrgTrees: React.FC = () => {
  const frame = useCurrentFrame();

  const titleAppear = interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const titleY = interpolate(frame, [0, 15], [30, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });

  return (
    <div style={{
      width: "100%", height: "100%", backgroundColor: COLORS.bg,
      display: "flex", flexDirection: "column", alignItems: "center",
      fontFamily: FONT_SANS, padding: "30px 44px",
    }}>
      {/* Title */}
      <div style={{
        opacity: titleAppear, transform: `translateY(${titleY}px)`,
        textAlign: "center", marginBottom: 18,
      }}>
        <div style={{ fontSize: 12, color: COLORS.gold, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>
          Provisioning · Choose Your Structure
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, color: COLORS.text, letterSpacing: -0.5 }}>
          Real Org Trees, Real Hierarchies
        </div>
      </div>

      {/* Profile cards with trees */}
      <div style={{ display: "flex", gap: 16, width: "100%" }}>
        {V2.profiles.map((p, i) => {
          const appear = interpolate(frame, [8 + i * 8, 22 + i * 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const y = interpolate(frame, [8 + i * 8, 22 + i * 8], [30, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });
          const isHolding = p.id === "holding";

          return (
            <div key={i} style={{
              opacity: appear, transform: `translateY(${y}px)`, flex: 1,
              backgroundColor: COLORS.white, borderRadius: 10, border: `1px solid ${COLORS.border}`,
              padding: "14px 16px", boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
              display: "flex", flexDirection: "column", gap: 8,
            }}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 8, borderBottom: `1px solid ${COLORS.border}` }}>
                <span style={{ fontSize: 22 }}>{p.icon}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.text }}>{p.label.split(" / ")[0]}</div>
                  <div style={{ fontSize: 8.5, fontFamily: FONT_MONO, color: COLORS.gold }}>{p.treeSummary}</div>
                </div>
              </div>

              {/* Tree nodes */}
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {p.orgNodes.map((node, ni) => {
                  const nodeAppear = interpolate(frame, [18 + i * 8 + ni * 4, 28 + i * 8 + ni * 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
                  const isContainer = node.name.includes("Plant") || node.name.includes("HQ") || node.name.includes("Subsidiary") || node.name.includes("Corporate");
                  return (
                    <div key={ni} style={{
                      opacity: nodeAppear,
                      display: "flex", alignItems: "center", gap: 5,
                      padding: "3px 6px", borderRadius: 4,
                      backgroundColor: isContainer ? COLORS.bg : "transparent",
                      fontSize: 9.5,
                    }}>
                      <span style={{ fontSize: 11 }}>{node.icon}</span>
                      <span style={{ fontWeight: isContainer ? 700 : 400, color: node.color, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {node.name}
                      </span>
                      {node.location && (
                        <span style={{ fontSize: 7.5, color: COLORS.textMuted, whiteSpace: "nowrap" }}>📍 {node.location.split(",")[0]}</span>
                      )}
                      {node.tag && (
                        <span style={{
                          fontSize: 6.5, fontFamily: FONT_MONO, fontWeight: 700,
                          color: COLORS.red, backgroundColor: "rgba(220,38,38,0.08)",
                          padding: "1px 3px", borderRadius: 2,
                        }}>
                          {node.tag}
                        </span>
                      )}
                      <span style={{ fontSize: 7.5, fontFamily: FONT_MONO, color: COLORS.textMuted, whiteSpace: "nowrap" }}>{node.budget}</span>
                    </div>
                  );
                })}
              </div>

              {/* Stats row */}
              <div style={{ display: "flex", gap: 4, marginTop: "auto" }}>
                {p.stats.map((s, si) => (
                  <div key={si} style={{
                    flex: 1, backgroundColor: COLORS.bg, borderRadius: 4, padding: "4px 6px",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.navy, fontFamily: FONT_MONO }}>{s.value}</div>
                    <div style={{ fontSize: 6.5, color: COLORS.textMuted }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {isHolding && (
                <div style={{ fontSize: 7.5, color: COLORS.textMuted, fontStyle: "italic" }}>
                  Each subsidiary runs its own profile · Chinese walls by default
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom note */}
      <div style={{
        opacity: interpolate(frame, [75, 88], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        marginTop: 12, fontSize: 10, color: COLORS.textMuted,
      }}>
        Real data from @arm/profiles presets · rendered in the /provisioning wizard
      </div>
    </div>
  );
};
