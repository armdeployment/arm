import {
  interpolate,
  useCurrentFrame,
  Easing,
  Img,
  staticFile,
} from "remotion";
import { COLORS, FONT_SANS } from "../../theme";

export const SceneV6Questionnaire: React.FC = () => {
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
          Step 1 · apps/onboarding — /start
        </div>
        <div
          style={{
            fontSize: 30,
            fontWeight: 700,
            color: COLORS.text,
            letterSpacing: -0.5,
          }}
        >
          Six Questions, All Deterministic
        </div>
      </div>

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
          width: "100%",
        }}
      >
        <Img
          src={staticFile("install-e2e/01-role-cluster.png")}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "50% 15%",
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
          fontSize: 12,
          color: COLORS.textMuted,
        }}
      >
        Real screenshot — answering as "leading a plant or department"
      </div>
    </div>
  );
};
