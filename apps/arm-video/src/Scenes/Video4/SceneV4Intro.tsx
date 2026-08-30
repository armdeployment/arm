import { interpolate, useCurrentFrame, Easing } from "remotion";
import { COLORS, FONT_SANS, FONT_MONO } from "../../theme";

const STEPS = ["Questionnaire", "Recommendation", "arm setup", "arm refine"];

export const SceneV4Intro: React.FC = () => {
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
          ARM · Installation Wizard
        </div>
        <div style={{ fontSize: 44, fontWeight: 700, color: COLORS.white, letterSpacing: -1, lineHeight: 1.15 }}>
          A Senior Manager's First Install
        </div>
        <div style={{ fontSize: 16, color: COLORS.textDarkMuted, marginTop: 20, maxWidth: 780, margin: "20px auto 0", lineHeight: 1.6 }}>
          Every screen and every terminal line in this video is real — a live run through
          the questionnaire, a real activation code, a real <code style={{ fontFamily: FONT_MONO }}>arm setup</code> redemption,
          and a real <code style={{ fontFamily: FONT_MONO }}>arm refine</code>. Nothing staged.
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 44 }}>
        {STEPS.map((step, i) => (
          <div key={step} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              opacity: interpolate(frame, [24 + i * 8, 38 + i * 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
              backgroundColor: COLORS.slate800, border: `1px solid ${COLORS.borderDark}`,
              borderRadius: 10, padding: "12px 18px",
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.white, fontFamily: FONT_MONO }}>{step}</span>
            </div>
            {i < STEPS.length - 1 && (
              <span style={{
                opacity: interpolate(frame, [30 + i * 8, 40 + i * 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
                color: COLORS.textDarkMuted, fontSize: 16,
              }}>→</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
