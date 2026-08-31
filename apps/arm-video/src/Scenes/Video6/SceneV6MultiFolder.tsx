import {
  interpolate,
  useCurrentFrame,
  Easing,
  Img,
  staticFile,
} from "remotion";
import { COLORS, FONT_SANS, FONT_MONO } from "../../theme";
import { V6 } from "../../data/video6-data";

export const SceneV6MultiFolder: React.FC = () => {
  const frame = useCurrentFrame();

  const titleAppear = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleY = interpolate(frame, [0, 15], [30, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: COLORS.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        fontFamily: FONT_SANS,
        padding: "24px 44px",
      }}
    >
      <div
        style={{
          opacity: titleAppear,
          transform: `translateY(${titleY}px)`,
          textAlign: "center",
          marginBottom: 14,
        }}
      >
        <div
          style={{
            fontSize: 14,
            color: COLORS.gold,
            fontWeight: 600,
            letterSpacing: 2,
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          Step 6 · + Add Folder… · Two Real Projects
        </div>
        <div
          style={{
            fontSize: 30,
            fontWeight: 700,
            color: COLORS.text,
            letterSpacing: -0.5,
          }}
        >
          The Last Step, Still Zero Terminal
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 18,
          width: "100%",
          flex: 1,
          minHeight: 0,
        }}
      >
        <div style={{ flex: 1.6, display: "flex", flexDirection: "column" }}>
          <div
            style={{
              opacity: interpolate(frame, [12, 26], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              backgroundColor: COLORS.white,
              borderRadius: 10,
              border: `1px solid ${COLORS.border}`,
              overflow: "hidden",
              boxShadow: "0 8px 30px rgba(0,0,0,0.10)",
              flex: 1,
            }}
          >
            <Img
              src={staticFile("install-e2e/07-gui-refine.png")}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "50% 60%",
                display: "block",
              }}
            />
          </div>
          <div
            style={{
              opacity: interpolate(frame, [26, 38], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              marginTop: 8,
              textAlign: "center",
              fontSize: 12,
              color: COLORS.textMuted,
            }}
          >
            Real screenshot — two real folders, tags computed live
          </div>
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            justifyContent: "center",
            minWidth: 0,
          }}
        >
          <div
            style={{
              opacity: interpolate(frame, [16, 30], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              backgroundColor: COLORS.navyDark,
              borderRadius: 10,
              padding: "16px 18px",
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: COLORS.white,
                marginBottom: 8,
              }}
            >
              {V6.folders.totalFiles} files scanned · union of both folders
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {V6.folders.tags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    fontSize: 10.5,
                    fontFamily: FONT_MONO,
                    color: COLORS.goldLight,
                    border: `1px solid ${COLORS.goldLight}55`,
                    borderRadius: 5,
                    padding: "3px 7px",
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div
            style={{
              opacity: interpolate(frame, [36, 50], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              fontSize: 11.5,
              color: COLORS.textMuted,
              lineHeight: 1.5,
            }}
          >
            Extensions only — never file names or contents. One unreadable
            folder never blocks the others. All local, all A5-safe.
          </div>
        </div>
      </div>
    </div>
  );
};
