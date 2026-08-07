import { interpolate, useCurrentFrame, Easing, Img, staticFile } from "remotion";
import { COLORS, FONT_SANS, FONT_MONO } from "../../theme";
import { V1 } from "../../data/video1-data";

export const SceneV1Dashboard: React.FC = () => {
  const frame = useCurrentFrame();

  const titleAppear = interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const titleY = interpolate(frame, [0, 15], [30, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });

  return (
    <div style={{
      width: "100%", height: "100%", backgroundColor: COLORS.bg,
      display: "flex", flexDirection: "column", alignItems: "center",
      fontFamily: FONT_SANS, padding: "24px 44px",
    }}>
      {/* Title */}
      <div style={{
        opacity: titleAppear, transform: `translateY(${titleY}px)`,
        textAlign: "center", marginBottom: 14,
      }}>
        <div style={{ fontSize: 14, color: COLORS.gold, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>
          Step 3 · Management Sees It on the Dashboard
        </div>
        <div style={{ fontSize: 30, fontWeight: 700, color: COLORS.text, letterSpacing: -0.5 }}>
          ClickHouse Truth — Tagged by Department
        </div>
      </div>

      <div style={{ display: "flex", gap: 18, width: "100%", flex: 1, minHeight: 0 }}>
        {/* Real dashboard panel — high-res close-up */}
        <div style={{ flex: 1.6, display: "flex", flexDirection: "column" }}>
          <div style={{
            opacity: interpolate(frame, [12, 26], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            backgroundColor: COLORS.white, borderRadius: 10, border: `1px solid ${COLORS.border}`,
            overflow: "hidden", boxShadow: "0 8px 30px rgba(0,0,0,0.12)", flex: 1,
          }}>
            <Img
              src={staticFile("shots/work-classification.png")}
              style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
            />
          </div>
          <div style={{
            opacity: interpolate(frame, [26, 38], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            marginTop: 8, textAlign: "center", fontSize: 12, color: COLORS.textMuted,
          }}>
            ARM dashboard · /spend — Work Classification panel (real screenshot)
          </div>
        </div>

        {/* ClickHouse truth table + DLP blocks */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
          <div style={{
            backgroundColor: COLORS.slate900, borderRadius: 10, overflow: "hidden",
            border: `1px solid ${COLORS.borderDark}`, flex: 1,
          }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 6, padding: "8px 14px",
              backgroundColor: COLORS.slate800, borderBottom: `1px solid ${COLORS.borderDark}`,
            }}>
              <span style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: COLORS.red }} />
              <span style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: COLORS.goldLight }} />
              <span style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: COLORS.greenDark }} />
              <span style={{ fontSize: 11, color: COLORS.textDarkMuted, marginLeft: 6, fontFamily: FONT_MONO }}>
                clickhouse-client · llm_events
              </span>
            </div>
            {/* Table header */}
            <div style={{
              display: "grid", gridTemplateColumns: "1.2fr 1fr 1.4fr 0.7fr 0.7fr",
              padding: "8px 14px", fontSize: 11, fontWeight: 700, color: COLORS.goldLight,
              fontFamily: FONT_MONO, borderBottom: `1px solid ${COLORS.borderDark}`,
            }}>
              <div>agent</div><div>dept</div><div>work_type</div><div>stage</div><div>conf</div>
            </div>
            {V1.classification.map((row, i) => {
              const appear = interpolate(frame, [14 + i * 7, 24 + i * 7], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              return (
                <div key={i} style={{
                  display: "grid", gridTemplateColumns: "1.2fr 1fr 1.4fr 0.7fr 0.7fr",
                  padding: "7px 14px", fontSize: 13, color: COLORS.textDark,
                  fontFamily: FONT_MONO, opacity: appear, alignItems: "center",
                  borderBottom: i < V1.classification.length - 1 ? `1px solid ${COLORS.slate800}` : "none",
                }}>
                  <div style={{ color: COLORS.white }}>{row.agent}</div>
                  <div style={{ color: row.color }}>{row.dept}</div>
                  <div style={{ color: COLORS.greenDark, fontWeight: 700 }}>{row.workType}</div>
                  <div style={{ color: COLORS.textDarkMuted }}>{row.stage}</div>
                  <div style={{ color: COLORS.textDarkMuted }}>{row.conf.toFixed(1)}</div>
                </div>
              );
            })}
          </div>

          {/* DLP blocks note */}
          <div style={{
            opacity: interpolate(frame, [48, 62], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            backgroundColor: "rgba(220,38,38,0.06)", border: `1px solid ${COLORS.red}33`,
            borderRadius: 10, padding: "12px 16px",
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.red, marginBottom: 6 }}>
              ⛔ Sensitive prompts blocked by DLP (real deny events)
            </div>
            {V1.dlpBlocks.map((block, i) => (
              <div key={i} style={{ fontSize: 12, fontFamily: FONT_MONO, color: COLORS.text, marginTop: 4 }}>
                {block.agent} — <span style={{ color: COLORS.red }}>{block.reason}</span>{" "}
                <span style={{ color: COLORS.textMuted }}>({block.severity})</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
