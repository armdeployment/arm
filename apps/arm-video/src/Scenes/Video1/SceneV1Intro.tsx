import { interpolate, useCurrentFrame, Easing } from "remotion";
import { COLORS, FONT_SANS, FONT_MONO } from "../../theme";
import { V1 } from "../../data/video1-data";

export const SceneV1Intro: React.FC = () => {
  const frame = useCurrentFrame();

  const titleAppear = interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const titleY = interpolate(frame, [0, 15], [30, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });

  return (
    <div style={{
      width: "100%", height: "100%", backgroundColor: COLORS.navyDark,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: FONT_SANS, padding: "40px 60px",
    }}>
      <div style={{
        opacity: titleAppear, transform: `translateY(${titleY}px)`,
        textAlign: "center",
      }}>
        <div style={{ fontSize: 14, color: COLORS.goldLight, fontWeight: 600, letterSpacing: 3, textTransform: "uppercase", marginBottom: 12 }}>
          ARM · Agent Resource Management
        </div>
        <div style={{ fontSize: 44, fontWeight: 700, color: COLORS.white, letterSpacing: -1, lineHeight: 1.15 }}>
          Every Prompt, Tagged.
        </div>
        <div style={{ fontSize: 44, fontWeight: 700, color: COLORS.goldLight, letterSpacing: -1, lineHeight: 1.15, marginTop: 4 }}>
          Every Employee, Governed.
        </div>
        <div style={{ fontSize: 16, color: COLORS.textDarkMuted, marginTop: 20, maxWidth: 760, margin: "20px auto 0", lineHeight: 1.6 }}>
          When your engineers, manufacturing leads, and QA teams work with coding agents,
          ARM classifies every prompt by work-type — in microseconds, without spending a
          single token on classification.
        </div>
      </div>

      {/* Employee chips */}
      <div style={{ display: "flex", gap: 12, marginTop: 40, opacity: interpolate(frame, [20, 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
        {V1.employees.map((emp, i) => {
          const appear = interpolate(frame, [25 + i * 5, 38 + i * 5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div key={i} style={{
              opacity: appear, transform: `translateY(${(1 - appear) * 20}px)`,
              backgroundColor: COLORS.slate800, borderRadius: 8, border: `1px solid ${COLORS.borderDark}`,
              padding: "10px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
            }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.white }}>{emp.name.split(" ")[0]}</div>
              <div style={{ fontSize: 11, color: emp.color, fontFamily: FONT_MONO }}>{emp.agent}</div>
              <div style={{ fontSize: 10, color: COLORS.textDarkMuted }}>{emp.dept}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
