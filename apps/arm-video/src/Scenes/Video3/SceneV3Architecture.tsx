import { interpolate, useCurrentFrame, Easing } from "remotion";
import { COLORS, FONT_SANS, FONT_MONO } from "../../theme";

const STEPS = [
  "Browser",
  "tRPC hooks",
  "/api/trpc",
  "tenant middleware",
  "isFixtureMode()",
];

const FixtureColumn: React.FC<{
  real: boolean;
  frame: number;
  baseDelay: number;
}> = ({ real, frame, baseDelay }) => {
  const headerAppear = interpolate(frame, [baseDelay, baseDelay + 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        flex: 1,
        opacity: headerAppear,
        backgroundColor: real ? "rgba(180,83,9,0.08)" : "rgba(30,58,138,0.06)",
        border: `1.5px solid ${real ? COLORS.gold : COLORS.navy}`,
        borderRadius: 12,
        padding: "18px 22px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        style={{
          fontFamily: FONT_MONO,
          fontSize: 15,
          fontWeight: 700,
          color: real ? COLORS.gold : COLORS.navy,
        }}
      >
        ARM_FIXTURE_MODE={real ? "0" : "1"}
      </div>
      <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 4 }}>
        {real ? "Real mode — this Wave" : "Default — no DB required"}
      </div>
      {STEPS.map((step, i) => {
        const appear = interpolate(
          frame,
          [baseDelay + 10 + i * 6, baseDelay + 20 + i * 6],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );
        return (
          <div
            key={step}
            style={{
              opacity: appear,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: COLORS.textMuted,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 13,
                fontFamily: FONT_MONO,
                color: COLORS.text,
              }}
            >
              {step}
            </span>
          </div>
        );
      })}
      <div
        style={{
          opacity: interpolate(
            frame,
            [baseDelay + 46, baseDelay + 58],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          ),
          marginTop: 4,
          padding: "10px 14px",
          borderRadius: 8,
          backgroundColor: real ? COLORS.gold : COLORS.navy,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: COLORS.white,
            fontFamily: FONT_MONO,
          }}
        >
          {real ? "Postgres + ClickHouse" : "in-memory fixtures"}
        </div>
      </div>
      <div
        style={{
          opacity: interpolate(
            frame,
            [baseDelay + 58, baseDelay + 70],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          ),
          fontSize: 11.5,
          color: COLORS.textMuted,
          textAlign: "center",
          lineHeight: 1.5,
        }}
      >
        same UI · same tRPC contract
      </div>
    </div>
  );
};

export const SceneV3Architecture: React.FC = () => {
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
          marginBottom: 22,
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
          One Router, Two Code Paths
        </div>
        <div
          style={{
            fontSize: 30,
            fontWeight: 700,
            color: COLORS.text,
            letterSpacing: -0.5,
          }}
        >
          A Single Env Var Decides What's Underneath
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 24,
          width: "100%",
          flex: 1,
          alignItems: "flex-start",
        }}
      >
        <FixtureColumn real={false} frame={frame} baseDelay={10} />
        <FixtureColumn real frame={frame} baseDelay={20} />
      </div>

      <div
        style={{
          opacity: interpolate(frame, [95, 108], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          marginTop: 20,
          fontSize: 12,
          color: COLORS.textMuted,
          fontFamily: FONT_MONO,
          textAlign: "center",
          maxWidth: 900,
        }}
      >
        isFixtureMode() gates every data-bearing procedure — the branch point is
        inside the router, not in the component that calls it. Nothing
        downstream knows which mode it's in.
      </div>
    </div>
  );
};
