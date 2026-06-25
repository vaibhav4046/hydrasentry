"use client";

import { cn } from "@/lib/cn";

export interface ActivityLine {
  /** Short mono timestamp, e.g. "02:14:08". */
  time: string;
  /** Log text. */
  text: string;
  /** Emphasize as a notable/critical line (brighter). */
  bright?: boolean;
}

interface CockpitActivityLogProps {
  lines: ActivityLine[];
  className?: string;
}

/**
 * Mono, timestamped activity feed for the Command page. Flat card, hairline
 * rows, dim timestamps. Brighter rows mark notable events (risk verdict,
 * firewall decision). Reads from live run stages / findings.
 */
export function CockpitActivityLog({ lines, className }: CockpitActivityLogProps) {
  return (
    <div className={cn("flex flex-col", className)}>
      {lines.map((line, i) => (
        <div
          key={i}
          className="flex items-baseline gap-3 border-b border-hairline/60 py-1.5 last:border-b-0"
        >
          <span className="mono shrink-0 text-[11px] tabular-nums text-faint">
            {line.time}
          </span>
          <span
            className={cn(
              "mono text-[12px] leading-relaxed",
              line.bright ? "text-ink" : "text-muted",
            )}
          >
            {line.text}
          </span>
        </div>
      ))}
    </div>
  );
}
