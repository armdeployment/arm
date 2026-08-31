import {
  interpolate,
  useCurrentFrame,
  Easing,
  Img,
  staticFile,
} from "remotion";
import { COLORS, FONT_SANS, FONT_MONO } from "../../theme";
import { V2 } from "../../data/video2-data";

export const SceneV2Roles: React.FC = () => {
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
      {/* Title */}
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
          Governance · Who Can Do What
        </div>
        <div
          style={{
            fontSize: 30,
            fontWeight: 700,
            color: COLORS.text,
            letterSpacing: -0.5,
          }}
        >
          Capability-Based Roles, Not Titles
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
        {/* Role presets — high-res close-up */}
        <div style={{ flex: 1.6, display: "flex", flexDirection: "column" }}>
          <div
            style={{
              opacity: interpolate(frame, [10, 24], [0, 1], {
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
              src={staticFile("shots/role-cards.png")}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                display: "block",
              }}
            />
          </div>
          <div
            style={{
              opacity: interpolate(frame, [24, 36], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              marginTop: 8,
              textAlign: "center",
              fontSize: 12,
              color: COLORS.textMuted,
            }}
          >
            ARM dashboard · /admin/roles — Role Presets (real screenshot)
          </div>
        </div>

        {/* Authority flow + governing rules */}
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
          {/* Authority flow */}
          <div
            style={{
              opacity: interpolate(frame, [14, 28], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              backgroundColor: COLORS.white,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 10,
              padding: "16px 20px",
            }}
          >
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: COLORS.text,
                marginBottom: 10,
              }}
            >
              Authority Flow
            </div>
            <div
              style={{ fontSize: 14, lineHeight: 1.9, color: COLORS.textMuted }}
            >
              <div>
                🏛️ <strong>Org Admin</strong> → all verbs, all scopes
              </div>
              <div style={{ paddingLeft: 22, color: COLORS.textMuted }}>
                ↓ delegates create + rename
              </div>
              <div>
                🏛️ <strong>Subsidiary Admin</strong> → within subsidiary
              </div>
              <div style={{ paddingLeft: 22, color: COLORS.textMuted }}>
                ↓ delegates create + rename
              </div>
              <div>
                🏭 <strong>Plant Manager</strong> → within plant
              </div>
              <div style={{ paddingLeft: 22, color: COLORS.textMuted }}>↓</div>
              <div>
                📁 <strong>Dept Head</strong> → rename own dept
              </div>
              <div style={{ paddingLeft: 22, color: COLORS.textMuted }}>↓</div>
              <div>
                👤 <strong>Viewer</strong> → read-only
              </div>
            </div>
          </div>

          {/* Governing rules */}
          <div
            style={{
              opacity: interpolate(frame, [30, 44], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              backgroundColor: COLORS.navyDark,
              borderRadius: 10,
              padding: "16px 20px",
            }}
          >
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: COLORS.white,
                marginBottom: 8,
              }}
            >
              ⚙ Governing rules
            </div>
            {V2.governingRules.map((rule, i) => (
              <div
                key={i}
                style={{
                  fontSize: 12,
                  color: COLORS.textDarkMuted,
                  marginTop: 5,
                  fontFamily: FONT_MONO,
                  lineHeight: 1.6,
                }}
              >
                <span style={{ color: COLORS.goldLight }}>{rule.key}</span> —{" "}
                {rule.text}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
