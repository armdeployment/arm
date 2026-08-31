import { interpolate, useCurrentFrame, Easing } from "remotion";
import { COLORS, FONT_SANS, FONT_MONO } from "../../theme";
import { V5 } from "../../data/video5-data";

export const SceneV5Routing: React.FC = () => {
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
        backgroundColor: COLORS.bg,
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
          marginBottom: 24,
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
          Where the Conversation Actually Goes
        </div>
        <div
          style={{
            fontSize: 30,
            fontWeight: 700,
            color: COLORS.text,
            letterSpacing: -0.5,
          }}
        >
          Same Trust Boundary as Every Other Tool Call
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 30,
        }}
      >
        {V5.routing.map((step, i) => (
          <div
            key={step.label}
            style={{ display: "flex", alignItems: "center", gap: 10 }}
          >
            <div
              style={{
                opacity: interpolate(
                  frame,
                  [10 + i * 12, 24 + i * 12],
                  [0, 1],
                  { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
                ),
                backgroundColor: i === 1 ? COLORS.navy : COLORS.white,
                border: `1.5px solid ${i === 1 ? COLORS.navy : COLORS.border}`,
                borderRadius: 10,
                padding: "16px 20px",
                minWidth: 200,
                textAlign: "center",
                boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: i === 1 ? COLORS.white : COLORS.text,
                  fontFamily: FONT_MONO,
                }}
              >
                {step.label}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: i === 1 ? COLORS.textDarkMuted : COLORS.textMuted,
                  marginTop: 6,
                }}
              >
                {step.detail}
              </div>
            </div>
            {i < V5.routing.length - 1 && (
              <span
                style={{
                  opacity: interpolate(
                    frame,
                    [18 + i * 12, 28 + i * 12],
                    [0, 1],
                    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
                  ),
                  color: COLORS.textMuted,
                  fontSize: 18,
                }}
              >
                →
              </span>
            )}
          </div>
        ))}
      </div>

      <div
        style={{
          opacity: interpolate(frame, [48, 60], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          fontSize: 12,
          color: COLORS.textMuted,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 1,
          marginBottom: 12,
        }}
      >
        Never routes through
      </div>

      <div style={{ display: "flex", gap: 16 }}>
        {V5.notRouting.map((item, i) => (
          <div
            key={item.label}
            style={{
              opacity: interpolate(frame, [54 + i * 10, 66 + i * 10], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              backgroundColor: "rgba(220,38,38,0.06)",
              border: `1px solid ${COLORS.red}33`,
              borderRadius: 10,
              padding: "14px 20px",
              minWidth: 230,
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: COLORS.red,
                fontFamily: FONT_MONO,
              }}
            >
              ✗ {item.label}
            </div>
            <div
              style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 6 }}
            >
              {item.reason}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          opacity: interpolate(frame, [78, 92], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          marginTop: 26,
          fontSize: 12,
          color: COLORS.textMuted,
          fontFamily: FONT_MONO,
          textAlign: "center",
          maxWidth: 700,
        }}
      >
        The proxy applies the exact same DLP/quota/model-access gates as any
        other agent call — this conversation is not a new trust boundary, it's
        the same one.
      </div>
    </div>
  );
};
