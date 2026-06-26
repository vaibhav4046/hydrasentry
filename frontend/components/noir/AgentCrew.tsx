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
import { m } from "framer-motion";
import { cn } from "@/lib/cn";
import { fadeUp, staggerContainer } from "@/lib/motion";

export interface AgentDef {
  name: string;
  role: string;
  Icon: LucideIcon;
}

interface AgentCrewProps {
  agents?: AgentDef[];
  className?: string;
}

const DEFAULT_AGENTS: AgentDef[] = [
  { name: "Memory Sentinel", role: "Watches HydraDB context for poison", Icon: Brain },
  { name: "Replay Agent", role: "Re-runs tasks on clean vs poisoned", Icon: Play },
  { name: "Skill Auditor", role: "Scans SkillMake skills for unsafe steps", Icon: ScanLine },
  { name: "Policy Guardian", role: "Flags policy conflicts in memory", Icon: ShieldCheck },
  { name: "MCP Firewall", role: "Gates context before agents act", Icon: Network },
  { name: "Report Agent", role: "Compiles signed evidence reports", Icon: FileText },
  { name: "Self Refiner", role: "Turns findings into regression rules", Icon: RefreshCw },
  { name: "Scheduler Agent", role: "Runs recurring memory scans", Icon: CalendarClock },
];

/**
 * Grid of the eight HydraSentry agents. Each tile is a glass card with a
 * monochrome line icon, name, and one-line role. Staggered reveal + hover lift.
 */
export function AgentCrew({ agents = DEFAULT_AGENTS, className }: AgentCrewProps) {
  return (
    <m.div
      variants={staggerContainer}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-60px" }}
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4",
        className,
      )}
    >
      {agents.map((agent) => {
        const Icon = agent.Icon;
        return (
          <m.div
            key={agent.name}
            variants={fadeUp}
            whileHover={{ y: -3 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="hydra-glass rounded-xl2 flex flex-col gap-3 p-5"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-hairline bg-white/[.04]">
              <Icon className="h-5 w-5 text-ink" strokeWidth={1.6} />
            </span>
            <div>
              <div className="text-[15px] font-semibold tracking-tight text-ink">
                {agent.name}
              </div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
                {agent.role}
              </p>
            </div>
          </m.div>
        );
      })}
    </m.div>
  );
}
