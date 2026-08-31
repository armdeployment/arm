import { interpolate, useCurrentFrame, Easing } from "remotion";
import { COLORS, FONT_SANS, FONT_MONO } from "../../theme";

export const SceneV5Intro: React.FC = () => {
  const frame = useCurrentFrame();

  const titleAppear = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleY = interpolate(frame, [0, 15], [30, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: COLORS.navyDark,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT_SANS,
        padding: "40px 60px",
      }}
    >
      <div
        style={{
          opacity: titleAppear,
          transform: `translateY(${titleY}px)`,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 14,
            color: COLORS.goldLight,
            fontWeight: 600,
            letterSpacing: 3,
            textTransform: "uppercase",
            marginBottom: 12,
          }}
        >
          ARM · Installation Wizard, Continued
        </div>
        <div
          style={{
            fontSize: 44,
            fontWeight: 700,
            color: COLORS.white,
            letterSpacing: -1,
            lineHeight: 1.15,
          }}
        >
          The Wizard Talks Back
        </div>
        <div
          style={{
            fontSize: 16,
            color: COLORS.textDarkMuted,
            marginTop: 20,
            maxWidth: 780,
            margin: "20px auto 0",
            lineHeight: 1.6,
          }}
        >
          A real conversation with a real LLM, routed through the tenant's own
          connection — and a folder picker that understands you work across more
          than one project. Nothing staged; every screen here is a live capture.
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, marginTop: 44 }}>
        {[
          { label: "Chat assistant", sub: "real Ollama reply" },
          { label: "Multi-folder scan", sub: "2 real projects" },
        ].map((item, i) => (
          <div
            key={item.label}
            style={{
              opacity: interpolate(frame, [24 + i * 10, 38 + i * 10], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              backgroundColor: COLORS.slate800,
              border: `1px solid ${COLORS.borderDark}`,
              borderRadius: 10,
              padding: "18px 24px",
              textAlign: "center",
              minWidth: 220,
            }}
          >
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: COLORS.white,
                fontFamily: FONT_MONO,
              }}
            >
              {item.label}
            </div>
            <div
              style={{
                fontSize: 12,
                color: COLORS.goldLight,
                marginTop: 8,
                fontWeight: 700,
              }}
            >
              {item.sub}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
