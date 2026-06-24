"use client";

import { Database, GitGraph } from "lucide-react";
import { cn } from "@/lib/cn";
import type { GraphSource } from "@/lib/types";

interface GraphSourceBadgeProps {
  source: GraphSource;
  className?: string;
}

/**
 * Mandatory honesty indicator. Reads artifact.graph_source verbatim and shows
 * whether the graph came from REAL HydraDB query_paths or a DERIVED scenario
 * fallback. Real = brighter/solid; derived = dimmer/outlined. This is the line
 * that keeps the demo honest in front of judges, so it is always visible.
 */
export function GraphSourceBadge({ source, className }: GraphSourceBadgeProps) {
  const isReal = source === "real_query_paths";
  const Icon = isReal ? Database : GitGraph;
  return (
    <span
      className={cn(
        "mono inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] uppercase tracking-[0.16em]",
        isReal
          ? "border-white/70 bg-white/[.1] text-ink shadow-[0_0_16px_rgba(255,255,255,0.18)]"
          : "border-hairline-strong bg-white/[.03] text-muted",
        className,
      )}
      title={
        isReal
          ? "Graph built from live HydraDB query_paths"
          : "Graph derived from the scenario fixture (HydraDB not in real mode)"
      }
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
      {isReal ? "Real HydraDB query_paths" : "Derived scenario graph fallback"}
    </span>
  );
}
