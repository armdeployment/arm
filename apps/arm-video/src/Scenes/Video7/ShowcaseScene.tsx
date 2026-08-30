import { interpolate, useCurrentFrame, Easing, Img, staticFile } from "remotion";
import { COLORS, FONT_SANS, FONT_MONO } from "../../theme";

/**
 * The one screenshot-plus-annotations layout every showcase scene in
 * Video 7 uses. Twelve near-identical scene files would be twelve places
 * to fix a spacing bug, so the layout lives here once and each scene is
 * reduced to its content.
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
  /** CSS object-position for the crop — tune per screenshot. */
  imagePosition?: string;
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
  caption,
  facts = [],
  note,
  accent = COLORS.gold,
  dark = false,
}) => {
  const frame = useCurrentFrame();
  const bg = dark ? COLORS.bgDark : COLORS.bg;
  const titleColor = dark ? COLORS.white : COLORS.text;

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
      fontFamily: FONT_SANS, padding: "24px 44px",
    }}>
      <div style={{ opacity: appear, transform: `translateY(${titleY}px)`, textAlign: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 14, color: accent, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>
          {kicker}
        </div>
        <div style={{ fontSize: 30, fontWeight: 700, color: titleColor, letterSpacing: -0.5 }}>{title}</div>
      </div>

      <div style={{ display: "flex", gap: 18, width: "100%", flex: 1, minHeight: 0 }}>
        <div style={{ flex: facts.length > 0 ? 1.65 : 1, display: "flex", flexDirection: "column" }}>
          <div style={{
            opacity: interpolate(frame, [10, 24], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            backgroundColor: COLORS.white, borderRadius: 10, border: `1px solid ${dark ? COLORS.borderDark : COLORS.border}`,
            overflow: "hidden", boxShadow: "0 8px 30px rgba(0,0,0,0.12)", flex: 1,
          }}>
            <Img
              src={staticFile(image)}
              style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: imagePosition, display: "block" }}
            />
          </div>
          <div style={{
            opacity: interpolate(frame, [24, 36], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            marginTop: 8, textAlign: "center", fontSize: 12,
            color: dark ? COLORS.textDarkMuted : COLORS.textMuted,
          }}>
            {caption}
          </div>
        </div>

        {facts.length > 0 && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, justifyContent: "center", minWidth: 0 }}>
            {facts.map((f, i) => {
              const o = interpolate(frame, [16 + i * 9, 30 + i * 9], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              const isGood = f.tone === "good";
              const isAccent = f.tone === "accent";
              return (
                <div key={f.label} style={{
                  opacity: o, transform: `translateX(${(1 - o) * 24}px)`,
                  backgroundColor: isAccent ? COLORS.navyDark : isGood ? "rgba(22,163,74,0.07)" : COLORS.white,
                  border: `1px solid ${isGood ? `${COLORS.green}33` : isAccent ? COLORS.navyDark : COLORS.border}`,
                  borderRadius: 10, padding: "13px 16px",
                }}>
                  <div style={{
                    display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10,
                  }}>
                    <span style={{
                      fontSize: 12.5, fontWeight: 700,
                      color: isAccent ? COLORS.goldLight : isGood ? COLORS.green : COLORS.text,
                    }}>
                      {f.label}
                    </span>
                    {f.value && (
                      <span style={{
                        fontSize: 19, fontWeight: 800, fontFamily: FONT_MONO,
                        color: isAccent ? COLORS.white : isGood ? COLORS.green : COLORS.navy,
                      }}>
                        {f.value}
                      </span>
                    )}
                  </div>
                  {f.detail && (
                    <div style={{
                      fontSize: 11, marginTop: 5, lineHeight: 1.55,
                      color: isAccent ? COLORS.textDarkMuted : COLORS.textMuted,
                      fontFamily: isAccent ? FONT_MONO : FONT_SANS,
                    }}>
                      {f.detail}
                    </div>
                  )}
                </div>
              );
            })}
            {note && (
              <div style={{
                opacity: interpolate(frame, [16 + facts.length * 9 + 8, 30 + facts.length * 9 + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
                fontSize: 11.5, color: dark ? COLORS.textDarkMuted : COLORS.textMuted, lineHeight: 1.55, marginTop: 2,
              }}>
                {note}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
