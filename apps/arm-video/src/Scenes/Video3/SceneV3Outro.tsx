import { interpolate, useCurrentFrame, Easing } from "remotion";
import { COLORS, FONT_SANS, FONT_MONO } from "../../theme";
import { V3 } from "../../data/video3-data";

export const SceneV3Outro: React.FC = () => {
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
        fontFamily: FONT_SANS,
        padding: "30px 60px",
      }}
    >
      <div
        style={{
          opacity: titleAppear,
          transform: `translateY(${titleY}px)`,
          textAlign: "center",
          marginBottom: 20,
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
          Found by Clicking Buttons, Not Just Writing Tests
        </div>
        <div
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: COLORS.white,
            letterSpacing: -0.5,
          }}
        >
          Real Bugs Real Testing Caught
        </div>
      </div>

      <div style={{ display: "flex", gap: 14, width: "100%" }}>
        {V3.bugsFound.map((bug, i) => {
          const appear = interpolate(
            frame,
            [16 + i * 10, 30 + i * 10],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          );
          return (
            <div
              key={i}
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
                  color: COLORS.redDark,
                  fontFamily: FONT_MONO,
                  marginBottom: 8,
                }}
              >
                ✗ {bug.title}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: COLORS.textDarkMuted,
                  lineHeight: 1.6,
                }}
              >
                {bug.detail}
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          opacity: interpolate(frame, [58, 74], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          marginTop: 30,
          display: "flex",
          gap: 28,
          alignItems: "center",
          backgroundColor: COLORS.slate900,
          borderRadius: 12,
          padding: "20px 32px",
          border: `1px solid ${COLORS.borderDark}`,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: 30,
              fontWeight: 800,
              color: COLORS.greenDark,
              fontFamily: FONT_MONO,
            }}
          >
            {V3.testSummary.tests}/{V3.testSummary.tests}
          </div>
          <div
            style={{ fontSize: 11, color: COLORS.textDarkMuted, marginTop: 2 }}
          >
            tests passing
          </div>
        </div>
        <div
          style={{ width: 1, height: 40, backgroundColor: COLORS.borderDark }}
        />
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: 30,
              fontWeight: 800,
              color: COLORS.white,
              fontFamily: FONT_MONO,
            }}
          >
            {V3.testSummary.files}
          </div>
          <div
            style={{ fontSize: 11, color: COLORS.textDarkMuted, marginTop: 2 }}
          >
            test files
          </div>
        </div>
        <div
          style={{ width: 1, height: 40, backgroundColor: COLORS.borderDark }}
        />
        <div style={{ textAlign: "center", maxWidth: 220 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: COLORS.goldLight,
              fontFamily: FONT_MONO,
            }}
          >
            live-DB tests
          </div>
          <div
            style={{
              fontSize: 10.5,
              color: COLORS.textDarkMuted,
              marginTop: 4,
            }}
          >
            {V3.testSummary.withLiveDb}
          </div>
        </div>
      </div>

      <div
        style={{
          opacity: interpolate(frame, [82, 96], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          marginTop: 24,
          fontSize: 12,
          color: COLORS.textDarkMuted,
          fontFamily: FONT_MONO,
          textAlign: "center",
        }}
      >
        Same dashboard, same tRPC contract · fixture mode by default, real mode
        on demand
      </div>
    </div>
  );
};
