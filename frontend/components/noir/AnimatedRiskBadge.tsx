"use client";

import { useEffect, useRef, useState } from "react";
import { animate, m, useInView, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";
import { EASE_OUT_EXPO } from "@/lib/motion";

interface AnimatedRiskBadgeProps {
  /** Final score, 0-100. */
  to: number;
  /** Starting score for the count-up (default 12). */
  from?: number;
  /** Band label, e.g. "HIGH RISK". Defaults from the score. */
  band?: string;
  /** Run the count-up + glow (default true). Reduced motion jumps to final. */
  animate?: boolean;
  className?: string;
}

const BAND_FROM_SCORE = (s: number): string =>
  s >= 80 ? "CRITICAL" : s >= 60 ? "HIGH RISK" : s >= 35 ? "ELEVATED" : "LOW RISK";

/**
 * Big monochrome risk readout that counts up (e.g. 12 -> 87) on scroll-in.
 * Severity is shown by white intensity + glow + a heavier band pill, never hue.
 * The large number sits over a small `/ 100` and the band label. Reduced motion
 * renders the final value with no tween.
 */
export function AnimatedRiskBadge({
  to,
  from = 12,
  band,
  animate: shouldAnimate = true,
  className,
}: AnimatedRiskBadgeProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const prefersReduced = useReducedMotion();
  const isAnimated = shouldAnimate && !prefersReduced;
  // Initialize deterministically to `from` so the server and the first client
  // paint render the SAME number regardless of reduced-motion (which is null on
  // the server and resolved on the client). Resolving the real target in an
  // effect avoids a hydration text mismatch (React #418).
  const [value, setValue] = useState<number>(from);

  useEffect(() => {
    // Reduced motion / animation off: settle on the final value instantly.
    // Animated but not yet in view: hold `from` (the initial value), nothing to
    // do. Animated and in view: count up. State is only ever updated via the
    // tween's onUpdate callback (not a direct setState in the effect body), which
    // keeps the deterministic `from` initial render and avoids a hydration
    // mismatch (React #418).
    if (isAnimated && !inView) return;
    const controls = animate(from, to, {
      duration: isAnimated ? 1.4 : 0,
      ease: EASE_OUT_EXPO,
      onUpdate: (v) => setValue(v),
    });
    return () => controls.stop();
  }, [from, to, inView, isAnimated]);

  const resolvedBand = band ?? BAND_FROM_SCORE(to);
  // Glow grows with score so a high number reads "hotter" without color.
  const glow = 0.18 + (to / 100) * 0.34;

  return (
    <div ref={ref} className={cn("flex items-center gap-4", className)}>
      <div className="flex items-baseline gap-1.5">
        <m.span
          className="text-[3.25rem] font-semibold leading-none tracking-tight text-ink tabular-nums"
          style={{ textShadow: `0 0 28px rgba(255,255,255,${glow})` }}
          initial={isAnimated ? { opacity: 0, y: 8 } : false}
          animate={isAnimated ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
        >
          {Math.round(value)}
        </m.span>
        <span className="mono text-sm text-faint">/ 100</span>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="mono text-[10px] uppercase tracking-[0.2em] text-faint">
          Risk score
        </span>
        <span className="mono inline-flex w-fit items-center gap-1.5 rounded-full border border-hairline-strong bg-white/[.06] px-2.5 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink shadow-[0_0_12px_rgba(255,255,255,0.22)]">
          {resolvedBand}
        </span>
      </div>
    </div>
  );
}
