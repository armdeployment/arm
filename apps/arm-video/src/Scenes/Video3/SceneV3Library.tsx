import { interpolate, useCurrentFrame, Easing, Img, staticFile } from "remotion";
import { COLORS, FONT_SANS, FONT_MONO } from "../../theme";
import { V3 } from "../../data/video3-data";

export const SceneV3Library: React.FC = () => {
  const frame = useCurrentFrame();

  const titleAppear = interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const titleY = interpolate(frame, [0, 15], [30, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });

  return (
    <div style={{
      width: "100%", height: "100%", backgroundColor: COLORS.bg,
      display: "flex", flexDirection: "column", alignItems: "center",
      fontFamily: FONT_SANS, padding: "24px 44px",
    }}>
      <div style={{ opacity: titleAppear, transform: `translateY(${titleY}px)`, textAlign: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 14, color: COLORS.gold, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>
          library-router.ts · catalog-router.ts · Real Postgres
        </div>
        <div style={{ fontSize: 30, fontWeight: 700, color: COLORS.text, letterSpacing: -0.5 }}>
          Discovery, Promote, Assign — Real Writes
        </div>
      </div>

      <div style={{ display: "flex", gap: 18, width: "100%", flex: 1, minHeight: 0 }}>
        <div style={{ flex: 1.6, display: "flex", flexDirection: "column" }}>
          <div style={{
            opacity: interpolate(frame, [12, 26], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            backgroundColor: COLORS.white, borderRadius: 10, border: `1px solid ${COLORS.border}`,
            overflow: "hidden", boxShadow: "0 8px 30px rgba(0,0,0,0.10)", flex: 1,
          }}>
            <Img
              src={staticFile("wave3-data/library-discovery.png")}
              style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top left", display: "block" }}
            />
          </div>
          <div style={{
            opacity: interpolate(frame, [26, 38], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            marginTop: 8, textAlign: "center", fontSize: 12, color: COLORS.textMuted,
          }}>
            ARM dashboard · /library → Discovery — "Promote" writes a real component row (real screenshot)
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, justifyContent: "center", minWidth: 0 }}>
          <div style={{
            opacity: interpolate(frame, [16, 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            backgroundColor: COLORS.white, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "14px 18px",
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, marginBottom: 4 }}>
              {V3.library.totalComponents} components · computed live, not fixed
            </div>
            <div style={{ fontSize: 11.5, color: COLORS.textMuted, fontFamily: FONT_MONO }}>
              {V3.library.firstParty} first_party · {V3.library.tenantAuthored} tenant_authored
            </div>
          </div>

          <div style={{
            opacity: interpolate(frame, [26, 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            backgroundColor: COLORS.white, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "14px 18px",
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, marginBottom: 8 }}>
              catalog-router.ts · {V3.assignments.total} assignments
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {V3.assignments.states.map((s) => (
                <div key={s.label} style={{ flex: 1, textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: s.color, fontFamily: FONT_MONO }}>{s.value}</div>
                  <div style={{ fontSize: 9, color: COLORS.textMuted }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 10.5, color: COLORS.textMuted, marginTop: 8 }}>
              requested → approved → active → revoked, D9 state machine
            </div>
          </div>

          <div style={{
            opacity: interpolate(frame, [40, 54], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            backgroundColor: COLORS.navyDark, borderRadius: 10, padding: "14px 18px",
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.white, marginBottom: 4 }}>
              🔧 postgresComponentRepo
            </div>
            <div style={{ fontSize: 11.5, color: COLORS.textDarkMuted, fontFamily: FONT_MONO, lineHeight: 1.6 }}>
              the real ComponentRepoPort implementation — publishVersion picks it (vs the
              in-memory stand-in) by the same isFixtureMode() gate every other router uses
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
