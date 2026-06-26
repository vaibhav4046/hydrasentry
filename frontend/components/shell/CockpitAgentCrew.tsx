"use client";

import {
  Brain,
  Play,
  ScanLine,
  ShieldCheck,
  Network,
  FileText,
  RefreshCw,
  CalendarClock,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";

interface AgentDef {
  name: string;
  sub: string;
  Icon: LucideIcon;
}

const AGENTS: AgentDef[] = [
  { name: "Memory Sentinel", sub: "Watches HydraDB context for poison", Icon: Brain },
  { name: "Replay Agent", sub: "Re-runs tasks on clean vs poisoned", Icon: Play },
  { name: "Skill Auditor", sub: "Scans SkillMake skills for unsafe steps", Icon: ScanLine },
  { name: "Policy Guardian", sub: "Flags policy conflicts in memory", Icon: ShieldCheck },
  { name: "MCP Firewall", sub: "Gates context before agents act", Icon: Network },
  { name: "Report Agent", sub: "Compiles signed evidence reports", Icon: FileText },
  { name: "Self Refiner", sub: "Turns findings into regression rules", Icon: RefreshCw },
  { name: "Scheduler Agent", sub: "Runs recurring memory scans", Icon: CalendarClock },
];

interface CockpitAgentCrewProps {
  /** Run is in flight, agents show a working (pulsing) dot. */
  scanning?: boolean;
  /** A run has landed, agents read as actively engaged (brighter dot). */
  engaged?: boolean;
  className?: string;
}

/**
 * The eight-agent crew, laid out as a quiet 2-column roster: a status dot, the
 * agent name, and a one-line role. Dot brightness reflects posture, dim when
 * idle, pulsing while a scan runs, bright once a run is engaged. Monochrome.
 */
export function CockpitAgentCrew({
  scanning = false,
  engaged = false,
  className,
}: CockpitAgentCrewProps) {
  const dotClass = scanning
    ? "bg-white animate-pulse"
    : engaged
      ? "bg-white shadow-[0_0_7px_rgba(255,255,255,0.6)]"
      : "bg-white/40";

  return (
    <div className={cn("grid gap-x-6 gap-y-1 sm:grid-cols-2", className)}>
      {AGENTS.map((agent) => {
        const Icon = agent.Icon;
        return (
          <div
            key={agent.name}
            className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition hover:bg-white/[.03]"
          >
            <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotClass)} />
            <Icon className="h-4 w-4 shrink-0 text-faint" strokeWidth={1.7} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-medium tracking-tight text-ink">
                {agent.name}
              </span>
              <span className="block truncate text-[11.5px] leading-snug text-muted">
                {agent.sub}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
