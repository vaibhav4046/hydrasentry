import type { CockpitIconKey } from "./cockpitIcons";

/**
 * Castellan Cockpit navigation model, ported from the standalone source.
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
    label: "CONSOLE",
    items: [
      { label: "Incidents", href: "/console", icon: "console" },
      { label: "Rules", href: "/console/rules", icon: "rules" },
    ],
  },
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
      { label: "OWASP ASI Top-10", href: "/standards", icon: "standards" },
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
 * are the source's titleMap / crumbMap with CASTELLAN rebranded to HYDRASENTRY.
 */
export const ROUTE_META: Record<
  string,
  { title: string; section: string; crumb: string }
> = {
  "/console": {
    title: "Incidents",
    section: "Console",
    crumb: "HYDRASENTRY / CONSOLE",
  },
  "/console/keys": {
    title: "API Keys",
    section: "Console",
    crumb: "HYDRASENTRY / CONSOLE / KEYS",
  },
  "/console/rules": {
    title: "Detection Rules",
    section: "Console",
    crumb: "HYDRASENTRY / CONSOLE / RULES",
  },
  "/console/incidents": {
    title: "Incident",
    section: "Console",
    crumb: "HYDRASENTRY / CONSOLE / INCIDENT",
  },
  "/mission": {
    title: "Command",
    section: "Operations",
    crumb: "HYDRASENTRY / OPERATIONS",
  },
  "/replay": {
    title: "Replay",
    section: "Operations",
    crumb: "HYDRASENTRY / REPLAY",
  },
  "/graph": {
    title: "Memory Graph",
    section: "Operations",
    crumb: "HYDRASENTRY / EVIDENCE",
  },
  "/skillmake": {
    title: "SkillMake Verifier",
    section: "Security",
    crumb: "HYDRASENTRY / SKILLS",
  },
  "/mcp": {
    title: "MCP Gateway",
    section: "Security",
    crumb: "HYDRASENTRY / GATEWAY",
  },
  "/standards": {
    title: "OWASP ASI Top-10 Mapping",
    section: "Security",
    crumb: "HYDRASENTRY / STANDARDS",
  },
  "/scheduled": {
    title: "Scheduled Agents",
    section: "Automation",
    crumb: "HYDRASENTRY / AUTOMATION",
  },
  "/results": {
    title: "Findings",
    section: "Automation",
    crumb: "HYDRASENTRY / RESULTS",
  },
  "/settings": {
    title: "Configuration",
    section: "Workspace",
    crumb: "HYDRASENTRY / CONFIG",
  },
};
