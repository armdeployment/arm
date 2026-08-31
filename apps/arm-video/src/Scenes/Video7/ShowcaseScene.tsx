import { interpolate, useCurrentFrame, Easing, Img, staticFile } from "remotion";
import { COLORS, FONT_SANS, FONT_MONO } from "../../theme";

/**
 * The one screenshot-plus-annotations layout every showcase scene in
 * Video 7 uses. Twelve near-identical scene files would be twelve places
 * to fix a spacing bug, so the layout lives here once and each scene is
 * reduced to its content.
 *
 * Layout note — the screenshots are 3200x2100 (manager/server) and
 * 2800x2000 (installer) retina captures. Side-by-side with the facts they
 * only got ~1130px of the 1920 frame, which is a 43% downscale: the
 * dashboard's own 13px body text landed at ~11px on screen, and `cover`
 * chopped the right-hand column mid-word. Stacking the facts underneath
 * instead gives the panel the full 1840px content width, which is exactly
 * the source aspect at 57% — so nothing is cropped horizontally any more,
 * every screenshot reads a third larger, and the only crop left is the
 * vertical band chosen by `imagePosition`.
 */

export interface ShowcaseFact {
  label: string;
  value?: string;
  detail?: string;
  tone?: "neutral" | "good" | "accent";
}

export interface ShowcaseSceneProps {
  /** Small uppercase kicker above the title. */
  kicker: string;
  title: string;
  /** Path under public/, e.g. "full-demo/mgr-02-adoption.png". */
  image: string;
  /**
   * CSS object-position for the crop. At the default zoom the panel is the
   * source's own aspect ratio, so the horizontal half is a no-op and only
   * the vertical percentage picks which band of the page is shown.
   */
  imagePosition?: string;
  /**
   * Magnification past "fill the panel width". 1 shows the full width of
   * the capture; above that trades width for legibility on screenshots
   * whose content sits in the middle. Anchored on `imagePosition`.
   */
  zoom?: number;
  caption: string;
  facts?: ShowcaseFact[];
  /** Closing sentence under the facts. */
  note?: string;
  /** Kicker colour — distinguishes the employee / manager / server acts. */
  accent?: string;
  dark?: boolean;
}

export const ShowcaseScene: React.FC<ShowcaseSceneProps> = ({
  kicker,
  title,
  image,
  imagePosition = "50% 0%",
  zoom = 1,
  caption,
  facts = [],
  note,
  accent = COLORS.gold,
  dark = false,
}) => {
  const frame = useCurrentFrame();
  const bg = dark ? COLORS.bgDark : COLORS.bg;
  const titleColor = dark ? COLORS.white : COLORS.text;
  const mutedColor = dark ? COLORS.textDarkMuted : COLORS.textMuted;

  const appear = interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const titleY = interpolate(frame, [0, 15], [30, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  return (
    <div style={{
      width: "100%", height: "100%", backgroundColor: bg,
      display: "flex", flexDirection: "column", alignItems: "center",
      fontFamily: FONT_SANS, padding: "20px 40px 22px",
    }}>
      <div style={{ opacity: appear, transform: `translateY(${titleY}px)`, textAlign: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 19, color: accent, fontWeight: 700, letterSpacing: 2.4, textTransform: "uppercase", marginBottom: 5 }}>
          {kicker}
        </div>
        <div style={{ fontSize: 43, fontWeight: 700, color: titleColor, letterSpacing: -0.8, lineHeight: 1.1 }}>{title}</div>
      </div>

      <div style={{
        opacity: interpolate(frame, [10, 24], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        width: "100%", flex: 1, minHeight: 0,
        backgroundColor: COLORS.white, borderRadius: 12,
        border: `1px solid ${dark ? COLORS.borderDark : COLORS.border}`,
        overflow: "hidden", boxShadow: "0 10px 34px rgba(0,0,0,0.14)",
      }}>
        <Img
          src={staticFile(image)}
          style={{
            width: "100%", height: "100%", display: "block",
            objectFit: "cover", objectPosition: imagePosition,
            transform: zoom === 1 ? undefined : `scale(${zoom})`,
            transformOrigin: imagePosition,
          }}
        />
      </div>

      <div style={{
        opacity: interpolate(frame, [24, 36], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        marginTop: 9, fontSize: 17, color: mutedColor, textAlign: "center",
      }}>
        {caption}
      </div>

      {facts.length > 0 && (
        <div style={{ display: "flex", gap: 14, width: "100%", marginTop: 12, alignItems: "stretch" }}>
          {facts.map((f, i) => {
            const o = interpolate(frame, [16 + i * 9, 30 + i * 9], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            const isGood = f.tone === "good";
            const isAccent = f.tone === "accent";
            return (
              <div key={f.label} style={{
                opacity: o, transform: `translateY(${(1 - o) * 18}px)`,
                flex: 1, minWidth: 0,
                backgroundColor: isAccent ? COLORS.navyDark : isGood ? "rgba(22,163,74,0.07)" : COLORS.white,
                border: `1px solid ${isGood ? `${COLORS.green}33` : isAccent ? COLORS.navyDark : COLORS.border}`,
                borderRadius: 11, padding: "14px 18px",
              }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                  <span style={{
                    fontSize: 18.5, fontWeight: 700, lineHeight: 1.25,
                    color: isAccent ? COLORS.goldLight : isGood ? COLORS.green : COLORS.text,
                  }}>
                    {f.label}
                  </span>
                  {f.value && (
                    <span style={{
                      fontSize: 29, fontWeight: 800, fontFamily: FONT_MONO, whiteSpace: "nowrap",
                      color: isAccent ? COLORS.white : isGood ? COLORS.green : COLORS.navy,
                    }}>
                      {f.value}
                    </span>
                  )}
                </div>
                {f.detail && (
                  <div style={{
                    fontSize: 15, marginTop: 6, lineHeight: 1.5,
                    color: isAccent ? COLORS.textDarkMuted : COLORS.textMuted,
                    fontFamily: isAccent ? FONT_MONO : FONT_SANS,
                  }}>
                    {f.detail}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {note && (
        <div style={{
          opacity: interpolate(frame, [16 + facts.length * 9 + 8, 30 + facts.length * 9 + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          fontSize: 16, color: mutedColor, lineHeight: 1.5, marginTop: 10, textAlign: "center", maxWidth: 1500,
        }}>
          {note}
        </div>
      )}
    </div>
  );
};
