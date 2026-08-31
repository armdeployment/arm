import { AbsoluteFill, interpolate, useCurrentFrame, Easing } from "remotion";
import { COLORS, FONT_SANS, FONT_MONO } from "../theme";

export const SceneOutro: React.FC = () => {
  const frame = useCurrentFrame();

  const items = [
    {
      label: "Identity",
      desc: "Every agent has exactly one accountable human",
    },
    {
      label: "Metering",
      desc: "Every token metered to sub-account + department",
    },
    {
      label: "Budgeting",
      desc: "Department budgets enforced at proxy, not trust",
    },
    { label: "Policy", desc: "Deny-override: higher-level deny always wins" },
    { label: "Audit", desc: "ClickHouse ledger immutable and partitioned" },
    { label: "Security", desc: "Prompts never leave tenant VPC" },
  ];

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
      {/* Grid bg */}
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

      {/* Title */}
      <h2
        style={{
          margin: 0,
          fontSize: 40,
          fontWeight: 700,
          color: COLORS.white,
          letterSpacing: "-0.02em",
          opacity: interpolate(frame, [0, 20], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        ARM Platform Principles
      </h2>
      <p
        style={{
          fontSize: 14,
          color: COLORS.textDarkMuted,
          fontFamily: FONT_MONO,
          margin: "8px 0 32px 0",
          opacity: interpolate(frame, [8, 24], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        Agent Resource Management · Enterprise Simulation
      </p>

      {/* Principles grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          maxWidth: 700,
        }}
      >
        {items.map((item, i) => {
          const delay = 25 + i * 8;
          const o = interpolate(frame, [delay, delay + 10], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          });
          const x = interpolate(frame, [delay, delay + 10], [20, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          });
          return (
            <div
              key={item.label}
              style={{
                opacity: o,
                transform: `translateX(${x}px)`,
                background: `rgba(255,255,255,0.04)`,
                borderRadius: 10,
                padding: "14px 18px",
                borderLeft: `3px solid ${i < 3 ? COLORS.gold : COLORS.navy}`,
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: COLORS.goldLight,
                  fontFamily: FONT_MONO,
                  marginBottom: 4,
                }}
              >
                {item.label}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: COLORS.textDarkMuted,
                  lineHeight: 1.5,
                }}
              >
                {item.desc}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom */}
      <div
        style={{
          position: "absolute",
          bottom: 40,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
          opacity: interpolate(frame, [70, 110], [0, 1], {
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
          ARM v1.0 · arm-spec.md
        </span>
        <span
          style={{
            color: COLORS.textDarkMuted,
            fontSize: 11,
            fontFamily: FONT_MONO,
          }}
        >
          github.com/anomalyco/ARM
        </span>
      </div>
    </AbsoluteFill>
  );
};
