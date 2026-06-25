"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Tracks the pointer over a host element and exposes a SPRING-SMOOTHED, inertial
 * pointer position the rAF loop can read every frame without React re-renders.
 *
 * - `tx,ty` are the raw target (normalised -1..1 from element centre, plus 0..1
 *   element-space) updated on pointermove.
 * - `x,y` (normalised) and `ex,ey` (element 0..1) are integrated toward the
 *   target with a critically-ish damped spring each frame via `step(dt)` so the
 *   parallax glides and coasts instead of snapping — the "alive" feel.
 * - `active` eases 0..1 (pointer present) so attraction/illumination fades in
 *   and out rather than popping.
 * - Touch: a tap sets a target then releases, producing a gentle drift; no
 *   sticky finger-follow. Pointer-none devices simply never activate (the loop
 *   falls back to autonomous drift).
 *
 * Everything lives in a ref object (mutated in place) — deliberately NOT state.
 */
export interface PointerField {
  // raw target (set on move)
  tx: number;
  ty: number;
  tex: number;
  tey: number;
  tactive: number;
  // smoothed (integrated each frame)
  x: number;
  y: number;
  ex: number;
  ey: number;
  active: number;
  /** advance the spring by dt seconds. */
  step: (dt: number) => void;
}

const STIFFNESS = 9; // spring pull
const DAMP = 0.86; // velocity retention per integration sub-step
const ACTIVE_EASE = 5; // how fast presence fades in/out

/** Factory for the stable, mutable pointer-field object (built once). */
function createField(): PointerField {
  const vx = { x: 0, y: 0 }; // internal velocity for the spring (private)
  return {
    tx: 0,
    ty: 0,
    tex: 0.5,
    tey: 0.5,
    tactive: 0,
    x: 0,
    y: 0,
    ex: 0.5,
    ey: 0.5,
    active: 0,
    step(dt: number) {
      // clamp dt so a tab-restore frame can't fling the spring
      const h = Math.min(dt, 0.05);
      // spring toward target (semi-implicit Euler), per-axis
      vx.x += (this.tx - this.x) * STIFFNESS * h;
      vx.y += (this.ty - this.y) * STIFFNESS * h;
      vx.x *= DAMP;
      vx.y *= DAMP;
      this.x += vx.x;
      this.y += vx.y;
      // element-space follows the same target, lighter (used for attraction)
      this.ex += (this.tex - this.ex) * Math.min(1, STIFFNESS * h);
      this.ey += (this.tey - this.ey) * Math.min(1, STIFFNESS * h);
      this.active += (this.tactive - this.active) * Math.min(1, ACTIVE_EASE * h);
    },
  };
}

export function usePointerField<T extends HTMLElement = HTMLDivElement>() {
  const hostRef = useRef<T | null>(null);
  // Stable mutable field object via a lazy state initializer — created exactly
  // once, identity never changes (setter is never called), and reading/mutating
  // it never happens during render, so this is lint- and concurrent-safe.
  const [field] = useState<PointerField>(createField);

  useEffect(() => {
    const el = hostRef.current;
    const f = field;
    if (!el || !f) return;

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      if (r.width < 2) return;
      const ex = (e.clientX - r.left) / r.width;
      const ey = (e.clientY - r.top) / r.height;
      f.tex = ex;
      f.tey = ey;
      f.tx = (ex - 0.5) * 2;
      f.ty = (ey - 0.5) * 2;
      f.tactive = 1;
    };
    const onLeave = () => {
      f.tactive = 0;
      // ease target back to centre so parallax recentres gracefully
      f.tx = 0;
      f.ty = 0;
      f.tex = 0.5;
      f.tey = 0.5;
    };
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      const r = el.getBoundingClientRect();
      if (r.width < 2) return;
      const ex = (t.clientX - r.left) / r.width;
      const ey = (t.clientY - r.top) / r.height;
      f.tex = ex;
      f.tey = ey;
      f.tx = (ex - 0.5) * 2;
      f.ty = (ey - 0.5) * 2;
      f.tactive = 1;
      // gentle auto-release so touch doesn't stick
      window.clearTimeout((f as unknown as { _t?: number })._t);
      (f as unknown as { _t?: number })._t = window.setTimeout(onLeave, 900);
    };

    el.addEventListener("pointermove", onMove, { passive: true });
    el.addEventListener("pointerleave", onLeave, { passive: true });
    el.addEventListener("touchstart", onTouch, { passive: true });
    el.addEventListener("touchmove", onTouch, { passive: true });

    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      el.removeEventListener("touchstart", onTouch);
      el.removeEventListener("touchmove", onTouch);
      window.clearTimeout((f as unknown as { _t?: number })._t);
    };
  }, [field]);

  return { hostRef, field };
}
