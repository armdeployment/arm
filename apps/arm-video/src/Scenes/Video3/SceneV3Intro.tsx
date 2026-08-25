import { interpolate, useCurrentFrame, Easing } from "remotion";
import { COLORS, FONT_SANS, FONT_MONO } from "../../theme";
import { V3 } from "../../data/video3-data";

export const SceneV3Intro: React.FC = () => {
  const frame = useCurrentFrame();

  const titleAppear = interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const titleY = interpolate(frame, [0, 15], [30, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });

  return (
    <div style={{
      width: "100%", height: "100%", backgroundColor: COLORS.navyDark,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: FONT_SANS, padding: "40px 60px",
    }}>
      <div style={{ opacity: titleAppear, transform: `translateY(${titleY}px)`, textAlign: "center" }}>
        <div style={{ fontSize: 14, color: COLORS.goldLight, fontWeight: 600, letterSpacing: 3, textTransform: "uppercase", marginBottom: 12 }}>
          ARM · Wave 3 — Database Wiring
        </div>
        <div style={{ fontSize: 44, fontWeight: 700, color: COLORS.white, letterSpacing: -1, lineHeight: 1.15 }}>
          From Fixtures to Real Data
        </div>
        <div style={{ fontSize: 16, color: COLORS.textDarkMuted, marginTop: 20, maxWidth: 820, margin: "20px auto 0", lineHeight: 1.6 }}>
          Every router in ARM defaults to in-memory fixtures — no DB required to run the
          dashboard. Three routers now have a second path: same UI, same tRPC contract,
          real Postgres and ClickHouse underneath. One env var switches between them.
        </div>
      </div>

      {/* Router cards */}
      <div style={{ display: "flex", gap: 16, marginTop: 44 }}>
        {V3.routers.map((r, i) => {
          const appear = interpolate(frame, [22 + i * 8, 36 + i * 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div key={i} style={{
              opacity: appear, transform: `translateY(${(1 - appear) * 30}px)`,
              backgroundColor: COLORS.slate800, borderRadius: 10, border: `1px solid ${COLORS.borderDark}`,
              padding: "18px 24px", textAlign: "center", minWidth: 220,
            }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.white, fontFamily: FONT_MONO }}>{r.name}</div>
              <div style={{ fontSize: 12, color: r.color, fontFamily: FONT_MONO, marginTop: 8, fontWeight: 700 }}>{r.store}</div>
              <div style={{ fontSize: 11, color: COLORS.textDarkMuted, marginTop: 4 }}>{r.verb}</div>
            </div>
          );
        })}
      </div>

      <div style={{
        opacity: interpolate(frame, [55, 70], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        marginTop: 36, fontSize: 11, color: COLORS.textDarkMuted, fontFamily: FONT_MONO,
      }}>
        ARM_FIXTURE_MODE=1 (default, no DB) vs ARM_FIXTURE_MODE=0 (real Postgres + ClickHouse)
      </div>
    </div>
  );
};
