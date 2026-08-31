import { interpolate, useCurrentFrame, Easing } from "remotion";
import { COLORS, FONT_SANS, FONT_MONO } from "../../theme";
import { V1 } from "../../data/video1-data";

// Real terminal output from the running enterprise sim (docker logs, ANSI stripped)
const TERMINAL_LINES: Record<string, string[]> = {
  "Sarah Chen": [
    "🔑 Sub-account authenticated: arm_sk_coderevie...",
    "🛡️ DLP scanner active · Classification gate active",
    "🚀 Claude Code agent is now active",
    "⬆️ [Engineering] Sending prompt to minicpm5-1b",
    '   "Review this pull request diff for memory leaks..."',
    "✅ 108 tokens in 5113ms · cloud $0.0100 · saved $0.0100",
    "⬆️ [Engineering] Sending prompt to minicpm5-1b",
    '   "Code review: check this SQL query for injection..."',
    "✅ 96 tokens in 1282ms · cloud $0.0100 · saved $0.0100",
  ],
  "Mike Rodriguez": [
    "🔑 Sub-account authenticated: arm_sk_docgen_ag...",
    "🚀 OpenCode agent is now active",
    "⬆️ [Engineering] Sending prompt to minicpm5-1b",
    '   "Write API docs and README section for..."',
    "✅ 108 tokens in 119500ms · cloud $0.0100",
    "⬆️ [Engineering] Sending prompt to minicpm5-1b",
    '   "Generate release notes for v2.0: budget..."',
    "✅ 102 tokens in 28928ms · cloud $0.0100",
  ],
  "Carlos Mendes": [
    "🔑 Sub-account authenticated: arm_sk_toolpath...",
    "🚀 OpenCode agent is now active",
    "⬆️ [Production] Sending prompt to qwen3.5",
    '   "Review this CNC toolpath optimization strategy..."',
    "✅ 87 tokens in 3021ms · cloud $0.0100",
    "⬆️ [Production] Sending prompt to qwen3.5",
    '   "Calculate feed rate for 6mm carbide endmill..."',
    "❌ DLP gate blocked: CAM / Tooling Parameters",
  ],
  "Jenny Park": [
    "🔑 Sub-account authenticated: arm_sk_security...",
    "🚀 Claude Code agent is now active",
    "⬆️ [Quality Control] Sending prompt to qwen3.5",
    '   "Vulnerability scan of our OAuth token service..."',
    "✅ 96 tokens in 4150ms · cloud $0.0100",
    "⬆️ [Quality Control] Sending prompt to qwen3.5",
    '   "Scan for OWASP Top 10: SELECT * FROM users..."',
    "❌ DLP gate blocked: API Key (sk-ant-)",
  ],
  "David Kim": [
    "🔑 Sub-account authenticated: arm_sk_demandfor...",
    "🚀 GitHub Copilot agent is now active",
    "⬆️ [Supply Chain] Sending prompt to minicpm5-1b",
    '   "Forecast Q3 demand and inventory planning..."',
    "✅ 104 tokens in 4120ms · cloud $0.0100",
    "⬆️ [Supply Chain] Sending prompt to minicpm5-1b",
    '   "Calculate safety stock: 500 units/week..."',
    "✅ 98 tokens in 3310ms · cloud $0.0100",
  ],
};

export const SceneV1Terminals: React.FC = () => {
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
        padding: "30px 44px",
      }}
    >
      {/* Title */}
      <div
        style={{
          opacity: titleAppear,
          transform: `translateY(${titleY}px)`,
          textAlign: "center",
          marginBottom: 18,
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: COLORS.gold,
            fontWeight: 600,
            letterSpacing: 2,
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          Step 1 · Employees at Work
        </div>
        <div
          style={{
            fontSize: 30,
            fontWeight: 700,
            color: COLORS.text,
            letterSpacing: -0.5,
          }}
        >
          Real Coding Agents on the Factory Floor
        </div>
      </div>

      {/* Terminal grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 12,
          width: "100%",
        }}
      >
        {V1.employees.map((emp, i) => {
          const appear = interpolate(frame, [8 + i * 7, 20 + i * 7], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const y = interpolate(frame, [8 + i * 7, 20 + i * 7], [30, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          });
          const lines = TERMINAL_LINES[emp.name] ?? [];

          return (
            <div
              key={i}
              style={{
                opacity: appear,
                transform: `translateY(${y}px)`,
                backgroundColor: COLORS.slate900,
                borderRadius: 8,
                overflow: "hidden",
                border: `1px solid ${emp.color}44`,
              }}
            >
              {/* Terminal header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 10px",
                  backgroundColor: COLORS.slate800,
                  borderBottom: `1px solid ${COLORS.borderDark}`,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: COLORS.red,
                  }}
                />
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: COLORS.goldLight,
                  }}
                />
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: COLORS.greenDark,
                  }}
                />
                <span
                  style={{
                    fontSize: 11,
                    color: COLORS.textDarkMuted,
                    marginLeft: 6,
                    fontFamily: FONT_MONO,
                  }}
                >
                  {emp.name.split(" ")[0].toLowerCase()}@arm-ws — {emp.agent}
                </span>
              </div>
              {/* Terminal body — typewriter effect */}
              <div
                style={{
                  padding: "10px 12px",
                  fontFamily: FONT_MONO,
                  fontSize: 11.5,
                  lineHeight: 1.75,
                  minHeight: 200,
                }}
              >
                {lines.map((line, li) => {
                  const lineStart = 12 + i * 4 + li * 6;
                  const shown = interpolate(
                    frame,
                    [lineStart, lineStart + 4],
                    [0, 1],
                    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
                  );
                  const isBlock = line.includes("DLP gate blocked");
                  const isSend =
                    line.includes("⬆️") ||
                    line.includes("🔑") ||
                    line.includes("🚀");
                  return (
                    <div
                      key={li}
                      style={{
                        opacity: shown,
                        color: isBlock
                          ? COLORS.redDark
                          : isSend
                            ? emp.color
                            : COLORS.textDarkMuted,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {line}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom note */}
      <div
        style={{
          opacity: interpolate(frame, [70, 85], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          marginTop: 12,
          fontSize: 10.5,
          color: COLORS.textMuted,
        }}
      >
        Real Docker container output · employees on the armtest-internal network
        · Ollama upstream
      </div>
    </div>
  );
};
