"use client";

import { Database, GitGraph } from "lucide-react";
import { cn } from "@/lib/cn";
import type { GraphSource } from "@/lib/types";

/**
 * How a REAL HydraDB graph was obtained, when `source` is real_query_paths:
 *  - "live"     genuine just-now query against HydraDB (proven by query_ms);
 *  - "captured" a real proof artifact captured offline, replayed honestly.
 * Ignored when the source is derived (the badge then reads DERIVED).
 */
export type GraphLiveness = "live" | "captured";

interface GraphSourceBadgeProps {
  source: GraphSource;
  /** Only meaningful when source is real_query_paths. Defaults to "captured". */
  liveness?: GraphLiveness;
  className?: string;
}

/**
 * Mandatory honesty indicator. Reads artifact.graph_source verbatim and shows
 * whether the graph came from REAL HydraDB query_paths or a DERIVED scenario
 * fallback. For real graphs it further distinguishes a genuine LIVE query from a
 * CAPTURED proof artifact, so a LIVE label is shown only for a real just-now
 * traversal, never for the captured sample or the derived fallback. Real =
 * brighter/solid; derived = dimmer/outlined. This is the line that keeps the
 * demo honest in front of judges, so it is always visible.
 */
export function GraphSourceBadge({
  source,
  liveness = "captured",
  className,
}: GraphSourceBadgeProps) {
  const isReal = source === "real_query_paths";
  const isLive = isReal && liveness === "live";
  const Icon = isReal ? Database : GitGraph;

  const label = isReal
    ? isLive
      ? "Real HydraDB query_paths · LIVE"
      : "Real HydraDB query_paths · captured"
    : "Derived scenario graph fallback";

  const title = isReal
    ? isLive
      ? "Graph built from a genuine, just-now HydraDB query_paths traversal"
      : "Graph from a real HydraDB query_paths run, captured offline as a proof artifact"
    : "Graph derived from the scenario fixture (HydraDB not in real mode)";

  return (
    <span
      className={cn(
        "mono inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] uppercase tracking-[0.16em]",
        isReal
          ? "border-white/70 bg-white/[.1] text-ink shadow-[0_0_16px_rgba(255,255,255,0.18)]"
          : "border-hairline-strong bg-white/[.03] text-muted",
        className,
      )}
      title={title}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
      {label}
    </span>
  );
}
