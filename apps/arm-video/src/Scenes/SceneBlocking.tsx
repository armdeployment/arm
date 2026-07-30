import { AbsoluteFill, interpolate, useCurrentFrame, spring, useVideoConfig } from "remotion";
import { COLORS, FONT_SANS, FONT_MONO } from "../theme";
import { Monitor, Terminal } from "../components/Monitor";

export const SceneBlocking: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fadeIn = interpolate(frame, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Alert pulse
  const alertPulse = spring({ frame: Math.max(0, frame - 40), fps, config: { damping: 8, stiffness: 120 } });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bgDark, fontFamily: FONT_SANS, opacity: fadeIn, overflow: "hidden" }}>
      {/* Scene label */}
      <div style={{ position: "absolute", top: 24, left: 40, fontSize: 28, fontWeight: 700, color: COLORS.white }}>
        Policy Violation Detected
      </div>
      <div style={{ position: "absolute", top: 60, left: 40, fontSize: 14, color: COLORS.textDarkMuted, fontFamily: FONT_MONO }}>
        DLP ENGINE — REAL-TIME BLOCKING
      </div>

      {/* Left: the offending workstation */}
      <div style={{ position: "absolute", left: 80, top: 110 }}>
        <Monitor name="Offending User" title="💻 Jenny Park (QA)" subtitle="Claude Code" width={820} height={620} bezel="#1E293B" screenBg="#0F172A">
          <Terminal lines={[
            { text: "task: review_customer_data_export.csv", dir: "in" },
            { text: " → Processing 2,341 records...", dir: "ok" },
            { text: " → Extracting customer PII fields", dir: "in" },
            { text: " → Email: j.smith@acme.com", dir: "out" },
            { text: " → SSN: ***-**-3921", dir: "block" },
            { text: "", dir: "ok" },
            { text: "⚠️  DLP VIOLATION: PII DETECTED", dir: "block" },
            { text: " → Policy: no_pii_in_prompt #7.3", dir: "block" },
            { text: " → Action: BLOCKED + AUDIT", dir: "block" },
          ]} />
        </Monitor>
      </div>

      {/* Right: DLP server */}
      <div style={{ position: "absolute", right: 80, top: 110 }}>
        <Monitor name="DLP Server" title="🔒 DLP ENGINE" subtitle="dlp-01.prod" width={820} height={620} bezel="#172554" screenBg="#0F172A" glow={frame > 40 ? "rgba(220,38,38,0.3)" : undefined}>
          <Terminal lines={[
            { text: "SCAN: prompt_QA_20260729_001", dir: "in" },
            { text: " Pattern: email regex ✓", dir: "ok" },
            { text: " Pattern: ssn regex ✓", dir: "ok" },
            { text: " Pattern: credit_card ✗", dir: "ok" },
            { text: " Score: 94% (THRESHOLD: 80%)", dir: "block" },
            { text: "", dir: "ok" },
            { text: "═══ POLICY ACTION ═══", dir: "block" },
            { text: " BLOCK: prompt not sent", dir: "block" },
            { text: " AUDIT: event #A-20260729-014", dir: "block" },
            { text: " ALERT: stakeholder email sent", dir: "block" },
          ]} />
        </Monitor>
      </div>

      {/* Alert banner */}
      <div style={{
        position: "absolute", bottom: 60, left: "50%", transform: "translateX(-50%)",
        opacity: interpolate(frame, [50, 58], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        display: "flex", alignItems: "center", gap: 12,
        background: "rgba(220,38,38,0.15)", border: `1px solid ${COLORS.red}`, borderRadius: 10,
        padding: "14px 28px",
        scale: String(1 + (alertPulse - 1) * 0.05),
      }}>
        <div style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.red, animation: "pulse 1s infinite" }} />
        <span style={{ color: COLORS.redDark, fontSize: 16, fontWeight: 700, fontFamily: FONT_MONO }}>
          INCIDENT #A-20260729-014 — PII LEAK BLOCKED
        </span>
        <span style={{ color: COLORS.textDarkMuted, fontSize: 13, fontFamily: FONT_MONO }}>
          · Escalated: Sarah Chen (stakeholder)
        </span>
      </div>
    </AbsoluteFill>
  );
};
