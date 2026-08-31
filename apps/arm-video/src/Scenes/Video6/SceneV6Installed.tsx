import {
  interpolate,
  useCurrentFrame,
  Easing,
  Img,
  staticFile,
} from "remotion";
import { COLORS, FONT_SANS, FONT_MONO } from "../../theme";
import { V6 } from "../../data/video6-data";

export const SceneV6Installed: React.FC = () => {
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
            color: COLORS.gold,
            fontWeight: 600,
            letterSpacing: 2,
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          Step 4 · Real Redemption, Real Components
        </div>
        <div
          style={{
            fontSize: 30,
            fontWeight: 700,
            color: COLORS.text,
            letterSpacing: -0.5,
          }}
        >
          "You're Set Up" — Online, for Real
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
              src={staticFile("install-e2e/05-gui-installed.png")}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "50% 5%",
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
            Real screenshot — package, budget, components, connection guides
          </div>
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 10,
            justifyContent: "center",
            minWidth: 0,
          }}
        >
          {[
            { label: "Role", value: V6.install.role },
            { label: "Budget", value: V6.install.budget },
          ].map((kv, i) => (
            <div
              key={kv.label}
              style={{
                opacity: interpolate(frame, [16 + i * 8, 30 + i * 8], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
                backgroundColor: COLORS.white,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 10,
                padding: "14px 18px",
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
              }}
            >
              <span style={{ fontSize: 13, color: COLORS.textMuted }}>
                {kv.label}
              </span>
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: COLORS.navy,
                  fontFamily: FONT_MONO,
                }}
              >
                {kv.value}
              </span>
            </div>
          ))}
          <div
            style={{
              opacity: interpolate(frame, [36, 50], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              backgroundColor: COLORS.navyDark,
              borderRadius: 10,
              padding: "14px 18px",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: COLORS.white,
                marginBottom: 8,
              }}
            >
              {V6.install.components.length} real components
            </div>
            <div
              style={{
                fontSize: 10.5,
                color: COLORS.textDarkMuted,
                fontFamily: FONT_MONO,
                lineHeight: 1.8,
              }}
            >
              {V6.install.components.join(" · ")}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
