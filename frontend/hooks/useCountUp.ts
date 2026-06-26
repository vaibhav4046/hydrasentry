"use client";

/**
 * Animate an integer from its current displayed value to a target via
 * requestAnimationFrame. Used for the hero risk count-up (12 -> 87) so the
 * number climbs smoothly across demo stages instead of jumping.
 *
 * Reduced motion: returns the target directly during render (no animation, no
 * effect-driven state), so the value is never stuck mid-tween and nothing
 * depends on motion to read correctly.
 */
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

const EASE_OUT_EXPO = (t: number): number =>
  t === 1 ? 1 : 1 - Math.pow(2, -10 * t);

export function useCountUp(target: number, durationMs = 900): number {
  const prefersReduced = useReducedMotion();
  const [animated, setAnimated] = useState<number>(target);
  const fromRef = useRef<number>(target);
  const valueRef = useRef<number>(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // Reduced motion is handled purely during render (below); skip the tween so
    // no setState runs synchronously in this effect.
    if (prefersReduced) {
      fromRef.current = target;
      return;
    }
    const from = fromRef.current;
    if (from === target) return;
    let start: number | null = null;
    const step = (ts: number) => {
      if (start == null) start = ts;
      const t = Math.min(1, (ts - start) / durationMs);
      const eased = EASE_OUT_EXPO(t);
      const next = Math.round(from + (target - from) * eased);
      valueRef.current = next;
      setAnimated(next);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = target;
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      // Persist the last displayed value as the next tween's origin.
      fromRef.current = valueRef.current;
    };
  }, [target, durationMs, prefersReduced]);

  return prefersReduced ? target : animated;
}
