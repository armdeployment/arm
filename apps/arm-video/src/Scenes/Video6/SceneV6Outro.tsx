import { interpolate, useCurrentFrame, Easing } from "remotion";
import { COLORS, FONT_SANS, FONT_MONO } from "../../theme";
import { V6 } from "../../data/video6-data";

export const SceneV6Outro: React.FC = () => {
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
          marginBottom: 30,
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
          Start to Finish, One Take
        </div>
        <div
          style={{
            fontSize: 32,
            fontWeight: 700,
            color: COLORS.white,
            letterSpacing: -0.5,
          }}
        >
          The Whole Install, No Fabricated Screens
        </div>
      </div>

      <div style={{ display: "flex", gap: 20 }}>
        {V6.recap.map((item, i) => (
          <div
            key={item.unit}
            style={{
              opacity: interpolate(frame, [16 + i * 8, 30 + i * 8], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              transform: `translateY(${(1 - interpolate(frame, [16 + i * 8, 30 + i * 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })) * 20}px)`,
              textAlign: "center",
              minWidth: 130,
            }}
          >
            <div
              style={{
                fontSize: 40,
                fontWeight: 800,
                color: COLORS.goldLight,
                fontFamily: FONT_MONO,
              }}
            >
              {item.label}
            </div>
            <div
              style={{
                fontSize: 11.5,
                color: COLORS.textDarkMuted,
                marginTop: 6,
              }}
            >
              {item.unit}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          opacity: interpolate(frame, [56, 70], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          marginTop: 34,
          fontSize: 12,
          color: COLORS.textDarkMuted,
          fontFamily: FONT_MONO,
          textAlign: "center",
        }}
      >
        Same activation code, same session, questionnaire through analysis —
        real every step
      </div>
    </div>
  );
};
