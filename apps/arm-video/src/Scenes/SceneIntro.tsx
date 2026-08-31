import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  Easing,
  spring,
  useVideoConfig,
} from "remotion";
import { COLORS, FONT_SANS, FONT_MONO } from "../theme";

export const SceneIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleSpring = spring({
    frame,
    fps,
    config: { damping: 12, mass: 0.8, stiffness: 100 },
  });
  const subtitleO = interpolate(frame, [20, 35], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.navyDeep,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT_SANS,
        overflow: "hidden",
      }}
    >
      {/* Grid background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      />
      {/* Accent line */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: `linear-gradient(90deg, ${COLORS.gold}, ${COLORS.navy}, ${COLORS.gold})`,
        }}
      />
      {/* Logo mark */}
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: 20,
          background: `linear-gradient(135deg, ${COLORS.navy}, ${COLORS.navyDark})`,
          border: `2px solid ${COLORS.gold}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 24,
          transform: `scale(${titleSpring})`,
        }}
      >
        <span
          style={{
            color: COLORS.gold,
            fontSize: 36,
            fontWeight: 800,
            fontFamily: FONT_MONO,
          }}
        >
          ARM
        </span>
      </div>
      {/* Title */}
      <h1
        style={{
          margin: 0,
          fontSize: 64,
          fontWeight: 700,
          color: COLORS.white,
          letterSpacing: "-0.02em",
          transform: `scale(${titleSpring})`,
        }}
      >
        Agent Resource Management
      </h1>
      {/* Subtitle */}
      <div
        style={{
          opacity: subtitleO,
          marginTop: 20,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
        }}
      >
        <p
          style={{
            fontSize: 20,
            color: COLORS.textDarkMuted,
            margin: 0,
            fontFamily: FONT_MONO,
          }}
        >
          Enterprise AI Governance Platform
        </p>
        <p
          style={{
            fontSize: 14,
            color: COLORS.goldLight,
            margin: 0,
            fontFamily: FONT_MONO,
            marginTop: 4,
          }}
        >
          IDENTITY · METERING · ROUTING · BUDGETING · POLICY · ACCESS
        </p>
      </div>
      {/* Bottom bar */}
      <div
        style={{
          position: "absolute",
          bottom: 40,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: interpolate(frame, [60, 90], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <span
          style={{
            color: COLORS.textDarkMuted,
            fontSize: 13,
            fontFamily: FONT_MONO,
          }}
        >
          ENTERPRISE SIMULATION · v1.0
        </span>
      </div>
    </AbsoluteFill>
  );
};
