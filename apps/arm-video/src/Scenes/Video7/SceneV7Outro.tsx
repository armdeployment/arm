import { interpolate, useCurrentFrame, Easing } from "remotion";
import { COLORS, FONT_SANS, FONT_MONO } from "../../theme";

const STATS = [
  { n: "19", unit: "executable guardrails" },
  { n: "0", unit: "terminal commands to install" },
  { n: "2", unit: "planes, one hard boundary" },
  { n: "1", unit: "command to run it all" },
];

export const SceneV7Outro: React.FC = () => {
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
        <div style={{ fontSize: 14, color: COLORS.goldLight, fontWeight: 600, letterSpacing: 3, textTransform: "uppercase", marginBottom: 12 }}>
          Open Source · Apache 2.0
        </div>
        <div style={{ fontSize: 42, fontWeight: 700, color: COLORS.white, letterSpacing: -1 }}>
          Run the Whole Thing in 60 Seconds
        </div>
      </div>

      <div style={{
        opacity: interpolate(frame, [18, 32], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        marginTop: 30, backgroundColor: COLORS.slate900, border: `1px solid ${COLORS.borderDark}`,
        borderRadius: 12, padding: "22px 32px",
      }}>
        <div style={{ fontSize: 15, fontFamily: FONT_MONO, color: COLORS.greenDark, lineHeight: 2 }}>
          <div><span style={{ color: COLORS.textDarkMuted }}>$</span> corepack enable pnpm</div>
          <div><span style={{ color: COLORS.textDarkMuted }}>$</span> pnpm install</div>
          <div><span style={{ color: COLORS.textDarkMuted }}>$</span> pnpm --filter @arm-app/web build && pnpm --filter @arm-app/web start</div>
        </div>
        <div style={{ fontSize: 11.5, color: COLORS.textDarkMuted, marginTop: 12, fontFamily: FONT_MONO }}>
          no database · no Docker · no API key — fixtures by default
        </div>
      </div>

      <div style={{ display: "flex", gap: 26, marginTop: 36 }}>
        {STATS.map((s, i) => (
          <div key={s.unit} style={{
            opacity: interpolate(frame, [36 + i * 8, 50 + i * 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            textAlign: "center", minWidth: 150,
          }}>
            <div style={{ fontSize: 36, fontWeight: 800, color: COLORS.goldLight, fontFamily: FONT_MONO }}>{s.n}</div>
            <div style={{ fontSize: 11, color: COLORS.textDarkMuted, marginTop: 5 }}>{s.unit}</div>
          </div>
        ))}
      </div>

      <div style={{
        opacity: interpolate(frame, [74, 90], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        marginTop: 34, fontSize: 13, color: COLORS.white, fontFamily: FONT_MONO,
      }}>
        github.com/armdeployment/arm
      </div>
      <div style={{
        opacity: interpolate(frame, [80, 96], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        marginTop: 10, fontSize: 11.5, color: COLORS.textDarkMuted, textAlign: "center",
      }}>
        Every screen in this video is a real capture from a live run — no mockups.
      </div>
    </div>
  );
};
