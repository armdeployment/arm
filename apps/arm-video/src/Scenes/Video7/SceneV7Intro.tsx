import { interpolate, useCurrentFrame, Easing } from "remotion";
import { COLORS, FONT_SANS, FONT_MONO } from "../../theme";

const PLANES = [
  {
    name: "Control plane",
    sub: "metadata + audit only",
    items: ["catalog / library", "policy + budgets", "adoption analytics", "approvals + audit"],
    color: COLORS.navy,
  },
  {
    name: "Data plane",
    sub: "inside the tenant's own network",
    items: ["metered LLM proxy", "artifact cache", "connectors", "meter agent"],
    color: COLORS.gold,
  },
];

export const SceneV7Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const appear = interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const y = interpolate(frame, [0, 15], [30, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  return (
    <div style={{
      width: "100%", height: "100%", backgroundColor: COLORS.navyDark,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: FONT_SANS, padding: "40px 60px",
    }}>
      <div style={{ opacity: appear, transform: `translateY(${y}px)`, textAlign: "center" }}>
        <div style={{ fontSize: 19, color: COLORS.goldLight, fontWeight: 600, letterSpacing: 3, textTransform: "uppercase", marginBottom: 12 }}>
          ARM · Agent Resource Management
        </div>
        <div style={{ fontSize: 58, fontWeight: 700, color: COLORS.white, letterSpacing: -1.2, lineHeight: 1.12 }}>
          An HR Department for AI Agents
        </div>
        <div style={{ fontSize: 21.5, color: COLORS.textDarkMuted, marginTop: 20, maxWidth: 1080, margin: "20px auto 0", lineHeight: 1.65 }}>
          A company buys agents the way it buys laptops — but has none of the machinery it has
          for laptops. Who has one? What can it touch? What did it cost? Did anyone actually
          use it? ARM is that missing layer, and it splits along one hard line.
        </div>
      </div>

      <div style={{ display: "flex", gap: 20, marginTop: 40, alignItems: "stretch" }}>
        {PLANES.map((p, i) => (
          <div key={p.name} style={{
            opacity: interpolate(frame, [24 + i * 12, 40 + i * 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            transform: `translateY(${(1 - interpolate(frame, [24 + i * 12, 40 + i * 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })) * 22}px)`,
            backgroundColor: COLORS.slate800, border: `1.5px solid ${p.color}`,
            borderRadius: 12, padding: "24px 34px", minWidth: 420,
          }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.white, fontFamily: FONT_MONO }}>{p.name}</div>
            <div style={{ fontSize: 15.5, color: p.color === COLORS.navy ? "#93B4E8" : COLORS.goldLight, marginTop: 5, fontWeight: 600 }}>
              {p.sub}
            </div>
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 5 }}>
              {p.items.map((it) => (
                <div key={it} style={{ fontSize: 16.5, color: COLORS.textDarkMuted, fontFamily: FONT_MONO }}>· {it}</div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{
        opacity: interpolate(frame, [58, 74], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        marginTop: 30, fontSize: 17, color: COLORS.goldLight, fontFamily: FONT_MONO, textAlign: "center",
      }}>
        Prompt bodies never cross into the control plane — Invariant 1, enforced by an executable check
      </div>
    </div>
  );
};
