// ── VIDEO 2: Admin Provisions Different Company Structures (D6 + D8) ───────
// Real profile data from @arm/profiles + real provisioning UI screenshots.

import { COLORS } from "../theme";

export const V2 = {
  // Real industry profiles (from @arm/profiles presets)
  profiles: [
    {
      id: "manufacturing",
      label: "Manufacturing / Industrial",
      icon: "🏭",
      treeSummary: "HQ + 3 plants",
      description: "Corporate HQ + multiple plants, each with Production / Quality / Maintenance. Per-plant budgets, locations, regulatory tags.",
      orgNodes: [
        { icon: "🏢", name: "Corporate Headquarters", location: "Detroit, MI", budget: "$6,000/mo", color: COLORS.gold },
        { icon: "🏭", name: "Plant Detroit", location: "Detroit, MI, USA", budget: "$8,000/mo", tag: "ITAR", color: COLORS.green },
        { icon: "🏭", name: "Plant Stuttgart", location: "Stuttgart, Germany", budget: "$6,000/mo", tag: "EAR", color: COLORS.green },
        { icon: "🏭", name: "Plant Shenzhen", location: "Shenzhen, China", budget: "$4,000/mo", color: COLORS.green },
      ],
      stats: [
        { label: "Org nodes", value: "21" },
        { label: "Plants", value: "3" },
        { label: "DLP patterns", value: "9" },
        { label: "Seed agents", value: "10" },
      ],
    },
    {
      id: "holding",
      label: "Holding Company / Conglomerate",
      icon: "🏛️",
      treeSummary: "4 subsidiaries",
      description: "Parent + multiple subsidiaries, each running its own org. Manufacturing division has its own plants. Cross-entity isolation by default.",
      orgNodes: [
        { icon: "🏛️", name: "Corporate (Parent)", budget: "$5,000/mo", color: COLORS.navy },
        { icon: "🏛️", name: "Subsidiary: Tech Division", budget: "$8,000/mo", color: COLORS.navy },
        { icon: "🏛️", name: "Subsidiary: Manufacturing", budget: "$10,000/mo", color: COLORS.navy },
        { icon: "🏭", name: "  ↳ Plant Detroit", location: "Detroit, MI", budget: "$5,000/mo", tag: "ITAR", color: COLORS.green },
        { icon: "🏭", name: "  ↳ Plant Shenzhen", location: "Shenzhen, China", budget: "$5,000/mo", color: COLORS.green },
        { icon: "🏛️", name: "Subsidiary: Finance Division", budget: "$7,000/mo", color: COLORS.navy },
      ],
      stats: [
        { label: "Org nodes", value: "18" },
        { label: "Subsidiaries", value: "4" },
        { label: "Plants", value: "2" },
        { label: "Seed agents", value: "11" },
      ],
    },
    {
      id: "finance",
      label: "Finance / Financial Services",
      icon: "🏦",
      treeSummary: "Flat + Chinese walls",
      description: "Flat hierarchy with strong cross-team isolation (Chinese walls). Desk-level budgets and compliance-first routing.",
      orgNodes: [
        { icon: "📁", name: "Trading", budget: "$12,000/mo", color: COLORS.navy },
        { icon: "📁", name: "Risk Management", budget: "$6,000/mo", color: COLORS.navy },
        { icon: "📁", name: "Compliance", budget: "$4,000/mo", color: COLORS.navy },
        { icon: "📁", name: "Quantitative Research", budget: "$8,000/mo", color: COLORS.navy },
      ],
      stats: [
        { label: "Desks", value: "6" },
        { label: "DLP patterns", value: "8" },
        { label: "Seed agents", value: "8" },
      ],
    },
  ],

  // Real role presets (from @arm/profiles rolePresets — D8)
  rolePresets: [
    { icon: "🏛️", key: "org_admin", label: "Org Admin", scope: "org root", perms: ["create", "rename", "reparent", "delete"], danger: ["reparent", "delete"], color: COLORS.navy },
    { icon: "🏛️", key: "subsidiary_admin", label: "Subsidiary Admin", scope: "organization", perms: ["create", "rename"], color: COLORS.navy },
    { icon: "🏭", key: "plant_manager", label: "Plant Manager", scope: "plant", perms: ["create", "rename"], color: COLORS.green },
    { icon: "📁", key: "dept_head", label: "Department Head", scope: "department", perms: ["rename"], color: COLORS.navy },
    { icon: "👤", key: "viewer", label: "Viewer", scope: "any", perms: [], color: COLORS.textMuted },
  ],

  // Real governance rules
  governingRules: [
    { key: "no-profile-branching", text: "Runtime code never reads the profile id — profiles set defaults, never gate capabilities" },
    { key: "org_node:reparent", text: "Reparent + delete are org_admin-only — titles don't decide, grants do (Invariant 3/8)" },
    { key: "editable presets", text: "Role presets are seeds — the org_admin reconfigures them at runtime via /admin/roles" },
  ],
};
