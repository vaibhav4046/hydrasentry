"use client";

import { m } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { staggerContainer, fadeUp } from "@/lib/motion";
import type { Triplet } from "@/lib/types";

interface TripletListProps {
  triplets: Triplet[];
  className?: string;
}

/**
 * Renders the graph's query_paths as a mono list of source -> relation -> target
 * triplets. Tainted triplets are emphasized (brighter, heavier left rule, the
 * tainted chunk id shown); clean ones recede. This is the raw evidence behind
 * the visual graph.
 */
export function TripletList({ triplets, className }: TripletListProps) {
  if (triplets.length === 0) {
    return (
      <p className="mono text-xs text-faint">No query_paths returned.</p>
    );
  }
  return (
    <m.ul
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className={cn("flex flex-col gap-2", className)}
    >
      {triplets.map((t, i) => (
        <m.li
          key={`${t.source}-${t.relation}-${t.target}-${i}`}
          variants={fadeUp}
          className={cn(
            "mono flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border-l-2 px-3 py-2 text-[12px]",
            t.tainted
              ? "border-l-white bg-white/[.06] text-ink"
              : "border-l-white/15 bg-white/[.02] text-muted",
          )}
        >
          <span className="text-ink/90">{t.source}</span>
          <ArrowRight className="h-3 w-3 text-faint" strokeWidth={2} />
          <span className={cn(t.tainted ? "text-ink" : "text-muted")}>
            {t.relation}
          </span>
          <ArrowRight className="h-3 w-3 text-faint" strokeWidth={2} />
          <span className="text-ink/90">{t.target}</span>
          {t.tainted && t.source_chunk_id && (
            <span className="ml-auto rounded border border-white/40 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-ink">
              {t.source_chunk_id}
            </span>
          )}
        </m.li>
      ))}
    </m.ul>
  );
}
