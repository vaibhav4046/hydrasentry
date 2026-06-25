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
  Skull,
  FileWarning,
  Building2,
  TerminalSquare,
  Wrench,
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
  { label: "Threat Model", href: "#use-cases" },
  { label: "Pipeline", href: "#pipeline" },
  { label: "Replay Lab", href: "#timeline" },
  { label: "Capabilities", href: "#features" },
  { label: "Architecture", href: "#architecture" },
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

/**
 * Trust marquee row — the primitives HydraSentry speaks natively. Rendered as
 * an auto-scrolling monochrome strip (the wordmarks/icons of the stack it
 * secures), Railway-style but noir.
 */
export const TRUST_PRIMITIVES: PrimitiveDef[] = PRIMITIVES;

export interface UseCaseDef {
  title: string;
  description: string;
  Icon: LucideIcon;
  /** Short mono tag shown in the card corner (the attack class). */
  tag: string;
  /** Make this the wide hero tile in the bento. */
  wide?: boolean;
}

/**
 * Five context-attack classes HydraSentry catches — adapted from HydraDB's
 * use-case bento to our security framing. The first tile spans wide.
 */
export const USE_CASES: UseCaseDef[] = [
  {
    title: "Poisoned Memory",
    description:
      "An attacker writes a malicious memory that survives into a later task and steers the agent toward an unsafe action. HydraSentry replays clean vs poisoned context and pins the exact tainted node.",
    Icon: Skull,
    tag: "memory_poisoning",
    wide: true,
  },
  {
    title: "Stale Policy",
    description:
      "A revoked rule or expired approval lingers in context and the agent still honors it. The graph diff shows which retired memory drove the decision.",
    Icon: FileWarning,
    tag: "stale_policy",
  },
  {
    title: "Cross-Tenant Leak",
    description:
      "Context from one tenant bleeds into another's query_paths. HydraSentry proves isolation per run and flags any path that crosses the boundary.",
    Icon: Building2,
    tag: "tenant_isolation",
  },
  {
    title: "Unsafe Skills",
    description:
      "A SkillMake skill ships an instruction that exfiltrates data or escalates privilege. The verifier scans it line-by-line and scores it before agents load it.",
    Icon: TerminalSquare,
    tag: "skill_injection",
  },
  {
    title: "Unsafe Tool Calls",
    description:
      "The agent is about to call a tool with poisoned arguments. The MCP firewall allows, warns, blocks, or quarantines the call before it executes.",
    Icon: Wrench,
    tag: "tool_call_firewall",
  },
];

export interface CompareRow {
  capability: string;
  /** What a prompt-level tester gives you. */
  promptLevel: string;
  /** What HydraSentry gives you. */
  hydrasentry: string;
}

/**
 * Comparison framing (HydraDB-style): prompt-level eval tools tell you a prompt
 * failed; HydraSentry shows the graph anatomy of how poisoned context reached
 * the agent.
 */
export const COMPARE_HEADLINE =
  "Promptfoo tells you a prompt failed. HydraSentry shows the graph anatomy of how poisoned context reached the agent.";

export const COMPARE_ROWS: CompareRow[] = [
  {
    capability: "Failure signal",
    promptLevel: "A prompt scored badly",
    hydrasentry: "The exact query_paths node that poisoned the run",
  },
  {
    capability: "Unit of test",
    promptLevel: "Prompt / response pair",
    hydrasentry: "Clean vs poisoned context replay of the whole task",
  },
  {
    capability: "Memory layer",
    promptLevel: "Out of scope",
    hydrasentry: "HydraDB query_paths reconstructed and diffed",
  },
  {
    capability: "Enforcement",
    promptLevel: "None — reporting only",
    hydrasentry: "MCP firewall: allow / warn / block / quarantine",
  },
  {
    capability: "Evidence",
    promptLevel: "A score in a table",
    hydrasentry: "Signed report with risk, graph, and decision trail",
  },
];

export interface PipelineStep {
  label: string;
  /** Short mono detail under the label. */
  detail: string;
  /** Marks the steps where poison is present / the run is unsafe. */
  tainted?: boolean;
}

/**
 * The deterministic pipeline rendered as an animated monochrome node-flow.
 * "tainted" steps carry the poison and read brighter / dashed in the diagram.
 */
export const PIPELINE: PipelineStep[] = [
  { label: "Seed clean context", detail: "owned tenant" },
  { label: "Baseline replay", detail: "LOW · escalates" },
  { label: "Inject poison", detail: "mem_poison_047", tainted: true },
  { label: "Poisoned replay", detail: "87 · HIGH", tainted: true },
  { label: "Extract query_paths", detail: "graph diff", tainted: true },
  { label: "Score risk", detail: "deterministic" },
  { label: "MCP firewall", detail: "block" },
  { label: "Quarantine", detail: "isolate node" },
  { label: "Report", detail: "signed .md" },
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
