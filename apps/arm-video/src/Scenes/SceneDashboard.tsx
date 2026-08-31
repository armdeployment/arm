import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  Easing,
  CanvasImage,
  staticFile,
} from "remotion";
import { COLORS, FONT_SANS, FONT_MONO } from "../theme";
import { REAL } from "../real-data";
import { Monitor } from "../components/Monitor";

export const SceneDashboard: React.FC = () => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.bgDark,
        fontFamily: FONT_SANS,
        opacity: fadeIn,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 24,
          left: 40,
          fontSize: 28,
          fontWeight: 700,
          color: COLORS.white,
        }}
      >
        ARM Management Dashboard
      </div>
      <div
        style={{
          position: "absolute",
          top: 60,
          left: 40,
          fontSize: 14,
          color: COLORS.textDarkMuted,
          fontFamily: FONT_MONO,
        }}
      >
        REAL SCREENSHOTS — localhost:3100 (ARM control-plane web)
      </div>

      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          display: "flex",
          gap: 32,
          alignItems: "center",
        }}
      >
        {/* Real dashboard overview screenshot */}
        <div
          style={{
            opacity: interpolate(frame, [5, 15], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
            translate: `0px ${interpolate(frame, [5, 15], [30, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) })}px`,
          }}
        >
          <Monitor
            name="Dashboard Overview"
            title="📊 ARM Dashboard — Overview"
            subtitle="localhost:3100/"
            width={860}
            height={560}
            bezel="#1E293B"
            screenBg="#F8FAFC"
            rounded={10}
          >
            <CanvasImage
              src={staticFile("real-data/dashboard-overview.png")}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "top left",
              }}
            />
          </Monitor>
        </div>

        {/* Real dashboard spend screenshot */}
        <div
          style={{
            opacity: interpolate(frame, [15, 25], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
            translate: `0px ${interpolate(frame, [15, 25], [30, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) })}px`,
          }}
        >
          <Monitor
            name="Dashboard Spend"
            title="💰 ARM Dashboard — Spend"
            subtitle="localhost:3100/spend"
            width={860}
            height={560}
            bezel="#1E293B"
            screenBg="#F8FAFC"
            rounded={10}
          >
            <CanvasImage
              src={staticFile("real-data/dashboard-spend.png")}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "top left",
              }}
            />
          </Monitor>
        </div>
      </div>

      {/* Real data summary bar */}
      <div
        style={{
          position: "absolute",
          bottom: 40,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: 40,
          alignItems: "center",
          opacity: interpolate(frame, [40, 55], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        {[
          {
            label: "Total Calls",
            value: REAL.totals.totalCalls,
            color: COLORS.white,
          },
          {
            label: "Successful",
            value: REAL.totals.successful,
            color: COLORS.green,
          },
          {
            label: "Denied (DLP)",
            value: REAL.totals.denied,
            color: COLORS.red,
          },
          {
            label: "Total Tokens",
            value: REAL.totals.totalTokens.toLocaleString(),
            color: COLORS.cyan,
          },
          {
            label: "Cloud Cost",
            value: `$${(REAL.totals.cloudCostCents / 100).toFixed(2)}`,
            color: COLORS.goldLight,
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span
              style={{
                fontSize: 28,
                fontWeight: 800,
                color: kpi.color,
                fontFamily: FONT_MONO,
              }}
            >
              {kpi.value}
            </span>
            <span
              style={{
                fontSize: 11,
                color: COLORS.textDarkMuted,
                fontFamily: FONT_MONO,
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              {kpi.label}
            </span>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
