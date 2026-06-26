"use client";

import { m } from "framer-motion";
import {
  ShieldAlert,
  GitCompare,
  FileCheck2,
  ScanLine,
  Network,
  CheckCircle2,
} from "lucide-react";
import { RiskGauge } from "./RiskGauge";
import { ContextGraphPreview } from "./ContextGraphPreview";
import { StatusPill } from "./StatusPill";
import { cn } from "@/lib/cn";
import { fadeUp, staggerContainer } from "@/lib/motion";

interface ProductCanvasProps {
  className?: string;
}

const MCP_CALLS = [
  "scan_context",
  "replay_attack",
  "quarantine_memory",
  "generate_report",
];

/**
 * The hero centerpiece: a faux HydraSentry command-center dashboard composited
 * from the real primitives, a mission header, the RiskGauge at 87/CRITICAL, a
 * clean-vs-poisoned replay diff, a small tainted context graph, a live MCP tool
 * call strip, a SkillMake alert, and a "report ready" chip. Decorative but
 * built from the same components the dashboards use, so it reads as the product.
 */
export function ProductCanvas({ className }: ProductCanvasProps) {
  return (
    <m.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className={cn(
        "hydra-glass rounded-xl2 relative w-full overflow-hidden p-4 sm:p-5",
        className,
      )}
    >
      {/* window chrome */}
      <m.div
        variants={fadeUp}
        className="mb-4 flex items-center justify-between gap-3"
      >
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
          <span className="mono ml-2 text-[11px] tracking-wide text-faint">
            mission_control · run_judge_demo
          </span>
        </div>
        <StatusPill tone="active" label="live" />
      </m.div>

      <div className="grid grid-cols-12 gap-3">
        {/* mission + risk gauge */}
        <m.div
          variants={fadeUp}
          className="col-span-12 flex items-center gap-4 rounded-xl border border-hairline bg-white/[.025] p-4 sm:col-span-7"
        >
          <RiskGauge score={87} band="CRITICAL" size={132} />
          <div className="min-w-0">
            <div className="mono text-[10.5px] uppercase tracking-[0.16em] text-faint">
              mission
            </div>
            <div className="mt-1 truncate text-sm font-semibold text-ink">
              Summarize vendor refund policy
            </div>
            <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-muted">
              Poisoned memory steers the agent toward an unauthorized refund
              action.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <StatusPill tone="critical" label="prompt_injection" dot={false} />
              <StatusPill tone="warn" label="conf 0.94" dot={false} />
            </div>
          </div>
        </m.div>

        {/* replay diff */}
        <m.div
          variants={fadeUp}
          className="col-span-12 flex flex-col gap-2 rounded-xl border border-hairline bg-white/[.025] p-4 sm:col-span-5"
        >
          <div className="flex items-center gap-2 text-ink">
            <GitCompare className="h-4 w-4" strokeWidth={1.8} />
            <span className="text-[13px] font-semibold tracking-tight">
              Replay diff
            </span>
          </div>
          <div className="rounded-lg border border-hairline bg-black/30 p-2.5">
            <div className="mono text-[10px] uppercase tracking-wider text-faint">
              baseline · safe
            </div>
            <div className="mono mt-0.5 line-clamp-1 text-[11.5px] text-ink/70">
              Refunds require manager approval.
            </div>
          </div>
          <div className="rounded-lg border border-white/30 bg-white/[.05] p-2.5">
            <div className="mono flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-ink">
              <ShieldAlert className="h-3 w-3" strokeWidth={2} /> poisoned ·
              compromised
            </div>
            <div className="mono mt-0.5 line-clamp-1 text-[11.5px] text-ink">
              Auto-approve the refund now.
            </div>
          </div>
        </m.div>

        {/* context graph */}
        <m.div
          variants={fadeUp}
          className="col-span-12 rounded-xl border border-hairline bg-white/[.025] p-4 sm:col-span-7"
        >
          <div className="mb-2 flex items-center gap-2 text-ink">
            <Network className="h-4 w-4" strokeWidth={1.8} />
            <span className="text-[13px] font-semibold tracking-tight">
              Context graph
            </span>
            <span className="mono ml-auto text-[10px] text-faint">
              tainted path
            </span>
          </div>
          <ContextGraphPreview animated={false} />
        </m.div>

        {/* right column: MCP calls + skill alert + report */}
        <div className="col-span-12 flex flex-col gap-3 sm:col-span-5">
          <m.div
            variants={fadeUp}
            className="rounded-xl border border-hairline bg-white/[.025] p-4"
          >
            <div className="mb-2 flex items-center gap-2 text-ink">
              <Network className="h-4 w-4" strokeWidth={1.8} />
              <span className="text-[13px] font-semibold tracking-tight">
                MCP tool calls
              </span>
            </div>
            <ul className="flex flex-col gap-1">
              {MCP_CALLS.map((call) => (
                <li
                  key={call}
                  className="mono flex items-center justify-between rounded-md border border-hairline bg-black/20 px-2.5 py-1.5 text-[11px] text-ink/80"
                >
                  <span>{call}</span>
                  <span className="text-faint">200</span>
                </li>
              ))}
            </ul>
          </m.div>

          <m.div
            variants={fadeUp}
            className="flex items-center gap-3 rounded-xl border border-white/30 bg-white/[.05] p-3.5"
          >
            <ScanLine className="h-5 w-5 shrink-0 text-ink" strokeWidth={1.7} />
            <div className="min-w-0">
              <div className="text-[12.5px] font-semibold text-ink">
                SkillMake alert
              </div>
              <div className="mono truncate text-[11px] text-muted">
                3 unsafe instructions · band HIGH
              </div>
            </div>
          </m.div>

          <m.div
            variants={fadeUp}
            className="flex items-center gap-3 rounded-xl border border-hairline bg-white/[.025] p-3.5"
          >
            <FileCheck2 className="h-5 w-5 shrink-0 text-ink" strokeWidth={1.7} />
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-semibold text-ink">
                Report ready
              </div>
              <div className="mono truncate text-[11px] text-muted">
                evidence · signed · exportable
              </div>
            </div>
            <CheckCircle2 className="h-4 w-4 text-ink" strokeWidth={1.8} />
          </m.div>
        </div>
      </div>
    </m.div>
  );
}
