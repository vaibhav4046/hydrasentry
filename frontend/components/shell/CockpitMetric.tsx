"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useInView } from "framer-motion";
import { cn } from "@/lib/cn";

interface CockpitMetricProps {
  /** Tiny uppercase label, e.g. "RISK SCORE". */
  label: string;
  /** Big display value, e.g. "87", "·", "2026-06-25". */
  value: string;
  /** Small sub line under the value. */
  sub?: string;
  /**
   * If set, the leading number counts up from 0 on view; the non-numeric
   * remainder of `value` is appended verbatim. Omit for static values.
   */
  countTo?: number;
  className?: string;
}

/**
 * Cockpit metric tile: a big number with a tiny uppercase label and a small sub
 * line, on a flat hairline card. The flagship Command-row primitive. Optional
 * count-up respects reduced motion (jumps to final).
 */
export function CockpitMetric({
  label,
  value,
  sub,
  countTo,
  className,
}: CockpitMetricProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const [counted, setCounted] = useState<string | null>(null);

  useEffect(() => {
    if (countTo === undefined || !inView) return;
    const controls = animate(0, countTo, {
      duration: 1,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setCounted(formatCount(v, value)),
    });
    return () => controls.stop();
  }, [countTo, inView, value]);

  // Static values render verbatim; counting values show the animated number once
  // it has started, otherwise the zeroed template (avoids a flash of the final
  // value before the count-up runs).
  const display =
    countTo === undefined ? value : (counted ?? formatCount(0, value));

  return (
    <div ref={ref} className={cn("cockpit-card cockpit-card-hover p-5", className)}>
      <div className="cockpit-eyebrow">{label}</div>
      <div className="cockpit-display mt-3 text-[2rem] font-semibold leading-none text-ink tabular-nums">
        {display}
      </div>
      {sub && <div className="mt-2 text-[12px] leading-snug text-muted">{sub}</div>}
    </div>
  );
}

/** Replace the leading integer of `template` with the rounded count value. */
function formatCount(current: number, template: string): string {
  const match = template.match(/^(\d[\d,]*)(.*)$/);
  if (!match) return template;
  const rest = match[2] ?? "";
  return `${Math.round(current).toLocaleString()}${rest}`;
}
