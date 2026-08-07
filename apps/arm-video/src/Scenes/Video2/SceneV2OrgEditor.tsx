import { interpolate, useCurrentFrame, Easing, Img, staticFile } from "remotion";
import { COLORS, FONT_SANS, FONT_MONO } from "../../theme";

// Real org-editor interaction steps (from the /organization page — real screenshot)
const EDIT_STEPS = [
  { icon: "＋", label: "Add plant", detail: "Plant Austin · Austin, TX · $3,000/mo" },
  { icon: "✎", label: "Rename", detail: "Plant Shenzhen → Plant Suzhou (relocated)" },
  { icon: "↗", label: "Reparent", detail: "Move Plant Detroit → Manufacturing Division" },
  { icon: "✕", label: "Delete", detail: "Remove dept (blocked if active agents)" },
];

export const SceneV2OrgEditor: React.FC = () => {
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
          Growth · Restructure as You Expand
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, color: COLORS.text, letterSpacing: -0.5 }}>
          The Org Editor — Add, Rename, Move, Delete
        </div>
      </div>

      <div style={{ display: "flex", gap: 20, width: "100%", maxWidth: 1200 }}>
        {/* Real org-editor screenshot */}
        <div style={{ flex: 1.15 }}>
          <div style={{
            opacity: interpolate(frame, [12, 26], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            backgroundColor: COLORS.white, borderRadius: 8, border: `1px solid ${COLORS.border}`,
            overflow: "hidden", boxShadow: "0 8px 30px rgba(0,0,0,0.10)",
          }}>
            <Img src={staticFile("shots/organization.png")} style={{ width: "100%", display: "block" }} />
          </div>
          <div style={{
            opacity: interpolate(frame, [26, 38], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            marginTop: 8, textAlign: "center", fontSize: 10, color: COLORS.textMuted,
          }}>
            ARM dashboard · /organization — real screenshot
          </div>
        </div>

        {/* Edit actions */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, justifyContent: "center" }}>
          {EDIT_STEPS.map((step, i) => {
            const appear = interpolate(frame, [18 + i * 8, 30 + i * 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            const isDanger = step.icon === "↗" || step.icon === "✕";
            return (
              <div key={i} style={{
                opacity: appear, transform: `translateX(${(1 - appear) * 30}px)`,
                display: "flex", alignItems: "center", gap: 12,
                backgroundColor: COLORS.white, border: `1px solid ${COLORS.border}`,
                borderRadius: 8, padding: "12px 16px",
              }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16, fontWeight: 700,
                  backgroundColor: isDanger ? "rgba(220,38,38,0.08)" : "rgba(30,58,138,0.08)",
                  color: isDanger ? COLORS.red : COLORS.navy,
                }}>
                  {step.icon}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>{step.label}</div>
                  <div style={{ fontSize: 10.5, color: COLORS.textMuted, fontFamily: FONT_MONO }}>{step.detail}</div>
                </div>
                {isDanger && (
                  <span style={{
                    marginLeft: "auto", fontSize: 8, fontWeight: 700, textTransform: "uppercase",
                    color: COLORS.red, backgroundColor: "rgba(220,38,38,0.08)",
                    padding: "2px 6px", borderRadius: 3,
                  }}>
                    Admin only
                  </span>
                )}
              </div>
            );
          })}

          {/* Permission banner */}
          <div style={{
            opacity: interpolate(frame, [52, 66], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            backgroundColor: COLORS.navy, borderRadius: 8, padding: "12px 16px",
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.white }}>🔐 Every edit is permission-checked (D8)</div>
            <div style={{ fontSize: 9.5, color: COLORS.textDarkMuted, marginTop: 4, fontFamily: FONT_MONO }}>
              reparent + delete → org_admin only · create + rename → delegated · audit-logged
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
