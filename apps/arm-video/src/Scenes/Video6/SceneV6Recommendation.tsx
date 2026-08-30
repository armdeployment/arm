import { interpolate, useCurrentFrame, Easing, Img, staticFile } from "remotion";
import { COLORS, FONT_SANS, FONT_MONO } from "../../theme";
import { Monitor } from "../../components/Monitor";
import { V6 } from "../../data/video6-data";

export const SceneV6Recommendation: React.FC = () => {
  const frame = useCurrentFrame();

  const titleAppear = interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const titleY = interpolate(frame, [0, 15], [30, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });

  return (
    <div style={{
      width: "100%", height: "100%", backgroundColor: COLORS.bgDark,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: FONT_SANS, padding: "24px 44px",
    }}>
      <div style={{ opacity: titleAppear, transform: `translateY(${titleY}px)`, textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 14, color: COLORS.goldLight, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>
          Step 2 · Recommendation → Real Activation Code
        </div>
        <div style={{ fontSize: 30, fontWeight: 700, color: COLORS.white, letterSpacing: -0.5 }}>
          "We Recommend the Senior Manager Package"
        </div>
      </div>

      <div style={{ display: "flex", gap: 28, alignItems: "center" }}>
        <div style={{
          opacity: interpolate(frame, [8, 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) }),
          translate: `0px ${interpolate(frame, [8, 22], [30, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}px`,
        }}>
          <Monitor name="Recommendation" title="localhost:3300/start/result" width={620} height={340} bezel="#1E293B" screenBg="#F8FAFC" rounded={10}>
            <Img src={staticFile("install-e2e/02-recommendation.png")} style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
          </Monitor>
        </div>
        <div style={{
          opacity: interpolate(frame, [22, 36], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) }),
          translate: `0px ${interpolate(frame, [22, 36], [30, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}px`,
        }}>
          <Monitor name="Download" title="localhost:3300/download" width={620} height={340} bezel="#1E293B" screenBg="#F8FAFC" rounded={10}>
            <Img src={staticFile("install-e2e/03-download.png")} style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
          </Monitor>
        </div>
      </div>

      <div style={{
        opacity: interpolate(frame, [55, 68], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        marginTop: 20, fontSize: 13, color: COLORS.goldLight, fontFamily: FONT_MONO, textAlign: "center",
      }}>
        Code {V6.code} — the same one used to install a few scenes from now
      </div>
    </div>
  );
};
