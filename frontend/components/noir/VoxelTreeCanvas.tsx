"use client";

import { useEffect, useMemo, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";
import { VB_W, VB_H } from "./artifactTreeData";
import { CELL, DEMO_VOXELS, type Voxel } from "./voxelTreeData";

interface VoxelTreeCanvasProps {
  /** Voxel field to draw (demo field by default; real-graph field when passed). */
  voxels?: Voxel[];
  /**
   * Active demo stage 0..MAX_STAGE. Gates which voxel layers are eligible to
   * show (a controlled stage reveals layers without per-frame React work).
   * When undefined, all layers are eligible (idle/autoplay hero).
   */
  stage?: number;
  /** Force the fully-built static frame (reduced-motion / settled real runs). */
  staticFrame?: boolean;
  className?: string;
}

// Build-in: fill cells base -> tips over this window, then STOP and hold.
const BUILD_MS = 1700;
// Tainted pulse: a slow brightness breathe on ONLY the tainted cells.
const PULSE_PERIOD_MS = 2600;
const EASE = (t: number) => 1 - Math.pow(1 - t, 3); // easeOutCubic

/**
 * The hero tree as a DPR-scaled VOXEL canvas — dense white squares forming the
 * trunk, branches and the white-hot tainted path. This replaces the old
 * framer-motion SVG storm: the layout is precomputed once, the build-in runs on
 * rAF (never setState), and the only perpetual motion is a cheap pulse that
 * repaints just the tainted cells. It pauses when scrolled offscreen or the tab
 * is hidden via the host's `data-anim` attribute (set by usePauseOffscreen).
 *
 * Sharpness: the backing store is sized to clientWidth*dpr x clientHeight*dpr,
 * the context is scaled by dpr, and every cell is snapped to INTEGER device
 * pixels — squares stay crisp at retina/4K with zero CSS upscaling.
 */
export function VoxelTreeCanvas({
  voxels = DEMO_VOXELS,
  stage,
  staticFrame = false,
  className,
}: VoxelTreeCanvasProps) {
  const prefersReduced = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  // Lets the stage-change effect poke the parked rAF loop without re-subscribing.
  const armRef = useRef<(() => void) | null>(null);

  // Split tainted vs base cells once — the pulse loop only touches tainted.
  const { taintedCells, baseCells } = useMemo(() => {
    const t: Voxel[] = [];
    const b: Voxel[] = [];
    for (const v of voxels) (v.tainted ? t : b).push(v);
    return { taintedCells: t, baseCells: b };
  }, [voxels]);

  // Latest stage / mode in refs so the rAF loop reads them without re-subscribing.
  // Written in an effect (not during render) per react-hooks/refs.
  const stageRef = useRef(stage);
  const staticRef = useRef(staticFrame || prefersReduced);
  useEffect(() => {
    stageRef.current = stage;
    staticRef.current = staticFrame || prefersReduced;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Device-pixel state, recomputed on resize.
    let dpr = 1;
    let cssW = 0;
    let cssH = 0;
    let scaleX = 1; // viewBox unit -> css px
    let scaleY = 1;
    let cellPxX = 1; // integer cell size in device px
    let cellPxY = 1;

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      if (rect.width < 2) return;
      dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
      cssW = rect.width;
      cssH = (rect.width * VB_H) / VB_W; // lock the 1000x720 aspect
      scaleX = cssW / VB_W;
      scaleY = cssH / VB_H;
      // Backing store at full device resolution; CSS box stays at css size.
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      // Integer cell footprint in device px so squares never straddle pixels.
      cellPxX = Math.max(1, Math.round(CELL * scaleX * dpr));
      cellPxY = Math.max(1, Math.round(CELL * scaleY * dpr));
    };

    // Eligibility: a cell shows if its stage <= active stage. Idle (stage
    // undefined) shows everything.
    const eligible = (v: Voxel): boolean => {
      const s = stageRef.current;
      if (s == null) return true;
      return v.stage <= s;
    };

    // Paint one cell as an integer-snapped device-pixel square.
    const paintCell = (v: Voxel, alpha: number) => {
      const px = Math.round(v.gx * CELL * scaleX * dpr);
      const py = Math.round(v.gy * CELL * scaleY * dpr);
      ctx.globalAlpha = Math.min(1, alpha);
      ctx.fillRect(px, py, cellPxX, cellPxY);
    };

    // Full redraw (build-in frames + first paint). progress 0..1 gates reveal.
    const drawAll = (progress: number, pulse: number) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#FFFFFF";
      const p = staticRef.current ? 1 : progress;
      for (const v of baseCells) {
        if (!eligible(v)) continue;
        if (v.reveal > p) continue;
        paintCell(v, 0.16 + v.bright * 0.84);
      }
      for (const v of taintedCells) {
        if (!eligible(v)) continue;
        if (v.reveal > p) continue;
        paintCell(v, Math.min(1, (0.7 + v.bright * 0.3) * pulse));
      }
      ctx.globalAlpha = 1;
    };

    // Cheap pulse frame: repaint ONLY the tainted cells (clear their band by
    // overdrawing the whole canvas once is wasteful, so we clear+repaint just
    // the tainted rects). Base cells are already on the canvas and never change.
    const repaintTainted = (pulse: number) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = "#FFFFFF";
      for (const v of taintedCells) {
        if (!eligible(v)) continue;
        const px = Math.round(v.gx * CELL * scaleX * dpr);
        const py = Math.round(v.gy * CELL * scaleY * dpr);
        // clear the cell then repaint at the pulsed alpha
        ctx.clearRect(px, py, cellPxX, cellPxY);
        ctx.globalAlpha = Math.min(1, (0.7 + v.bright * 0.3) * pulse);
        ctx.fillRect(px, py, cellPxX, cellPxY);
      }
      ctx.globalAlpha = 1;
    };

    resize();

    let raf = 0; // 0 = no frame pending (parked)
    let start = performance.now();
    let built = false;
    let lastStage = stageRef.current;
    const hasTaint = taintedCells.length > 0;

    const isPaused = () => wrap.dataset.anim === "off";
    // The loop only needs to keep running while there is motion to render:
    // the bounded build-in, the perpetual tainted pulse (when on-screen and not
    // reduced-motion). Otherwise it PARKS (raf stays 0) for ~0 main-thread cost.
    const wantsFrame = () =>
      !built || (hasTaint && !staticRef.current && !isPaused());

    // Schedule the next frame only if one isn't already pending — never double-arm.
    const arm = () => {
      if (raf === 0 && wantsFrame()) raf = requestAnimationFrame(loop);
    };

    function loop(now: number) {
      raf = 0; // consumed; the body decides whether to re-arm
      const t = now - start;
      const pulseRaw =
        0.78 + 0.22 * Math.sin((t / PULSE_PERIOD_MS) * Math.PI * 2);

      if (!built) {
        // BUILD-IN phase: reveal base -> tips, then settle and HOLD.
        const progress = staticRef.current ? 1 : EASE(Math.min(1, t / BUILD_MS));
        drawAll(progress, pulseRaw);
        if (progress >= 1) {
          built = true;
          drawAll(1, hasTaint ? pulseRaw : 1); // clean settled frame
        }
        arm();
        return;
      }

      // If a controlled stage changed while parked/looping, re-gate layers once.
      if (stageRef.current !== lastStage) {
        lastStage = stageRef.current;
        drawAll(1, pulseRaw);
      }

      // Nothing to animate -> park (no re-arm). Resumed by arm() from the
      // data-anim MutationObserver, the stage effect, or a resize.
      if (!hasTaint || staticRef.current || isPaused()) return;

      repaintTainted(pulseRaw);
      arm();
    }

    arm();
    armRef.current = arm;

    // Resume the pulse when the host flips back on-screen (usePauseOffscreen
    // toggles data-anim); park happens naturally in the loop when it goes off.
    const animWatch = new MutationObserver(() => arm());
    animWatch.observe(wrap, {
      attributes: true,
      attributeFilter: ["data-anim"],
    });

    // Recompute on resize; restart the build-in cleanly at the new resolution
    // (reset BOTH built and the timeline origin so a mid-build resize doesn't
    // flash a partially-revealed frame).
    let resizeRaf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => {
        resize();
        built = false;
        start = performance.now();
        arm();
      });
    });
    ro.observe(wrap);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      cancelAnimationFrame(resizeRaf);
      ro.disconnect();
      animWatch.disconnect();
      armRef.current = null;
    };
  }, [baseCells, taintedCells]);

  // Re-arm the canvas loop when a controlled stage or static flag changes while
  // the loop is parked (e.g. autoplay advances to CONFLICT). Cheap: the loop
  // does one redraw then parks again if there's still nothing to animate.
  useEffect(() => {
    armRef.current?.();
  }, [stage, staticFrame, prefersReduced]);

  return (
    <div
      ref={wrapRef}
      className={cn("relative w-full", className)}
      style={{ aspectRatio: `${VB_W} / ${VB_H}` }}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="block h-auto w-full" />
    </div>
  );
}
