import {
  Crosshair,
  Play,
  Network,
  ScanLine,
  ShieldCheck,
  CalendarClock,
  ListChecks,
  Settings,
  type LucideIcon,
} from "lucide-react";

/**
 * Castellan Cockpit navigation model. Grouped sections with tiny uppercase
 * labels; each item maps a cockpit label to an existing dashboard route. Badges
 * are static counts that echo the demo posture (replays queued, MCP tools,
 * scheduled agents) — purely informational, monochrome.
 */
export interface CockpitNavItem {
  label: string;
  href: string;
  Icon: LucideIcon;
  /** Optional count badge. */
  badge?: number;
}

export interface CockpitNavGroup {
  /** Tiny uppercase section label. */
  label: string;
  items: CockpitNavItem[];
}

export const COCKPIT_NAV: CockpitNavGroup[] = [
  {
    label: "Operations",
    items: [
      { label: "Command", href: "/mission", Icon: Crosshair },
      { label: "Replay", href: "/replay", Icon: Play, badge: 5 },
      { label: "Memory Graph", href: "/graph", Icon: Network },
    ],
  },
  {
    label: "Security",
    items: [
      { label: "SkillMake Verifier", href: "/skillmake", Icon: ScanLine },
      { label: "MCP Gateway", href: "/mcp", Icon: ShieldCheck, badge: 7 },
    ],
  },
  {
    label: "Automation",
    items: [
      { label: "Scheduled Agents", href: "/scheduled", Icon: CalendarClock, badge: 6 },
      { label: "Findings", href: "/results", Icon: ListChecks },
    ],
  },
  {
    label: "Workspace",
    items: [{ label: "Configuration", href: "/settings", Icon: Settings }],
  },
];

/** Flat lookup of route -> cockpit label, for the top-bar breadcrumb/title. */
export const ROUTE_META: Record<string, { title: string; section: string }> = {
  "/mission": { title: "Command", section: "Operations" },
  "/replay": { title: "Replay", section: "Operations" },
  "/graph": { title: "Memory Graph", section: "Operations" },
  "/skillmake": { title: "SkillMake Verifier", section: "Security" },
  "/mcp": { title: "MCP Gateway", section: "Security" },
  "/scheduled": { title: "Scheduled Agents", section: "Automation" },
  "/results": { title: "Findings", section: "Automation" },
  "/settings": { title: "Configuration", section: "Workspace" },
};
