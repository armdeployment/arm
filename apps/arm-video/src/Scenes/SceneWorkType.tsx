import { interpolate, useCurrentFrame, Easing } from "remotion";
import { COLORS, FONT_SANS, FONT_MONO } from "../theme";
import { REAL } from "../real-data";

export const SceneWorkType: React.FC = () => {
  const frame = useCurrentFrame();

  const titleAppear = interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const titleY = interpolate(frame, [0, 15], [30, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });

  return (
    <div style={{
      width: "100%", height: "100%", backgroundColor: COLORS.bg,
      display: "flex", flexDirection: "column", alignItems: "center",
      fontFamily: FONT_SANS, padding: "36px 50px",
    }}>
      {/* Title */}
      <div style={{
        opacity: titleAppear, transform: `translateY(${titleY}px)`,
        textAlign: "center", marginBottom: 24,
      }}>
        <div style={{ fontSize: 13, color: COLORS.gold, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>
          D7 · Work-Type Classification
        </div>
        <div style={{ fontSize: 34, fontWeight: 700, color: COLORS.text, letterSpacing: -0.5 }}>
          Zero-LLM Cascade · Per-Prompt Tagging
        </div>
        <div style={{ fontSize: 14, color: COLORS.textMuted, marginTop: 6, maxWidth: 700, margin: "6px auto 0" }}>
          Every prompt classified in microseconds — no tokens spent on classification.
          <span style={{ color: COLORS.red, fontWeight: 600 }}> Unknown is first-class — never guessed.</span>
        </div>
      </div>

      {/* Two columns: cascade stages + real results */}
      <div style={{ display: "flex", gap: 24, width: "100%", maxWidth: 1100 }}>
        {/* Left: Cascade stages */}
        <CascadeStages frame={frame} />

        {/* Right: Real ClickHouse results */}
        <RealResults frame={frame} />
      </div>
    </div>
  );
};

function CascadeStages({ frame }: { frame: number }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, marginBottom: 4 }}>
        Classification Cascade
      </div>
      <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 8 }}>
        4 stages + async QA · worst case sub-ms on hot path
      </div>

      {REAL.classifierCascade.map((stage, i) => {
        const appear = interpolate(frame, [15 + i * 6, 25 + i * 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const x = interpolate(frame, [15 + i * 6, 25 + i * 6], [-30, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });
        const isQA = stage.stage === "QA";
        const accentColor = isQA ? COLORS.textMuted : stage.stage === "4" ? COLORS.amber : COLORS.navy;

        return (
          <div key={i} style={{
            opacity: appear, transform: `translateX(${x}px)`,
            display: "flex", alignItems: "center", gap: 10,
            padding: "8px 12px", borderRadius: 8,
            backgroundColor: isQA ? COLORS.bg : COLORS.white,
            border: `1px solid ${isQA ? COLORS.border : COLORS.border}`,
            borderLeft: `3px solid ${accentColor}`,
          }}>
            {/* Stage badge */}
            <div style={{
              width: 28, height: 28, borderRadius: 6,
              backgroundColor: accentColor, color: COLORS.white,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 700, fontFamily: FONT_MONO,
              flexShrink: 0,
            }}>
              {stage.stage}
            </div>

            {/* Stage info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{stage.name}</span>
                <span style={{
                  fontSize: 10, fontFamily: FONT_MONO, color: stage.cost === "$0" ? COLORS.green : COLORS.gold,
                  backgroundColor: stage.cost === "$0" ? "rgba(22,163,74,0.08)" : "rgba(180,83,9,0.08)",
                  padding: "1px 6px", borderRadius: 4,
                }}>
                  {stage.cost}
                </span>
              </div>
              <div style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 2 }}>{stage.mechanism}</div>
            </div>

            {/* Latency + coverage */}
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 11, fontFamily: FONT_MONO, color: COLORS.text, fontWeight: 600 }}>{stage.latency}</div>
              <div style={{ fontSize: 9, color: COLORS.textMuted }}>{stage.coverage}</div>
            </div>
          </div>
        );
      })}

      {/* Unknown-is-first-class note */}
      <div style={{
        opacity: interpolate(frame, [50, 65], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        marginTop: 6, padding: "8px 12px", borderRadius: 8,
        backgroundColor: "rgba(220,38,38,0.05)", border: `1px solid ${COLORS.red}33`,
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <span style={{ fontSize: 14, color: COLORS.red }}>⚠</span>
        <span style={{ fontSize: 11, color: COLORS.text }}>
          <strong style={{ color: COLORS.red }}>unknown</strong> is stored as-is, never coerced — fail-closed per policy at gate time
        </span>
      </div>
    </div>
  );
}

function RealResults({ frame }: { frame: number }) {
  const events = REAL.workTypeEvents;

  return (
    <div style={{ flex: 1.1, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, marginBottom: 4 }}>
        Live Results <span style={{ fontSize: 11, fontWeight: 400, color: COLORS.textMuted }}>(real ClickHouse query)</span>
      </div>
      <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 8 }}>
        7 real Ollama LLM calls through ARM proxy · classified by cascade
      </div>

      {/* Column headers */}
      <div style={{
        display: "grid", gridTemplateColumns: "1.4fr 1.2fr 0.7fr 0.5fr",
        gap: 6, padding: "0 8px", fontSize: 9, color: COLORS.textMuted,
        fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5,
      }}>
        <span>Department</span>
        <span>Work Type</span>
        <span>Stage</span>
        <span style={{ textAlign: "right" }}>Conf</span>
      </div>

      {/* Event rows */}
      {events.map((evt, i) => {
        const appear = interpolate(frame, [20 + i * 5, 30 + i * 5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const isUnknown = evt.workType === "unknown";
        const stageColor = evt.stage === "linear" ? COLORS.green : isUnknown ? COLORS.red : COLORS.navy;

        return (
          <div key={i} style={{
            opacity: appear,
            display: "grid", gridTemplateColumns: "1.4fr 1.2fr 0.7fr 0.5fr",
            gap: 6, padding: "6px 8px", borderRadius: 6,
            backgroundColor: COLORS.white, border: `1px solid ${COLORS.border}`,
            alignItems: "center",
          }}>
            {/* Department */}
            <span style={{ fontSize: 11, color: COLORS.text, fontWeight: 500 }}>{evt.dept}</span>

            {/* Work type */}
            <span style={{
              fontSize: 11, fontFamily: FONT_MONO,
              color: isUnknown ? COLORS.red : COLORS.navy,
              fontWeight: isUnknown ? 700 : 600,
            }}>
              {evt.workType}
            </span>

            {/* Stage */}
            <span style={{
              fontSize: 10, fontFamily: FONT_MONO,
              color: stageColor, fontWeight: 600,
            }}>
              {evt.stage}
            </span>

            {/* Confidence */}
            <span style={{
              fontSize: 11, fontFamily: FONT_MONO, textAlign: "right",
              color: isUnknown ? COLORS.textMuted : COLORS.green, fontWeight: 600,
            }}>
              {evt.conf !== null ? evt.conf.toFixed(1) : "—"}
            </span>
          </div>
        );
      })}

      {/* Real prompt preview */}
      <div style={{
        opacity: interpolate(frame, [60, 75], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        marginTop: 4, padding: 10, borderRadius: 8,
        backgroundColor: COLORS.navyDeep, fontFamily: FONT_MONO,
      }}>
        <div style={{ fontSize: 10, color: COLORS.textDarkMuted, marginBottom: 4 }}>CLICKHOUSE QUERY</div>
        <div style={{ fontSize: 11, color: COLORS.textDark, lineHeight: 1.6 }}>
          <span style={{ color: COLORS.goldLight }}>SELECT</span> department, work_type, classifier_stage,{"\n"}
          {"        "}work_type_confidence <span style={{ color: COLORS.goldLight }}>FROM</span> arm.llm_events{"\n"}
          <span style={{ color: COLORS.goldLight }}>WHERE</span> status = <span style={{ color: COLORS.greenDark }}>'success'</span>
        </div>
      </div>
    </div>
  );
}
