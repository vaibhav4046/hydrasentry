/**
 * Static content for the landing page. Hero/feature/metric strings are taken
 * verbatim from docs/assets/.../copy/ui-copy.json so design copy stays
 * authoritative. Feature/primitive blurbs are written to match the brief.
 */
import {
  Play,
  Network,
  ScanLine,
  CalendarClock,
  FileText,
  GitBranch,
  Database,
  ServerCog,
  ShieldHalf,
  Repeat,
  type LucideIcon,
} from "lucide-react";

export const HERO = {
  kicker: "HYDRADB NATIVE · CONTEXT INTEGRITY · MCP SECURITY",
  headline: "Secure the memory layer before your agent acts.",
  subcopy:
    "HydraSentry replays agent tasks against clean and poisoned HydraDB context, visualizes the exact graph path that caused failure, blocks unsafe memory through MCP, and exports evidence reports.",
  primaryCta: "Run Judge Demo",
  secondaryCta: "View Architecture",
} as const;

export const NAV_LINKS: { label: string; href: string }[] = [
  { label: "Product", href: "#product" },
  { label: "Architecture", href: "#architecture" },
  { label: "Replay Lab", href: "#timeline" },
  { label: "SkillMake", href: "#features" },
  { label: "MCP", href: "#features" },
  { label: "Docs", href: "#architecture" },
  { label: "GitHub", href: "https://github.com" },
];

export interface PrimitiveDef {
  label: string;
  Icon: LucideIcon;
}

export const PRIMITIVES: PrimitiveDef[] = [
  { label: "HydraDB query_paths", Icon: Database },
  { label: "MCP Gateway", Icon: ServerCog },
  { label: "SkillMake Verifier", Icon: ScanLine },
  { label: "Replay Harness", Icon: Repeat },
  { label: "Context Firewall", Icon: ShieldHalf },
  { label: "Regression Rules", Icon: GitBranch },
  { label: "Evidence Reports", Icon: FileText },
];

export interface FeatureDef {
  title: string;
  description: string;
  Icon: LucideIcon;
}

/** Titles match ui-copy.json features[]; descriptions expand each. */
export const FEATURES: FeatureDef[] = [
  {
    title: "Replay Attacks",
    description:
      "Re-run the same agent task against clean and poisoned HydraDB context to prove exactly when behavior changes.",
    Icon: Play,
  },
  {
    title: "Graph Evidence",
    description:
      "Reconstruct the query_paths the agent traversed and highlight the tainted path that drove the unsafe action.",
    Icon: Network,
  },
  {
    title: "Context Firewall",
    description:
      "Allow, warn, block, or quarantine context before the agent acts — with manual, copilot, and autopilot modes.",
    Icon: ShieldHalf,
  },
  {
    title: "SkillMake Verification",
    description:
      "Scan SkillMake skills line-by-line for unsafe instructions and score them before they ship to agents.",
    Icon: ScanLine,
  },
  {
    title: "MCP Gateway",
    description:
      "Expose scanning, replay, quarantine, and reporting as authenticated MCP tools any agent runtime can call.",
    Icon: ServerCog,
  },
  {
    title: "Scheduled Scans",
    description:
      "Run recurring memory and skill scans on a schedule so poisoning is caught between releases, not after.",
    Icon: CalendarClock,
  },
  {
    title: "Regression Rules",
    description:
      "Turn every accepted finding into a deterministic rule and a regression scenario that guards future runs.",
    Icon: GitBranch,
  },
  {
    title: "Evidence Reports",
    description:
      "Export signed, human-readable incident reports with the risk score, graph, and decision trail attached.",
    Icon: FileText,
  },
];

export interface ArchLayer {
  label: string;
  items: string[];
}

export const ARCH_FLOW: ArchLayer[] = [
  { label: "Frontend", items: ["Command center", "Replay lab", "Graph viewer"] },
  { label: "API", items: ["FastAPI", "SSE stages", "JSON envelope"] },
  { label: "Scenario Engine", items: ["Orchestrates the pipeline"] },
];

export const ARCH_ENGINES: string[] = [
  "HydraDB adapter",
  "Risk Engine",
  "Graph Extractor",
  "SkillMake Scanner",
  "MCP Gateway",
];

export interface ArchStat {
  value: string;
  label: string;
}

export const ARCH_STATS: ArchStat[] = [
  { value: "90%+", label: "attack detection" },
  { value: "<200ms", label: "firewall decision" },
  { value: "100%", label: "tenant isolation" },
  { value: "∞", label: "context depth" },
];

export const METRICS: { label: string; value: string; countTo?: number }[] = [
  { label: "Risk Score", value: "87/100", countTo: 87 },
  { label: "Memories Scanned", value: "124", countTo: 124 },
  { label: "Skills Verified", value: "8", countTo: 8 },
  { label: "Quarantined", value: "12", countTo: 12 },
];
