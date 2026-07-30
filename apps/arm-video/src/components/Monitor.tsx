import { Interactive, interpolate, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import { COLORS, FONT_SANS, FONT_MONO } from "../theme";

// A bezel-framed monitor to simulate physical screens (server, employee computers, dashboard)
export const Monitor: React.FC<{
  children: React.ReactNode;
  name?: string;
  title?: string;
  subtitle?: string;
  bezel?: string;
  screenBg?: string;
  width?: number;
  height?: number;
  rounded?: number;
  glow?: string;
}> = ({ children, name, title, subtitle, bezel = "#1E293B", screenBg = COLORS.bg, width = 880, height = 520, rounded = 12, glow }) => {
  const frame = useCurrentFrame();

  const appear = interpolate(frame, [-20, 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });

  return (
    <Interactive.Div name={name} style={{
      opacity: appear,
      transform: `translateY(${interpolate(frame, [-20, 15], [40, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) })}px)`,
      width,
      height,
      backgroundColor: bezel,
      borderRadius: rounded,
      padding: 14,
      boxShadow: glow ? `0 0 50px ${glow}, 0 20px 60px rgba(0,0,0,0.4)` : "0 20px 60px rgba(0,0,0,0.35)",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Monitor screen */}
      <div style={{
        flex: 1,
        backgroundColor: screenBg,
        borderRadius: 6,
        overflow: "hidden",
        position: "relative",
        display: "flex",
        flexDirection: "column",
      }}>
        {/* Title bar */}
        {(title || subtitle) && (
          <div style={{
            height: 44,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingLeft: 16,
            paddingRight: 16,
            borderBottom: `1px solid ${COLORS.border}`,
            backgroundColor: bezel === "#1E293B" ? "#F1F5F9" : screenBg,
            fontFamily: FONT_SANS,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: 99, backgroundColor: "#FF5F57", marginRight: -2 }} />
              <div style={{ width: 10, height: 10, borderRadius: 99, backgroundColor: "#FEBC2E", marginRight: -2 }} />
              <div style={{ width: 10, height: 10, borderRadius: 99, backgroundColor: "#28C840", marginRight: -2 }} />
              {title && (
                <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, fontFamily: FONT_MONO, marginLeft: 10 }}>{title}</span>
              )}
            </div>
            {subtitle && (
              <span style={{ fontSize: 12, color: COLORS.textMuted, fontFamily: FONT_MONO }}>{subtitle}</span>
            )}
          </div>
        )}
        {/* Screen content */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden", fontFamily: FONT_SANS }}>
          {children}
        </div>
      </div>
    </Interactive.Div>
  );
};

// Terminal-style text scroller — for showing multi-line log output
export const Terminal: React.FC<{
  lines: { icon?: string; text: string; color?: string; dir?: "in" | "out" | "block" | "ok" }[];
  active?: boolean;
  fontSize?: number;
}> = ({ lines, active = true, fontSize = 16 }) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();

  // Reveal lines progressively — delay per line = fraction of fps
  return (
    <div style={{
      padding: 24,
      fontFamily: FONT_MONO,
      fontSize,
      lineHeight: 1.6,
      color: COLORS.text,
      height: "100%",
      overflow: "hidden",
    }}>
      {lines.map((line, i) => {
        const delay = i * 8;
        const o = interpolate(frame, [delay, delay + 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        if (o <= 0) return null;
        const ic = line.dir === "in" ? "→" : line.dir === "out" ? "←" : line.dir === "block" ? "✗" : line.dir === "ok" ? "✓" : (line.icon || "·");
        return (
          <div key={i} style={{ opacity: o, display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ color: line.dir === "block" ? COLORS.red : line.dir === "ok" ? COLORS.green : COLORS.textMuted, minWidth: 20, fontWeight: 700 }}>{ic}</span>
            <span style={{ color: line.color || COLORS.text }}>{line.text}</span>
          </div>
        );
      })}
      {/* Blinking cursor */}
      {active && (
        <div style={{ opacity: interpolate(frame, [0, fps * 0.5, fps], [1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "extend" }), marginTop: 8 }}>
          <span style={{ color: COLORS.green, fontFamily: FONT_MONO, fontSize }}>▋</span>
        </div>
      )}
    </div>
  );
};
