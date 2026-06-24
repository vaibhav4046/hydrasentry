"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useInView } from "framer-motion";
import { GlassPanel } from "./GlassPanel";
import { cn } from "@/lib/cn";

interface MetricCardProps {
  label: string;
  /** Final display value, e.g. "87/100" or "124". */
  value: string;
  sub?: string;
  /**
   * If set, the leading number animates from 0 to this on view. The non-numeric
   * remainder of `value` (e.g. "/100") is appended verbatim. Leave undefined to
   * render `value` statically.
   */
  countTo?: number;
  className?: string;
}

/**
 * Compact metric tile (label / value / sub). Optional count-up animates the
 * numeric prefix on scroll-in and respects reduced motion (jumps to final).
 */
export function MetricCard({
  label,
  value,
  sub,
  countTo,
  className,
}: MetricCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const [display, setDisplay] = useState<string>(
    countTo !== undefined ? formatCount(0, value) : value,
  );

  useEffect(() => {
    if (countTo === undefined || !inView) return;
    const controls = animate(0, countTo, {
      duration: 1.1,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(formatCount(v, value)),
    });
    return () => controls.stop();
  }, [countTo, inView, value]);

  return (
    <GlassPanel ref={ref} className={cn("p-5", className)}>
      <div className="mono text-[11px] uppercase tracking-[0.16em] text-faint">
        {label}
      </div>
      <div className="mt-2 text-3xl font-semibold tracking-tight text-ink tabular-nums">
        {display}
      </div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </GlassPanel>
  );
}

/** Replace the leading integer of `template` with the rounded count value. */
function formatCount(current: number, template: string): string {
  const match = template.match(/^(\d[\d,]*)(.*)$/);
  if (!match) return template;
  const rest = match[2] ?? "";
  return `${Math.round(current).toLocaleString()}${rest}`;
}
