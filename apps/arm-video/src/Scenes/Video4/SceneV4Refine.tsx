import { interpolate, useCurrentFrame, Easing, Sequence } from "remotion";
import { COLORS, FONT_SANS, FONT_MONO } from "../../theme";
import { Monitor, Terminal } from "../../components/Monitor";
import { V4 } from "../../data/video4-data";

export const SceneV4Refine: React.FC = () => {
  const frame = useCurrentFrame();

  const titleAppear = interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const titleY = interpolate(frame, [0, 15], [30, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });

  const commandTyped = Math.min(V4.refineCommand.length, Math.max(0, Math.floor((frame - 6) * 2.4)));

  return (
    <div style={{
      width: "100%", height: "100%", backgroundColor: COLORS.bg,
      display: "flex", flexDirection: "column", alignItems: "center",
      fontFamily: FONT_SANS, padding: "24px 44px",
    }}>
      <div style={{ opacity: titleAppear, transform: `translateY(${titleY}px)`, textAlign: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 14, color: COLORS.gold, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>
          Step 4 · Optional — Everything Stays Local (A5)
        </div>
        <div style={{ fontSize: 30, fontWeight: 700, color: COLORS.text, letterSpacing: -0.5 }}>
          arm refine — Pain Points, Folder, Installed Tools
        </div>
      </div>

      <div style={{
        opacity: interpolate(frame, [10, 24], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      }}>
        <Monitor name="Terminal" title="arm refine" subtitle="~/senior-manager-agent" width={1000} height={640} bezel="#1E293B" screenBg="#0F172A" rounded={10}>
          <div style={{ padding: "16px 20px", fontFamily: FONT_MONO, fontSize: 13, color: COLORS.greenDark }}>
            $ {V4.refineCommand.slice(0, commandTyped)}
            {commandTyped < V4.refineCommand.length && (
              <span style={{ opacity: interpolate(frame % 16, [0, 8, 16], [1, 0, 1]) }}>▋</span>
            )}
          </div>
          <Sequence from={45}>
            <Terminal lines={V4.refineTerminal} fontSize={14} active={false} />
          </Sequence>
        </Monitor>
      </div>
    </div>
  );
};
