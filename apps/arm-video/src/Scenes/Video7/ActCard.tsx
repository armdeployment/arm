import { interpolate, useCurrentFrame, Easing } from "remotion";
import { COLORS, FONT_SANS, FONT_MONO } from "../../theme";

/** Chapter divider between the acts (employee → manager → server). */
export const ActCard: React.FC<{
  act: string;
  title: string;
  blurb: string;
  bullets: string[];
  accent?: string;
}> = ({ act, title, blurb, bullets, accent = COLORS.goldLight }) => {
  const frame = useCurrentFrame();
  const appear = interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const y = interpolate(frame, [0, 15], [30, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  return (
    <div style={{
      width: "100%", height: "100%", backgroundColor: COLORS.navyDark,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: FONT_SANS, padding: "40px 60px",
    }}>
      <div style={{ opacity: appear, transform: `translateY(${y}px)`, textAlign: "center" }}>
        <div style={{ fontSize: 13, color: accent, fontWeight: 700, letterSpacing: 4, textTransform: "uppercase", marginBottom: 14 }}>
          {act}
        </div>
        <div style={{ fontSize: 42, fontWeight: 700, color: COLORS.white, letterSpacing: -1 }}>{title}</div>
        <div style={{ fontSize: 15.5, color: COLORS.textDarkMuted, marginTop: 16, maxWidth: 760, margin: "16px auto 0", lineHeight: 1.6 }}>
          {blurb}
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 40, flexWrap: "wrap", justifyContent: "center", maxWidth: 1050 }}>
        {bullets.map((b, i) => (
          <div key={b} style={{
            opacity: interpolate(frame, [22 + i * 8, 36 + i * 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            backgroundColor: COLORS.slate800, border: `1px solid ${COLORS.borderDark}`,
            borderRadius: 8, padding: "11px 16px",
          }}>
            <span style={{ fontSize: 12.5, color: COLORS.white, fontFamily: FONT_MONO }}>{b}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
