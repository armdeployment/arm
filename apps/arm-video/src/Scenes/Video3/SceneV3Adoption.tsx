import { interpolate, useCurrentFrame, Easing, Img, staticFile } from "remotion";
import { COLORS, FONT_SANS, FONT_MONO } from "../../theme";
import { V3 } from "../../data/video3-data";

export const SceneV3Adoption: React.FC = () => {
  const frame = useCurrentFrame();

  const titleAppear = interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const titleY = interpolate(frame, [0, 15], [30, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });

  const kpis = [
    { label: "Weekly Active", value: V3.adoption.weeklyActive, color: COLORS.green },
    { label: "Activated Seats", value: V3.adoption.activatedSeats, color: COLORS.navy },
    { label: "Eligible Seats", value: V3.adoption.eligibleSeats, color: COLORS.cyan },
  ];

  return (
    <div style={{
      width: "100%", height: "100%", backgroundColor: COLORS.bg,
      display: "flex", flexDirection: "column", alignItems: "center",
      fontFamily: FONT_SANS, padding: "24px 44px",
    }}>
      <div style={{ opacity: titleAppear, transform: `translateY(${titleY}px)`, textAlign: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 14, color: COLORS.cyan, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>
          adoption-router.ts · Real ClickHouse
        </div>
        <div style={{ fontSize: 30, fontWeight: 700, color: COLORS.text, letterSpacing: -0.5 }}>
          The Activation Funnel, Queried Live
        </div>
      </div>

      <div style={{ display: "flex", gap: 18, width: "100%", flex: 1, minHeight: 0 }}>
        <div style={{ flex: 1.6, display: "flex", flexDirection: "column" }}>
          <div style={{
            opacity: interpolate(frame, [12, 26], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            backgroundColor: COLORS.white, borderRadius: 10, border: `1px solid ${COLORS.border}`,
            overflow: "hidden", boxShadow: "0 8px 30px rgba(0,0,0,0.10)", flex: 1,
          }}>
            <Img
              src={staticFile("wave3-data/adoption.png")}
              style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top left", display: "block" }}
            />
          </div>
          <div style={{
            opacity: interpolate(frame, [26, 38], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            marginTop: 8, textAlign: "center", fontSize: 12, color: COLORS.textMuted,
          }}>
            ARM dashboard · /adoption — ARM_FIXTURE_MODE=0 (real screenshot, real numbers)
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, justifyContent: "center", minWidth: 0 }}>
          {kpis.map((kpi, i) => {
            const appear = interpolate(frame, [16 + i * 8, 30 + i * 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            return (
              <div key={kpi.label} style={{
                opacity: appear, transform: `translateX(${(1 - appear) * 30}px)`,
                backgroundColor: COLORS.white, border: `1px solid ${COLORS.border}`,
                borderRadius: 10, padding: "14px 18px", display: "flex", alignItems: "baseline", justifyContent: "space-between",
              }}>
                <span style={{ fontSize: 13, color: COLORS.textMuted }}>{kpi.label}</span>
                <span style={{ fontSize: 26, fontWeight: 800, color: kpi.color, fontFamily: FONT_MONO }}>{kpi.value}</span>
              </div>
            );
          })}

          <div style={{
            opacity: interpolate(frame, [48, 62], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            backgroundColor: "rgba(220,38,38,0.06)", border: `1px solid ${COLORS.red}33`,
            borderRadius: 10, padding: "12px 16px",
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.red, marginBottom: 4 }}>
              ⚠ Where adoption stalls (real query, not hardcoded)
            </div>
            <div style={{ fontSize: 12, fontFamily: FONT_MONO, color: COLORS.text }}>
              {V3.adoption.topStall.cause} — <span style={{ color: COLORS.red, fontWeight: 700 }}>{V3.adoption.topStall.count}</span> cases
            </div>
          </div>

          <div style={{
            opacity: interpolate(frame, [66, 80], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            fontSize: 11.5, color: COLORS.textMuted, lineHeight: 1.5,
          }}>
            Every number above comes from buildCoverageSQL / buildActivatedSeatsSQL /
            buildWeeklyActiveTrendSQL running against real activation_event rows —
            not the ClickHouse mock this router shipped with.
          </div>
        </div>
      </div>
    </div>
  );
};
