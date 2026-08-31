import {
  interpolate,
  useCurrentFrame,
  Easing,
  Img,
  staticFile,
} from "remotion";
import { COLORS, FONT_SANS, FONT_MONO } from "../../theme";
import { V6 } from "../../data/video6-data";

export const SceneV6Chat: React.FC = () => {
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
            color: COLORS.cyan,
            fontWeight: 600,
            letterSpacing: 2,
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          Step 5 · Optional — "Talk It Through"
        </div>
        <div
          style={{
            fontSize: 30,
            fontWeight: 700,
            color: COLORS.text,
            letterSpacing: -0.5,
          }}
        >
          A Real Reply, Routed Through the Tenant's Own Proxy
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 18,
          width: "100%",
          flex: 1,
          minHeight: 0,
        }}
      >
        <div style={{ flex: 1.6, display: "flex", flexDirection: "column" }}>
          <div
            style={{
              opacity: interpolate(frame, [12, 26], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              backgroundColor: COLORS.white,
              borderRadius: 10,
              border: `1px solid ${COLORS.border}`,
              overflow: "hidden",
              boxShadow: "0 8px 30px rgba(0,0,0,0.10)",
              flex: 1,
            }}
          >
            <Img
              src={staticFile("install-e2e/06-gui-chat.png")}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "50% 78%",
                display: "block",
              }}
            />
          </div>
          <div
            style={{
              opacity: interpolate(frame, [26, 38], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              marginTop: 8,
              textAlign: "center",
              fontSize: 12,
              color: COLORS.textMuted,
            }}
          >
            Real screenshot — a live reply from Ollama, not simulated
          </div>
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            justifyContent: "center",
            minWidth: 0,
          }}
        >
          <div
            style={{
              opacity: interpolate(frame, [16, 30], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              backgroundColor: COLORS.navyDark,
              borderRadius: 10,
              padding: "16px 18px",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: COLORS.goldLight,
                marginBottom: 8,
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              What was typed
            </div>
            <div
              style={{
                fontSize: 12.5,
                color: COLORS.white,
                fontStyle: "italic",
                lineHeight: 1.6,
              }}
            >
              "{V6.chat.user}"
            </div>
          </div>

          <div
            style={{
              opacity: interpolate(frame, [32, 46], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              backgroundColor: "rgba(22,163,74,0.06)",
              border: `1px solid ${COLORS.green}33`,
              borderRadius: 10,
              padding: "14px 16px",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: COLORS.green,
                marginBottom: 6,
              }}
            >
              ✓ Classified after the conversation
            </div>
            <div
              style={{
                fontSize: 12,
                fontFamily: FONT_MONO,
                color: COLORS.text,
              }}
            >
              {V6.chat.classification.tag} →{" "}
              <span style={{ fontWeight: 700 }}>
                {V6.chat.classification.jobFunctionHint}
              </span>
            </div>
          </div>

          <div
            style={{
              opacity: interpolate(frame, [54, 68], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              fontSize: 11.5,
              color: COLORS.textMuted,
              lineHeight: 1.5,
            }}
          >
            Never a third party, never ARM's own control plane — the same
            armProxyUrl + agentToken every other tool call this install makes
            already uses.
          </div>
        </div>
      </div>
    </div>
  );
};
