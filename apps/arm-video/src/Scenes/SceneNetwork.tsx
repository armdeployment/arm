import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { COLORS, FONT_SANS, FONT_MONO } from "../theme";
import { REAL } from "../real-data";
import { Monitor } from "../components/Monitor";

export const SceneNetwork: React.FC = () => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.bgDark,
        fontFamily: FONT_SANS,
        opacity: fadeIn,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 24,
          left: 40,
          fontSize: 28,
          fontWeight: 700,
          color: COLORS.white,
        }}
      >
        Enterprise Network Topology
      </div>
      <div
        style={{
          position: "absolute",
          top: 60,
          left: 40,
          fontSize: 14,
          color: COLORS.textDarkMuted,
          fontFamily: FONT_MONO,
        }}
      >
        REAL DOCKER NETWORKS · armtest-internal + armtest-external
      </div>

      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          display: "flex",
          gap: 28,
          alignItems: "center",
        }}
      >
        {/* Real Ollama models (NOT fake "OpenAI · Anthropic · Google") */}
        <Monitor
          name="Ollama"
          title="🧠 OLLAMA (SELF-HOSTED)"
          subtitle="host.docker.internal:11434"
          width={380}
          height={520}
          bezel="#0F172A"
          screenBg="#0F172A"
          glow="rgba(34,197,94,0.12)"
        >
          <div
            style={{
              padding: 24,
              display: "flex",
              flexDirection: "column",
              gap: 14,
              height: "100%",
            }}
          >
            <div
              style={{
                color: COLORS.textDark,
                fontSize: 16,
                fontWeight: 600,
                fontFamily: FONT_MONO,
              }}
            >
              LOADED MODELS
            </div>
            {REAL.ollama.map((m, i) => {
              const o = interpolate(frame, [10 + i * 8, 18 + i * 8], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              const pulse = interpolate(
                frame,
                [20 + i * 12, 26 + i * 12, 32 + i * 12],
                [0.5, 1, 0.5],
                { extrapolateLeft: "clamp", extrapolateRight: "extend" },
              );
              return (
                <div
                  key={m.name}
                  style={{
                    opacity: o,
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "16px 18px",
                    background: "rgba(34,197,94,0.06)",
                    borderRadius: 8,
                    border: `1px solid rgba(34,197,94,0.2)`,
                  }}
                >
                  <div
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      backgroundColor: COLORS.green,
                      opacity: pulse,
                      boxShadow: `0 0 10px ${COLORS.green}`,
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 700,
                        color: COLORS.textDark,
                        fontFamily: FONT_MONO,
                      }}
                    >
                      {m.name}
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: COLORS.textDarkMuted,
                        fontFamily: FONT_MONO,
                      }}
                    >
                      {m.size} · self-hosted
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: COLORS.green,
                      fontFamily: FONT_MONO,
                      fontWeight: 600,
                      background: "rgba(34,197,94,0.1)",
                      padding: "4px 10px",
                      borderRadius: 4,
                    }}
                  >
                    WARM
                  </div>
                </div>
              );
            })}
            <div
              style={{
                marginTop: 12,
                padding: "12px 14px",
                background: "rgba(255,255,255,0.03)",
                borderRadius: 8,
                opacity: interpolate(frame, [30, 38], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  color: COLORS.textDarkMuted,
                  fontFamily: FONT_MONO,
                  lineHeight: 1.6,
                }}
              >
                OpenAI-compatible API
                <br />
                Endpoint: /v1/chat/completions
                <br />
                Zero data egress · 100% on-prem
              </div>
            </div>
          </div>
        </Monitor>

        {/* Connection */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div
            style={{
              width: 3,
              height: 40,
              background: `linear-gradient(to bottom, ${COLORS.green}, ${COLORS.gold})`,
            }}
          />
          <div
            style={{
              width: 18,
              height: 18,
              borderRight: `3px solid ${COLORS.gold}`,
              borderBottom: `3px solid ${COLORS.gold}`,
              transform: "rotate(-45deg)",
            }}
          />
          <span
            style={{
              color: COLORS.goldLight,
              fontSize: 12,
              fontFamily: FONT_MONO,
            }}
          >
            mTLS
          </span>
        </div>

        {/* Real ARM proxy startup log */}
        <Monitor
          name="ARM Proxy"
          title="🛡️ ARM DATA-PLANE PROXY"
          subtitle="arm.armtest.com:8787"
          width={520}
          height={520}
          bezel="#172554"
          screenBg="#0F172A"
          glow="rgba(180,83,9,0.15)"
        >
          <div
            style={{
              padding: 20,
              fontFamily: FONT_MONO,
              fontSize: 12,
              lineHeight: 1.55,
              color: COLORS.textDark,
              height: "100%",
              overflow: "hidden",
            }}
          >
            {REAL.proxyStartup.map((line, i) => {
              const o = interpolate(frame, [i * 3, i * 3 + 6], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              const isHeader = line.includes("╔") || line.includes("║");
              const isCheck = line.includes("✓");
              const isSection = line.includes("▸");
              return (
                <div
                  key={i}
                  style={{
                    opacity: o,
                    color: isCheck
                      ? COLORS.green
                      : isSection
                        ? COLORS.goldLight
                        : isHeader
                          ? COLORS.textDark
                          : COLORS.textDarkMuted,
                    fontWeight: isHeader ? 700 : 400,
                    whiteSpace: "pre",
                  }}
                >
                  {line || "\u00A0"}
                </div>
              );
            })}
          </div>
        </Monitor>

        {/* Connection to internal network */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div
            style={{
              width: 3,
              height: 40,
              background: `linear-gradient(to bottom, ${COLORS.gold}, ${COLORS.navy})`,
            }}
          />
          <div
            style={{
              width: 18,
              height: 18,
              borderRight: `3px solid ${COLORS.navy}`,
              borderBottom: `3px solid ${COLORS.navy}`,
              transform: "rotate(-45deg)",
            }}
          />
          <span
            style={{
              color: COLORS.textDarkMuted,
              fontSize: 12,
              fontFamily: FONT_MONO,
            }}
          >
            VPC
          </span>
        </div>

        {/* Real internal network containers */}
        <Monitor
          name="Internal Net"
          title="🏢 armtest-internal"
          subtitle="Docker bridge network"
          width={380}
          height={520}
          bezel="#0F172A"
          screenBg="#0F172A"
          glow="rgba(59,130,246,0.1)"
        >
          <div
            style={{
              padding: 24,
              display: "flex",
              flexDirection: "column",
              gap: 10,
              height: "100%",
            }}
          >
            <div
              style={{
                color: COLORS.textDark,
                fontSize: 16,
                fontWeight: 600,
                fontFamily: FONT_MONO,
                marginBottom: 6,
              }}
            >
              CONTAINERS
            </div>
            {REAL.networkInternal.map((name, i) => {
              const o = interpolate(frame, [15 + i * 8, 22 + i * 8], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              const pulse = interpolate(
                frame,
                [25 + i * 10, 31 + i * 10, 37 + i * 10],
                [0.4, 1, 0.4],
                { extrapolateLeft: "clamp", extrapolateRight: "extend" },
              );
              return (
                <div
                  key={name}
                  style={{
                    opacity: o,
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 14px",
                    background: "rgba(255,255,255,0.04)",
                    borderRadius: 8,
                    borderLeft: `3px solid ${COLORS.green}`,
                  }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: COLORS.green,
                      opacity: pulse,
                      boxShadow: `0 0 6px ${COLORS.green}`,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: COLORS.textDark,
                      fontFamily: FONT_MONO,
                    }}
                  >
                    {name}
                  </span>
                </div>
              );
            })}
            <div
              style={{
                marginTop: 10,
                opacity: interpolate(frame, [40, 48], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
              }}
            >
              <div
                style={{
                  padding: "12px 14px",
                  background: "rgba(239,68,68,0.08)",
                  borderRadius: 8,
                  borderLeft: `3px solid ${COLORS.red}`,
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: COLORS.red,
                    fontFamily: FONT_MONO,
                  }}
                >
                  armtest-external
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: COLORS.textDarkMuted,
                    fontFamily: FONT_MONO,
                  }}
                >
                  {REAL.networkExternal[0]} — blocked from armtest.com
                </div>
              </div>
            </div>
          </div>
        </Monitor>
      </div>
    </AbsoluteFill>
  );
};
