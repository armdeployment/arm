import { interpolate, useCurrentFrame, Easing } from "remotion";
import { COLORS, FONT_SANS, FONT_MONO } from "../../theme";

const RECAP = [
  {
    label: "Questionnaire",
    detail: "new senior_manager option, live and scored",
  },
  {
    label: "Recommendation",
    detail: "real activation code, real 15-minute expiry",
  },
  {
    label: "arm setup",
    detail: "real redemption — package, components, connections",
  },
  {
    label: "arm refine",
    detail: "pain points + folder + tools, all local (A5)",
  },
];

export const SceneV4Outro: React.FC = () => {
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
        padding: "30px 60px",
      }}
    >
      <div
        style={{
          opacity: titleAppear,
          transform: `translateY(${titleY}px)`,
          textAlign: "center",
          marginBottom: 24,
        }}
      >
        <div
          style={{
            fontSize: 14,
            color: COLORS.goldLight,
            fontWeight: 600,
            letterSpacing: 2,
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          Beachhead → Installed
        </div>
        <div
          style={{
            fontSize: 30,
            fontWeight: 700,
            color: COLORS.white,
            letterSpacing: -0.5,
          }}
        >
          Four Real Steps, Zero Fabricated Screens
        </div>
      </div>

      <div style={{ display: "flex", gap: 14, width: "100%" }}>
        {RECAP.map((item, i) => {
          const appear = interpolate(
            frame,
            [16 + i * 10, 30 + i * 10],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          );
          return (
            <div
              key={item.label}
              style={{
                opacity: appear,
                transform: `translateY(${(1 - appear) * 24}px)`,
                flex: 1,
                backgroundColor: COLORS.slate800,
                border: `1px solid ${COLORS.borderDark}`,
                borderRadius: 10,
                padding: "16px 18px",
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: COLORS.greenDark,
                  fontFamily: FONT_MONO,
                  marginBottom: 8,
                }}
              >
                ✓ {item.label}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: COLORS.textDarkMuted,
                  lineHeight: 1.6,
                }}
              >
                {item.detail}
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          opacity: interpolate(frame, [64, 78], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          marginTop: 30,
          fontSize: 12,
          color: COLORS.textDarkMuted,
          fontFamily: FONT_MONO,
          textAlign: "center",
        }}
      >
        Senior managers — the beachhead — now get a package built for them, end
        to end
      </div>
    </div>
  );
};
