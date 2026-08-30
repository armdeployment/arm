import { interpolate, useCurrentFrame, Easing } from "remotion";
import { COLORS, FONT_SANS, FONT_MONO } from "../../theme";
import { V6 } from "../../data/video6-data";

export const SceneV6Intro: React.FC = () => {
  const frame = useCurrentFrame();

  const titleAppear = interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const titleY = interpolate(frame, [0, 15], [30, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });

  return (
    <div style={{
      width: "100%", height: "100%", backgroundColor: COLORS.navyDark,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: FONT_SANS, padding: "40px 60px",
    }}>
      <div style={{ opacity: titleAppear, transform: `translateY(${titleY}px)`, textAlign: "center" }}>
        <div style={{ fontSize: 14, color: COLORS.goldLight, fontWeight: 600, letterSpacing: 3, textTransform: "uppercase", marginBottom: 12 }}>
          ARM · Installation, Start to Finish
        </div>
        <div style={{ fontSize: 44, fontWeight: 700, color: COLORS.white, letterSpacing: -1, lineHeight: 1.15 }}>
          One Real Session, End to End
        </div>
        <div style={{ fontSize: 16, color: COLORS.textDarkMuted, marginTop: 20, maxWidth: 800, margin: "20px auto 0", lineHeight: 1.6 }}>
          Every screen below is one continuous, unscripted run — the same activation code,
          the same person, from the first question to a real conversation and a real folder
          scan. Nothing staged, nothing recombined from separate takes.
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 40, flexWrap: "wrap", justifyContent: "center", maxWidth: 1000 }}>
        {V6.steps.map((step, i) => (
          <div key={step.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              opacity: interpolate(frame, [20 + i * 7, 32 + i * 7], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
              backgroundColor: COLORS.slate800, border: `1px solid ${COLORS.borderDark}`,
              borderRadius: 8, padding: "10px 14px",
            }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.white, fontFamily: FONT_MONO }}>{step.label}</span>
            </div>
            {i < V6.steps.length - 1 && (
              <span style={{
                opacity: interpolate(frame, [26 + i * 7, 34 + i * 7], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
                color: COLORS.textDarkMuted, fontSize: 13,
              }}>→</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
