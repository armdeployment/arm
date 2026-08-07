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
      fontFamily: FONT_SANS, padding: "30px 50px",
    }}>
      {/* Title */}
      <div style={{
        opacity: titleAppear, transform: `translateY(${titleY}px)`,
        textAlign: "center", marginBottom: 18,
      }}>
        <div style={{ fontSize: 12, color: COLORS.gold, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>
          Step 3 · Management Sees It on the Dashboard
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, color: COLORS.text, letterSpacing: -0.5 }}>
          ClickHouse Truth — Tagged by Department
        </div>
      </div>

      <div style={{ display: "flex", gap: 20, width: "100%", maxWidth: 1200 }}>
        {/* ClickHouse truth table */}
        <div style={{ flex: 1.2 }}>
          <div style={{
            backgroundColor: COLORS.slate900, borderRadius: 8, overflow: "hidden",
            border: `1px solid ${COLORS.borderDark}`,
          }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 6, padding: "6px 12px",
              backgroundColor: COLORS.slate800, borderBottom: `1px solid ${COLORS.borderDark}`,
            }}>
              <span style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.red }} />
              <span style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.goldLight }} />
              <span style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.greenDark }} />
              <span style={{ fontSize: 9, color: COLORS.textDarkMuted, marginLeft: 6, fontFamily: FONT_MONO }}>
                clickhouse-client · llm_events
              </span>
            </div>
            {/* Table header */}
            <div style={{
              display: "grid", gridTemplateColumns: "1.2fr 1fr 1.4fr 0.7fr 0.7fr",
              padding: "6px 12px", fontSize: 9, fontWeight: 700, color: COLORS.goldLight,
              fontFamily: FONT_MONO, borderBottom: `1px solid ${COLORS.borderDark}`,
            }}>
              <div>agent</div><div>dept</div><div>work_type</div><div>stage</div><div>conf</div>
            </div>
            {V1.classification.map((row, i) => {
              const appear = interpolate(frame, [14 + i * 7, 24 + i * 7], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              return (
                <div key={i} style={{
                  display: "grid", gridTemplateColumns: "1.2fr 1fr 1.4fr 0.7fr 0.7fr",
                  padding: "5px 12px", fontSize: 10, color: COLORS.textDark,
                  fontFamily: FONT_MONO, opacity: appear,
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
            opacity: interpolate(frame, [60, 74], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            marginTop: 12, backgroundColor: "rgba(220,38,38,0.06)", border: `1px solid ${COLORS.red}33`,
            borderRadius: 8, padding: "10px 14px",
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.red, marginBottom: 4 }}>
              ⛔ Sensitive prompts blocked by DLP (real deny events)
            </div>
            {V1.dlpBlocks.map((block, i) => (
              <div key={i} style={{ fontSize: 10, fontFamily: FONT_MONO, color: COLORS.text, marginTop: 2 }}>
                {block.agent} — <span style={{ color: COLORS.red }}>{block.reason}</span> <span style={{ color: COLORS.textMuted }}>({block.severity})</span>
              </div>
            ))}
          </div>
        </div>

        {/* Real dashboard screenshot */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{
            opacity: interpolate(frame, [40, 55], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            backgroundColor: COLORS.white, borderRadius: 8, border: `1px solid ${COLORS.border}`,
            overflow: "hidden", boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
          }}>
            <Img
              src={staticFile("shots/spend.png")}
              style={{ width: "100%", display: "block" }}
            />
          </div>
          <div style={{
            opacity: interpolate(frame, [55, 68], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            marginTop: 10, textAlign: "center", fontSize: 10, color: COLORS.textMuted,
          }}>
            ARM dashboard · /spend — Work Classification panel (real screenshot)
          </div>
        </div>
      </div>
    </div>
  );
};
