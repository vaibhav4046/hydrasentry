"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useInView } from "framer-motion";
import { cn } from "@/lib/cn";
import type { RiskBand } from "@/lib/types";

interface RiskGaugeProps {
  /** 0-100. */
  score: number;
  band?: RiskBand;
  /** SVG square size in px. */
  size?: number;
  label?: string;
  className?: string;
}

const BAND_FROM_SCORE = (s: number): RiskBand =>
  s >= 80 ? "CRITICAL" : s >= 60 ? "HIGH" : s >= 35 ? "MEDIUM" : "LOW";

// Monochrome: higher risk = brighter, thicker arc. No hue.
const BAND_STROKE: Record<RiskBand, string> = {
  LOW: "rgba(255,255,255,0.45)",
  MEDIUM: "rgba(255,255,255,0.62)",
  HIGH: "rgba(255,255,255,0.8)",
  CRITICAL: "rgba(255,255,255,0.98)",
};
const BAND_WIDTH: Record<RiskBand, number> = {
  LOW: 8,
  MEDIUM: 9,
  HIGH: 10,
  CRITICAL: 12,
};

const START_ANGLE = 135; // degrees; 270deg sweep open at the bottom.
const SWEEP = 270;

/**
 * Monochrome SVG risk gauge: a 270deg arc whose fill fraction = score/100.
 * Severity is expressed by stroke brightness + width (never color). The number
 * counts up on scroll-in. Reduced motion jumps straight to the value.
 */
export function RiskGauge({
  score,
  band,
  size = 200,
  label = "RISK SCORE",
  className,
}: RiskGaugeProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, score, {
      duration: 1.1,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setValue(v),
    });
    return () => controls.stop();
  }, [inView, score]);

  const resolvedBand = band ?? BAND_FROM_SCORE(score);
  const stroke = BAND_STROKE[resolvedBand];
  const strokeWidth = BAND_WIDTH[resolvedBand];

  const r = (size - strokeWidth * 2) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const arcLength = (SWEEP / 360) * circumference;
  const filled = (value / 100) * arcLength;

  return (
    <div
      ref={ref}
      className={cn("relative inline-flex flex-col items-center", className)}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="block"
      >
        <g transform={`rotate(${START_ANGLE} ${cx} ${cy})`}>
          {/* track */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${arcLength} ${circumference}`}
          />
          {/* value arc */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circumference}`}
            style={{ filter: "drop-shadow(0 0 8px rgba(255,255,255,0.35))" }}
          />
        </g>
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-semibold tabular-nums tracking-tight text-ink">
          {Math.round(value)}
        </span>
        <span className="mono mt-1 text-[10px] uppercase tracking-[0.18em] text-faint">
          {label}
        </span>
        <span className="mono mt-2 rounded-full border border-hairline-strong px-2.5 py-0.5 text-[10px] uppercase tracking-[0.16em] text-ink">
          {resolvedBand}
        </span>
      </div>
    </div>
  );
}
