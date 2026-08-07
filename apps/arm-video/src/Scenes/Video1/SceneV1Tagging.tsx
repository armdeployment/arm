import { interpolate, useCurrentFrame, Easing } from "remotion";
import { COLORS, FONT_SANS, FONT_MONO } from "../../theme";
import { V1 } from "../../data/video1-data";

export const SceneV1Tagging: React.FC = () => {
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
          Step 2 · The Proxy Tags Every Prompt
        </div>
        <div style={{ fontSize: 30, fontWeight: 700, color: COLORS.text, letterSpacing: -0.5 }}>
          Zero-LLM Cascade — Live Classification
        </div>
      </div>

      {/* Flow: Prompt → Cascade → Tag */}
      <div style={{ display: "flex", gap: 14, alignItems: "center", width: "100%", maxWidth: 1300, marginBottom: 14 }}>
        <div style={{
          opacity: interpolate(frame, [12, 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          backgroundColor: COLORS.white, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "12px 18px",
          fontSize: 13, color: COLORS.text, flex: 1,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4, color: COLORS.navy }}>Incoming prompt</div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: COLORS.textMuted }}>
            "Review this pull request diff for memory leaks…"
          </div>
        </div>
        <div style={{ fontSize: 24, color: COLORS.textMuted, opacity: interpolate(frame, [22, 28], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>→</div>
        <div style={{
          opacity: interpolate(frame, [28, 38], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          backgroundColor: COLORS.navy, borderRadius: 8, padding: "12px 18px", flex: 1,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4, color: COLORS.white, fontSize: 13 }}>D7 Cascade (0 tokens)</div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: COLORS.textDarkMuted }}>
            structural → cache → linear → embedding
          </div>
        </div>
        <div style={{ fontSize: 24, color: COLORS.textMuted, opacity: interpolate(frame, [38, 44], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>→</div>
        <div style={{
          opacity: interpolate(frame, [44, 54], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          backgroundColor: COLORS.green, borderRadius: 8, padding: "12px 18px", flex: 1,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4, color: COLORS.white, fontSize: 13 }}>Tagged</div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: COLORS.white }}>
            work_type: code_review
          </div>
        </div>
      </div>

      {/* Live proxy classification log */}
        <div style={{ width: "100%", maxWidth: 1300, backgroundColor: COLORS.slate900, borderRadius: 8, overflow: "hidden",
        border: `1px solid ${COLORS.borderDark}`,
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 6, padding: "8px 14px",
          backgroundColor: COLORS.slate800, borderBottom: `1px solid ${COLORS.borderDark}`,
        }}>
          <span style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: COLORS.red }} />
          <span style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: COLORS.goldLight }} />
          <span style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: COLORS.greenDark }} />
          <span style={{ fontSize: 11, color: COLORS.textDarkMuted, marginLeft: 6, fontFamily: FONT_MONO }}>
            arm-server · docker logs — classification
          </span>
        </div>
        <div style={{ padding: "12px 16px", fontFamily: FONT_MONO, fontSize: 14, lineHeight: 2.1 }}>
          {V1.proxyClassificationLog.map((line, i) => {
            const lineStart = 30 + i * 10;
            const shown = interpolate(frame, [lineStart, lineStart + 5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            const deptMatch = line.match(/\[(.*?)\]/);
            const emp = V1.employees.find((e) => e.dept === deptMatch?.[1]) ?? V1.employees[0]!;
            return (
              <div key={i} style={{ opacity: shown, color: COLORS.textDark, whiteSpace: "nowrap" }}>
                <span style={{ color: emp.color }}>{line}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cascade stages strip */}
      <div style={{ display: "flex", gap: 10, width: "100%", maxWidth: 1300, marginTop: 14 }}>
        {V1.cascade.map((stage, i) => {
          const appear = interpolate(frame, [55 + i * 6, 65 + i * 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div key={i} style={{
              opacity: appear, flex: 1, backgroundColor: COLORS.white, border: `1px solid ${COLORS.border}`,
              borderRadius: 8, padding: "12px 14px",
            }}>
              <div style={{ fontSize: 12, color: COLORS.gold, fontWeight: 700, fontFamily: FONT_MONO }}>Stage {stage.stage}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.text }}>{stage.name}</div>
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 3 }}>{stage.mechanism}</div>
              <div style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: FONT_MONO, marginTop: 2 }}>{stage.latency} · {stage.coverage}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
