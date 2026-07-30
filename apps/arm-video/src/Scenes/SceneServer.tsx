import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, spring } from "remotion";
import { COLORS, FONT_SANS, FONT_MONO } from "../theme";
import { Monitor, Terminal } from "../components/Monitor";

const SERVERS = [
  { name: "Router", title: "🔀 LOAD BALANCER", lines: [
    { text: "Active connections: 14", dir: "ok" as const },
    { text: "Upstream: arm-gw-01, arm-gw-02", dir: "ok" as const },
    { text: "mTLS handshake OK", dir: "ok" as const },
    { text: "Rate limit: 120 req/min", dir: "ok" as const },
  ]},
  { name: "Auth Server", title: "🆔 IDENTITY PROXY", lines: [
    { text: "OIDC issuer: arm-idp.prod", dir: "ok" as const },
    { text: "sub_accounts cached: 12", dir: "ok" as const },
    { text: "Token expiry: 55 min", dir: "ok" as const },
    { text: "Session replay: active", dir: "ok" as const },
  ]},
  { name: "Budget Server", title: "💰 BUDGET ENGINE", lines: [
    { text: "Active budgets: 8 / 12", dir: "ok" as const },
    { text: "Today's spend: $0.22", dir: "ok" as const },
    { text: "Engineering: 45% used", dir: "out" as const },
    { text: "Manufacturing: 112% ✗", dir: "block" as const },
  ]},
  { name: "Audit Server", title: "📋 AUDIT LEDGER", lines: [
    { text: "ClickHouse: 1,892 events", dir: "ok" as const },
    { text: "Partition: 2026-07 (14 MB)", dir: "ok" as const },
    { text: "Last flush: 0.3s ago", dir: "ok" as const },
    { text: "Replication: primary=arm-dp-01", dir: "ok" as const },
  ]},
  { name: "DLP Server", title: "🔒 DLP ENGINE", lines: [
    { text: "Scanned: 892 prompts", dir: "ok" as const },
    { text: "Violations: 2 blocked", dir: "block" as const },
    { text: "Pattern: PII (email regex)", dir: "block" as const },
    { text: "Status: HEALTHY", dir: "ok" as const },
  ]},
];

export const SceneServer: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fadeIn = interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bgDark, fontFamily: FONT_SANS, opacity: fadeIn, overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 24, left: 40, fontSize: 28, fontWeight: 700, color: COLORS.white }}>
        ARM Server Rack
      </div>
      <div style={{ position: "absolute", top: 60, left: 40, fontSize: 14, color: COLORS.textDarkMuted, fontFamily: FONT_MONO }}>
        GOVERNANCE PROXY — DATA PLANE
      </div>

      <div style={{
        position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        display: "flex", gap: 20, alignItems: "flex-end",
      }}>
        {SERVERS.map((server, i) => {
          const rackSpring = spring({ frame: Math.max(0, frame - i * 8), fps, config: { damping: 18, stiffness: 80 } });
          return (
            <div key={server.name} style={{
              transform: `translateY(${(1 - rackSpring) * 60}px)`,
              opacity: interpolate(frame, [i * 6, i * 6 + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            }}>
              <Monitor name={server.name} title={server.title} subtitle="rack-u01" width={340} height={560} bezel="#1E293B" screenBg="#0F172A">
                <Terminal lines={server.lines} />
              </Monitor>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
