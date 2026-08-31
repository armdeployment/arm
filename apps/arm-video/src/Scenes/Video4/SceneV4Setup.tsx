import { interpolate, useCurrentFrame, Easing, Sequence } from "remotion";
import { COLORS, FONT_SANS, FONT_MONO } from "../../theme";
import { Monitor, Terminal } from "../../components/Monitor";
import { V4 } from "../../data/video4-data";

export const SceneV4Setup: React.FC = () => {
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

  const commandTyped = Math.min(
    V4.setupCommand.length,
    Math.max(0, Math.floor((frame - 6) * 2.2)),
  );

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: COLORS.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        fontFamily: FONT_SANS,
        padding: "24px 44px",
      }}
    >
      <div
        style={{
          opacity: titleAppear,
          transform: `translateY(${titleY}px)`,
          textAlign: "center",
          marginBottom: 14,
        }}
      >
        <div
          style={{
            fontSize: 14,
            color: COLORS.gold,
            fontWeight: 600,
            letterSpacing: 2,
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          Step 3 · The Real Activation Code, Redeemed
        </div>
        <div
          style={{
            fontSize: 30,
            fontWeight: 700,
            color: COLORS.text,
            letterSpacing: -0.5,
          }}
        >
          One Command, Real Output
        </div>
      </div>

      <div
        style={{
          opacity: interpolate(frame, [10, 24], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <Monitor
          name="Terminal"
          title="arm setup"
          subtitle="~/senior-manager-agent"
          width={1000}
          height={640}
          bezel="#1E293B"
          screenBg="#0F172A"
          rounded={10}
        >
          <div
            style={{
              padding: "16px 20px",
              fontFamily: FONT_MONO,
              fontSize: 14.5,
              color: COLORS.greenDark,
            }}
          >
            $ {V4.setupCommand.slice(0, commandTyped)}
            {commandTyped < V4.setupCommand.length && (
              <span
                style={{
                  opacity: interpolate(frame % 16, [0, 8, 16], [1, 0, 1]),
                }}
              >
                ▋
              </span>
            )}
          </div>
          <Sequence from={50}>
            <Terminal lines={V4.setupTerminal} fontSize={14} active={false} />
          </Sequence>
        </Monitor>
      </div>
    </div>
  );
};
