import type { CockpitIconKey } from "./cockpitIcons";

/**
 * Castellan Cockpit navigation model — ported from the standalone source.
 * Grouped sections (OPERATIONS / SECURITY / AUTOMATION / WORKSPACE) with tiny
 * uppercase mono labels; each item maps a cockpit label to an existing dashboard
 * route, with the source's exact icon glyph and count badge. Badges echo the
 * demo posture (5 replays, 7 MCP tools, 6 scheduled agents); the SkillMake and
 * Findings badges show "1" only once a run is engaged (handled in the sidebar).
 */
export interface CockpitNavItem {
  /** Sidebar label (matches the source's LBL map). */
  label: string;
  href: string;
  /** Source icon glyph key. */
  icon: CockpitIconKey;
  /** Static count badge, if any. */
  badge?: string;
  /** Badge only shows once a run is engaged (poisoned posture). */
  badgeWhenEngaged?: boolean;
}

export interface CockpitNavGroup {
  /** Tiny uppercase mono section label. */
  label: string;
  items: CockpitNavItem[];
}

export const COCKPIT_NAV: CockpitNavGroup[] = [
  {
    label: "OPERATIONS",
    items: [
      { label: "Observatory", href: "/mission", icon: "mission" },
      { label: "Replay Lab", href: "/replay", icon: "replay", badge: "5" },
      { label: "Context Graph", href: "/graph", icon: "graph" },
    ],
  },
  {
    label: "SECURITY",
    items: [
      {
        label: "SkillMake Verifier",
        href: "/skillmake",
        icon: "skill",
        badge: "1",
        badgeWhenEngaged: true,
      },
      { label: "MCP Gateway", href: "/mcp", icon: "mcp", badge: "7" },
    ],
  },
  {
    label: "AUTOMATION",
    items: [
      { label: "Scheduled Agents", href: "/scheduled", icon: "scheduled", badge: "6" },
      {
        label: "Results Center",
        href: "/results",
        icon: "results",
        badge: "1",
        badgeWhenEngaged: true,
      },
    ],
  },
  {
    label: "WORKSPACE",
    items: [{ label: "Configuration", href: "/settings", icon: "settings" }],
  },
];

/**
 * Flat route -> { title, crumb } lookup for the top bar. Titles and breadcrumbs
 * are the source's titleMap / crumbMap with CASTELLAN rebranded to CONSTELLAN.
 */
export const ROUTE_META: Record<
  string,
  { title: string; section: string; crumb: string }
> = {
  "/mission": {
    title: "Command",
    section: "Operations",
    crumb: "CONSTELLAN / OPERATIONS",
  },
  "/replay": {
    title: "Replay",
    section: "Operations",
    crumb: "CONSTELLAN / REPLAY",
  },
  "/graph": {
    title: "Memory Graph",
    section: "Operations",
    crumb: "CONSTELLAN / EVIDENCE",
  },
  "/skillmake": {
    title: "SkillMake Verifier",
    section: "Security",
    crumb: "CONSTELLAN / SKILLS",
  },
  "/mcp": {
    title: "MCP Gateway",
    section: "Security",
    crumb: "CONSTELLAN / GATEWAY",
  },
  "/scheduled": {
    title: "Scheduled Agents",
    section: "Automation",
    crumb: "CONSTELLAN / AUTOMATION",
  },
  "/results": {
    title: "Findings",
    section: "Automation",
    crumb: "CONSTELLAN / RESULTS",
  },
  "/settings": {
    title: "Configuration",
    section: "Workspace",
    crumb: "CONSTELLAN / CONFIG",
  },
};
