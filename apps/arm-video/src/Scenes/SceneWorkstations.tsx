import { AbsoluteFill, interpolate, useCurrentFrame, Easing } from "remotion";
import { COLORS, FONT_SANS, FONT_MONO } from "../theme";
import { Monitor } from "../components/Monitor";
import { VSCOdeEditor, Terminal, ProductionDashboard, QATestRunner, SupplyChainView, VPNStatusView } from "../components/Apps";

interface Employee {
  name: string; role: string; agent: string; app: string; accent: string;
  x: number; y: number; w: number; h: number;
}

const EMPLOYEES: Employee[] = [
  { name: "Sarah Chen", role: "Sr. Engineer · Engineering", agent: "Claude Code", app: "vscode", accent: COLORS.navy, x: 20, y: 80, w: 610, h: 460 },
  { name: "Mike Rodriguez", role: "Engineer · Engineering", agent: "OpenCode", app: "terminal", accent: COLORS.navy, x: 650, y: 80, w: 610, h: 460 },
  { name: "Carlos Mendes", role: "Mfg. Lead · Manufacturing", agent: "OpenCode", app: "dashboard", accent: COLORS.gold, x: 1280, y: 80, w: 620, h: 460 },
  { name: "Jenny Park", role: "QA Lead · Quality Assurance", agent: "Claude Code", app: "qa", accent: COLORS.red, x: 20, y: 570, w: 610, h: 490 },
  { name: "David Kim", role: "Supply Chain · Logistics", agent: "GitHub Copilot", app: "supply", accent: COLORS.cyan, x: 650, y: 570, w: 610, h: 490 },
  { name: "Alex Thompson", role: "Remote (VPN) · R&D", agent: "Pi", app: "vpn", accent: COLORS.green, x: 1280, y: 570, w: 620, h: 490 },
];

export const SceneWorkstations: React.FC = () => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const renderApp = (app: string) => {
    switch (app) {
      case "vscode": return <VSCOdeEditor frame={frame} />;
      case "terminal": return <Terminal frame={frame} />;
      case "dashboard": return <ProductionDashboard frame={frame} />;
      case "qa": return <QATestRunner frame={frame} />;
      case "supply": return <SupplyChainView frame={frame} />;
      case "vpn": return <VPNStatusView frame={frame} />;
      default: return null;
    }
  };

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bgDark, fontFamily: FONT_SANS, opacity: fadeIn, overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 20, left: 40, fontSize: 24, fontWeight: 700, color: COLORS.white }}>
        Agent Workstations
      </div>
      <div style={{ position: "absolute", top: 50, left: 40, fontSize: 12, color: COLORS.textDarkMuted, fontFamily: FONT_MONO }}>
        SIMULATED EMPLOYEE WORKSTATIONS · ARM SERVES AS GOVERNANCE BACKBONE
      </div>

      {EMPLOYEES.map((emp, i) => {
        const delay = 10 + Math.floor(i / 3) * 12 + (i % 3) * 6;
        const o = interpolate(frame, [delay, delay + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });
        const yOff = interpolate(frame, [delay, delay + 10], [24, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });

        return (
          <div key={emp.name} style={{
            position: "absolute", left: emp.x, top: emp.y,
            opacity: o, transform: `translateY(${yOff}px)`,
            display: "flex", flexDirection: "column", gap: 3,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 4, height: 20 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: emp.accent, flexShrink: 0 }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.textDark }}>{emp.name}</span>
              <span style={{ fontSize: 11, color: COLORS.textDarkMuted, fontFamily: FONT_MONO }}>{emp.role}</span>
              <div style={{ marginLeft: "auto", background: "rgba(255,255,255,0.06)", borderRadius: 3, padding: "2px 8px" }}>
                <span style={{ fontSize: 11, color: emp.accent, fontFamily: FONT_MONO, fontWeight: 600 }}>{emp.agent}</span>
              </div>
            </div>
            <Monitor name={emp.name} bezel="#1E293B" screenBg="#1E1E1E" width={emp.w} height={emp.h} rounded={8}>
              {renderApp(emp.app)}
            </Monitor>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
