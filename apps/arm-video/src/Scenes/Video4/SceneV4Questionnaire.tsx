import { interpolate, useCurrentFrame, Easing, Img, staticFile } from "remotion";
import { COLORS, FONT_SANS, FONT_MONO } from "../../theme";
import { V4 } from "../../data/video4-data";

export const SceneV4Questionnaire: React.FC = () => {
  const frame = useCurrentFrame();

  const titleAppear = interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const titleY = interpolate(frame, [0, 15], [30, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });

  return (
    <div style={{
      width: "100%", height: "100%", backgroundColor: COLORS.bg,
      display: "flex", flexDirection: "column", alignItems: "center",
      fontFamily: FONT_SANS, padding: "24px 44px",
    }}>
      <div style={{ opacity: titleAppear, transform: `translateY(${titleY}px)`, textAlign: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 14, color: COLORS.gold, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>
          Step 1 · apps/onboarding — localhost:3300/start
        </div>
        <div style={{ fontSize: 30, fontWeight: 700, color: COLORS.text, letterSpacing: -0.5 }}>
          "Leading a plant or department" — a New Option, Live
        </div>
      </div>

      <div style={{ display: "flex", gap: 18, width: "100%", flex: 1, minHeight: 0 }}>
        <div style={{ flex: 1.6, display: "flex", flexDirection: "column" }}>
          <div style={{
            opacity: interpolate(frame, [12, 26], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            backgroundColor: COLORS.white, borderRadius: 10, border: `1px solid ${COLORS.border}`,
            overflow: "hidden", boxShadow: "0 8px 30px rgba(0,0,0,0.10)", flex: 1,
          }}>
            <Img
              src={staticFile("install-demo/01-role-cluster.png")}
              style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 20%", display: "block" }}
            />
          </div>
          <div style={{
            opacity: interpolate(frame, [26, 38], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            marginTop: 8, textAlign: "center", fontSize: 12, color: COLORS.textMuted,
          }}>
            Real screenshot — the manufacturing questionnaire graph, live
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, justifyContent: "center", minWidth: 0 }}>
          <div style={{
            opacity: interpolate(frame, [16, 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            backgroundColor: COLORS.navyDark, borderRadius: 10, padding: "16px 18px",
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.white, marginBottom: 10 }}>
              How the answer scores (real, deterministic)
            </div>
            {V4.scoring.map((row, i) => (
              <div key={row.label} style={{
                opacity: interpolate(frame, [24 + i * 8, 36 + i * 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
                display: "flex", justifyContent: "space-between", fontSize: 12, fontFamily: FONT_MONO,
                color: COLORS.textDarkMuted, marginTop: 6,
              }}>
                <span>{row.label}</span>
                <span style={{ color: row.weight > 0 ? COLORS.goldLight : COLORS.textDarkMuted, fontWeight: 700 }}>
                  {row.weight > 0 ? `+${row.weight}` : "—"}
                </span>
              </div>
            ))}
            <div style={{
              opacity: interpolate(frame, [50, 62], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
              marginTop: 10, paddingTop: 10, borderTop: `1px solid ${COLORS.borderDark}`,
              fontSize: 12, fontFamily: FONT_MONO, color: COLORS.goldLight, fontWeight: 700,
            }}>
              senior_manager: 4 pts → highest rank
            </div>
          </div>

          <div style={{
            opacity: interpolate(frame, [58, 72], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            fontSize: 11.5, color: COLORS.textMuted, lineHeight: 1.5,
          }}>
            @arm/questionnaire's score() is pure and deterministic — no LLM, no I/O.
            Same answers always rank the same job function (A5).
          </div>
        </div>
      </div>
    </div>
  );
};
