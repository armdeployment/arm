import { interpolate, useCurrentFrame, Easing, Img, staticFile } from "remotion";
import { COLORS, FONT_SANS, FONT_MONO } from "../../theme";
import { V6 } from "../../data/video6-data";

export const SceneV6Activate: React.FC = () => {
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
        <div style={{ fontSize: 14, color: COLORS.cyan, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>
          Step 3 · arm setup, No Arguments
        </div>
        <div style={{ fontSize: 30, fontWeight: 700, color: COLORS.text, letterSpacing: -0.5 }}>
          Opens a Browser. Never a Terminal Prompt.
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
              src={staticFile("install-e2e/04-gui-activate.png")}
              style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 20%", display: "block" }}
            />
          </div>
          <div style={{
            opacity: interpolate(frame, [26, 38], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            marginTop: 8, textAlign: "center", fontSize: 12, color: COLORS.textMuted,
          }}>
            Real screenshot — 127.0.0.1, a local server this process started
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, justifyContent: "center", minWidth: 0 }}>
          <div style={{
            opacity: interpolate(frame, [16, 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            backgroundColor: COLORS.navyDark, borderRadius: 10, padding: "16px 18px",
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.goldLight, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
              What actually happened
            </div>
            <div style={{ fontSize: 12, color: COLORS.textDarkMuted, fontFamily: FONT_MONO, lineHeight: 1.8 }}>
              $ arm setup<br />
              → starts a local HTTP server<br />
              → opens the default browser<br />
              → this page is all the user sees
            </div>
          </div>
          <div style={{
            opacity: interpolate(frame, [34, 48], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            fontSize: 11.5, color: COLORS.textMuted, lineHeight: 1.5,
          }}>
            Code <span style={{ fontFamily: FONT_MONO, fontWeight: 700, color: COLORS.text }}>{V6.code}</span> and the tenant
            URL from the previous scene, pasted in — same one, same session.
          </div>
        </div>
      </div>
    </div>
  );
};
