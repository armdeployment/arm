import { interpolate, useCurrentFrame, Easing, Img, staticFile } from "remotion";
import { COLORS, FONT_SANS, FONT_MONO } from "../../theme";
import { V2 } from "../../data/video2-data";

export const SceneV2Roles: React.FC = () => {
  const frame = useCurrentFrame();

  const titleAppear = interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const titleY = interpolate(frame, [0, 15], [30, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });

  return (
    <div style={{
      width: "100%", height: "100%", backgroundColor: COLORS.bg,
      display: "flex", flexDirection: "column", alignItems: "center",
      fontFamily: FONT_SANS, padding: "30px 50px",
    }}>
      {/* Title */}
      <div style={{
        opacity: titleAppear, transform: `translateY(${titleY}px)`,
        textAlign: "center", marginBottom: 18,
      }}>
        <div style={{ fontSize: 12, color: COLORS.gold, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>
          Governance · Who Can Do What
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, color: COLORS.text, letterSpacing: -0.5 }}>
          Capability-Based Roles, Not Titles
        </div>
      </div>

      <div style={{ display: "flex", gap: 20, width: "100%", maxWidth: 1200 }}>
        {/* Role presets */}
        <div style={{ flex: 1.1, display: "flex", flexDirection: "column", gap: 8 }}>
          {V2.rolePresets.map((role, i) => {
            const appear = interpolate(frame, [10 + i * 6, 22 + i * 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            const y = interpolate(frame, [10 + i * 6, 22 + i * 6], [24, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });
            return (
              <div key={i} style={{
                opacity: appear, transform: `translateY(${y}px)`,
                display: "flex", alignItems: "center", gap: 10,
                backgroundColor: COLORS.white, border: `1px solid ${role.key === "org_admin" ? COLORS.navy : COLORS.border}`,
                borderRadius: 8, padding: "9px 12px",
              }}>
                <span style={{ fontSize: 18 }}>{role.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.text }}>
                    {role.label}
                    <span style={{ fontSize: 8.5, color: COLORS.textMuted, marginLeft: 6, fontFamily: FONT_MONO }}>{role.key}</span>
                  </div>
                  <div style={{ fontSize: 9, color: COLORS.textMuted }}>Scope: <span style={{ fontFamily: FONT_MONO }}>{role.scope}</span></div>
                </div>
                <div style={{ display: "flex", gap: 3 }}>
                  {role.perms.length === 0 && <span style={{ fontSize: 8.5, color: COLORS.textMuted, fontStyle: "italic" }}>read-only</span>}
                  {role.perms.map((perm, pi) => {
                    const isDanger = role.danger?.includes(perm);
                    return (
                      <span key={pi} style={{
                        fontSize: 7.5, fontFamily: FONT_MONO, fontWeight: 700,
                        padding: "2px 5px", borderRadius: 3,
                        backgroundColor: isDanger ? "rgba(220,38,38,0.08)" : "rgba(30,58,138,0.08)",
                        color: isDanger ? COLORS.red : COLORS.navy,
                      }}>
                        {perm}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Governing rules */}
          <div style={{
            opacity: interpolate(frame, [45, 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            marginTop: 6, backgroundColor: COLORS.navyDark, borderRadius: 8, padding: "12px 16px",
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.white, marginBottom: 6 }}>⚙ Governing rules</div>
            {V2.governingRules.map((rule, i) => (
              <div key={i} style={{ fontSize: 9, color: COLORS.textDarkMuted, marginTop: 3, fontFamily: FONT_MONO }}>
                <span style={{ color: COLORS.goldLight }}>{rule.key}</span> — {rule.text}
              </div>
            ))}
          </div>
        </div>

        {/* Real /admin/roles screenshot */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{
            opacity: interpolate(frame, [25, 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            backgroundColor: COLORS.white, borderRadius: 8, border: `1px solid ${COLORS.border}`,
            overflow: "hidden", boxShadow: "0 8px 30px rgba(0,0,0,0.10)",
          }}>
            <Img src={staticFile("shots/roles.png")} style={{ width: "100%", display: "block" }} />
          </div>
          <div style={{
            opacity: interpolate(frame, [40, 52], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            marginTop: 8, textAlign: "center", fontSize: 10, color: COLORS.textMuted,
          }}>
            ARM dashboard · /admin/roles — real screenshot
          </div>
        </div>
      </div>
    </div>
  );
};
