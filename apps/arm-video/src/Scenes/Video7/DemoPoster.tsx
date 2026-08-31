import { Img, staticFile } from "remotion";
import { COLORS, FONT_SANS, FONT_MONO } from "../../theme";

/**
 * Still frame used as the README's clickable poster for the full demo.
 *
 * GitHub's markdown sanitiser strips <video>, so a repo-hosted mp4 cannot
 * be given a real inline player (verified against the /markdown API). The
 * next best thing is a poster image linking to the file's blob page, where
 * GitHub does render a native player — so this composition exists to make
 * that poster look deliberate rather than like a random paused frame.
 *
 * Rendered with `remotion still ArmVideo7-Poster demo/arm-full-demo-poster.png`.
 */

const PANELS = [
  { label: "Act 1 · The Employee", sub: "install, no terminal", image: "install-e2e/05-gui-installed.png", accent: COLORS.cyan },
  { label: "Act 2 · The Manager", sub: "adoption and spend", image: "full-demo/mgr-02-adoption.png", accent: COLORS.goldLight },
  { label: "Act 3 · The Server", sub: "the component library", image: "full-demo/srv-02-library-components.png", accent: COLORS.greenDark },
];

export const DemoPoster: React.FC = () => (
  <div style={{
    width: "100%", height: "100%", backgroundColor: COLORS.navyDark,
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    fontFamily: FONT_SANS, padding: "56px 64px",
  }}>
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 20, color: COLORS.goldLight, fontWeight: 700, letterSpacing: 3.4, textTransform: "uppercase" }}>
        ARM · Agent Resource Management
      </div>
      <div style={{ fontSize: 68, fontWeight: 700, color: COLORS.white, letterSpacing: -1.6, marginTop: 14, lineHeight: 1.05 }}>
        The Complete System, End to End
      </div>
      <div style={{ fontSize: 23, color: COLORS.textDarkMuted, marginTop: 18, maxWidth: 1180, marginLeft: "auto", marginRight: "auto", lineHeight: 1.55 }}>
        An employee installing an agent, a manager governing adoption and spend, and the
        server-side library behind both — every screen a real capture from a live run.
      </div>
    </div>

    <div style={{ display: "flex", gap: 22, marginTop: 46, width: "100%", justifyContent: "center" }}>
      {PANELS.map((p) => (
        <div key={p.label} style={{ flex: 1, maxWidth: 560, display: "flex", flexDirection: "column" }}>
          <div style={{
            height: 300, borderRadius: 12, overflow: "hidden",
            border: `2px solid ${p.accent}`, backgroundColor: COLORS.white,
            boxShadow: "0 14px 40px rgba(0,0,0,0.42)",
          }}>
            <Img
              src={staticFile(p.image)}
              style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 0%", display: "block" }}
            />
          </div>
          <div style={{ fontSize: 19, fontWeight: 700, color: p.accent, marginTop: 13, fontFamily: FONT_MONO }}>{p.label}</div>
          <div style={{ fontSize: 16.5, color: COLORS.textDarkMuted, marginTop: 4 }}>{p.sub}</div>
        </div>
      ))}
    </div>

    <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 48 }}>
      <div style={{
        width: 74, height: 74, borderRadius: "50%", backgroundColor: COLORS.white,
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 8px 26px rgba(0,0,0,0.45)",
      }}>
        <div style={{
          width: 0, height: 0, marginLeft: 8,
          borderTop: "19px solid transparent", borderBottom: "19px solid transparent",
          borderLeft: `31px solid ${COLORS.navyDark}`,
        }} />
      </div>
      <div>
        <div style={{ fontSize: 25, fontWeight: 700, color: COLORS.white }}>Watch the full demo · 1:47</div>
        <div style={{ fontSize: 17, color: COLORS.textDarkMuted, fontFamily: FONT_MONO, marginTop: 4 }}>
          github.com/armdeployment/arm
        </div>
      </div>
    </div>
  </div>
);
