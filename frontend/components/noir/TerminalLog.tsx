"use client";

import { m } from "framer-motion";
import { cn } from "@/lib/cn";
import { staggerContainer, terminalLineReveal } from "@/lib/motion";

interface TerminalLogProps {
  /** Lines to render. Falls back to a representative MCP scan trace. */
  lines?: string[];
  title?: string;
  className?: string;
  /** Replay the reveal each time it scrolls into view (default once). */
  replayOnView?: boolean;
}

const DEFAULT_LINES = [
  "POST /mcp/scan_context 200 OK",
  "HydraDB query graph_context=true",
  "query_paths: 4 groups returned",
  "tainted source_chunk_id: mem_poison_047",
  "risk score=87 band=CRITICAL",
  "decision: block | action: quarantine",
];

/**
 * Monospace terminal panel that types its lines in one-by-one (staggered
 * reveal). Numbered gutter. Inherits reduced-motion from MotionConfig.
 */
export function TerminalLog({
  lines = DEFAULT_LINES,
  title = "mcp_gateway.log",
  className,
  replayOnView = false,
}: TerminalLogProps) {
  return (
    <div
      className={cn(
        "hydra-glass rounded-xl2 overflow-hidden",
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-hairline px-4 py-2.5">
        <span className="h-2 w-2 rounded-full bg-white/25" />
        <span className="h-2 w-2 rounded-full bg-white/15" />
        <span className="h-2 w-2 rounded-full bg-white/10" />
        <span className="mono ml-2 text-[11px] tracking-wide text-faint">
          {title}
        </span>
      </div>
      <m.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="show"
        viewport={{ once: !replayOnView, margin: "-40px" }}
        className="mono space-y-1 bg-black/40 p-4 text-xs text-muted"
      >
        {lines.map((line, i) => (
          <m.div
            key={`${i}-${line}`}
            variants={terminalLineReveal}
            className="flex gap-3 py-0.5"
          >
            <span className="select-none text-faint">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="text-ink/85">{line}</span>
          </m.div>
        ))}
      </m.div>
    </div>
  );
}
