import { interpolate, useCurrentFrame, Easing } from "remotion";
import { COLORS, FONT_SANS, FONT_MONO } from "../../theme";
import { V2 } from "../../data/video2-data";

export const SceneV2Intro: React.FC = () => {
  const frame = useCurrentFrame();

  const titleAppear = interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const titleY = interpolate(frame, [0, 15], [30, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });

  return (
    <div style={{
      width: "100%", height: "100%", backgroundColor: COLORS.navyDark,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: FONT_SANS, padding: "40px 60px",
    }}>
      <div style={{
        opacity: titleAppear, transform: `translateY(${titleY}px)`, textAlign: "center",
      }}>
        <div style={{ fontSize: 14, color: COLORS.goldLight, fontWeight: 600, letterSpacing: 3, textTransform: "uppercase", marginBottom: 12 }}>
          ARM · Provisioning & Org Structure
        </div>
        <div style={{ fontSize: 44, fontWeight: 700, color: COLORS.white, letterSpacing: -1, lineHeight: 1.15 }}>
          One Tool. Every Company Shape.
        </div>
        <div style={{ fontSize: 16, color: COLORS.textDarkMuted, marginTop: 20, maxWidth: 800, margin: "20px auto 0", lineHeight: 1.6 }}>
          A manufacturing company has HQ + plants in different locations. A holding company
          has subsidiaries with their own orgs. A fintech has Chinese walls. ARM provisions
          each structure in minutes — then lets your org_admin reshape it as you grow.
        </div>
      </div>

      {/* Profile cards */}
      <div style={{ display: "flex", gap: 16, marginTop: 44 }}>
        {V2.profiles.map((p, i) => {
          const appear = interpolate(frame, [22 + i * 8, 36 + i * 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div key={i} style={{
              opacity: appear, transform: `translateY(${(1 - appear) * 30}px)`,
              backgroundColor: COLORS.slate800, borderRadius: 10, border: `1px solid ${COLORS.borderDark}`,
              padding: "18px 22px", textAlign: "center", minWidth: 200,
            }}>
              <div style={{ fontSize: 30 }}>{p.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.white, marginTop: 6 }}>{p.label.split(" / ")[0]}</div>
              <div style={{ fontSize: 10, color: COLORS.goldLight, fontFamily: FONT_MONO, marginTop: 3 }}>{p.treeSummary}</div>
            </div>
          );
        })}
      </div>

      <div style={{
        opacity: interpolate(frame, [55, 70], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        marginTop: 36, fontSize: 11, color: COLORS.textDarkMuted, fontFamily: FONT_MONO,
      }}>
        Industry profiles = provisioning-time defaults · never runtime gates
      </div>
    </div>
  );
};
