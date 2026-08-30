import { interpolate, useCurrentFrame, Easing } from "remotion";
import { COLORS, FONT_SANS, FONT_MONO } from "../../theme";

const RECAP = [
  { label: "Chat assistant", detail: "real LLM, routed through the tenant's own proxy" },
  { label: "Same trust boundary", detail: "never third-party, never ARM's control plane" },
  { label: "Multi-project scan", detail: "+ Add folder…, union of every folder added" },
  { label: "Still A5-safe", detail: "only derived tags cross into the recommendation" },
];

export const SceneV5Outro: React.FC = () => {
  const frame = useCurrentFrame();

  const titleAppear = interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const titleY = interpolate(frame, [0, 15], [30, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });

  return (
    <div style={{
      width: "100%", height: "100%", backgroundColor: COLORS.navyDark,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: FONT_SANS, padding: "30px 60px",
    }}>
      <div style={{ opacity: titleAppear, transform: `translateY(${titleY}px)`, textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 14, color: COLORS.goldLight, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>
          Still Zero Terminal Commands
        </div>
        <div style={{ fontSize: 30, fontWeight: 700, color: COLORS.white, letterSpacing: -0.5 }}>
          A Richer Conversation, the Same Guarantees
        </div>
      </div>

      <div style={{ display: "flex", gap: 14, width: "100%" }}>
        {RECAP.map((item, i) => (
          <div key={item.label} style={{
            opacity: interpolate(frame, [16 + i * 10, 30 + i * 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            transform: `translateY(${(1 - interpolate(frame, [16 + i * 10, 30 + i * 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })) * 24}px)`,
            flex: 1, backgroundColor: COLORS.slate800, border: `1px solid ${COLORS.borderDark}`,
            borderRadius: 10, padding: "16px 18px",
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.greenDark, fontFamily: FONT_MONO, marginBottom: 8 }}>
              ✓ {item.label}
            </div>
            <div style={{ fontSize: 11.5, color: COLORS.textDarkMuted, lineHeight: 1.6 }}>{item.detail}</div>
          </div>
        ))}
      </div>

      <div style={{
        opacity: interpolate(frame, [64, 78], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        marginTop: 30, fontSize: 12, color: COLORS.textDarkMuted, fontFamily: FONT_MONO, textAlign: "center",
      }}>
        Real activation code · real Ollama reply · real folder scan · nothing fabricated for this video
      </div>
    </div>
  );
};
