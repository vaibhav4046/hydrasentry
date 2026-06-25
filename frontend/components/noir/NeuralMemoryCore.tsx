"use client";

import { useEffect, useMemo, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";
import {
  CORE,
  CORE_RADIUS,
  DEMO_CONNECTIONS,
  DRIFT_PARTICLES,
  VB_W,
  VB_H,
  quadAt,
  type Connection,
} from "./neuralCoreData";

interface NeuralMemoryCoreProps {
  /** Connection web to draw (demo by default; real-graph web when passed). */
  connections?: Connection[];
  /**
   * Active demo stage 0..MAX_STAGE. Gates which connections / pulses are live so
   * a controlled stage progressively lights the composition with NO per-frame
   * React work. Undefined => everything eligible (idle / autoplay hero).
   */
  stage?: number;
  /** Force a composed STATIC frame (reduced-motion / settled real runs). */
  staticFrame?: boolean;
  className?: string;
}

// ---- timing + look constants (named, no magic numbers in the loop) ----------
const CORE_BREATH_MS = 5200; // slow core scale/opacity breathe
const PULSE_TRAVEL_MS = 2600; // a safe pulse traverses a connection in this
const PULSE_TRAVEL_FAST_MS = 1500; // tainted pulses move faster (hotter)
const DRIFT_OPACITY = 0.9;
const TWO_PI = Math.PI * 2;
// Sprite atlas sizes (device px) for the pre-rendered radial glows.
const SPRITE_CORE = 512;
const SPRITE_PULSE = 64;
const DPR_CAP = 2.5;

/**
 * The signature monochrome hero: a luminous neural MEMORY CORE with elegant
 * curved synaptic connections radiating to the context nodes and light pulses
 * travelling them like thoughts. Hyper-realistic + fast:
 *
 *  - HTML5 <canvas>, backing store sized clientW*dpr x clientH*dpr (dpr capped
 *    2.5) with ctx.scale(dpr) so curves are anti-aliased and razor-crisp at 4K —
 *    NOT pixelated.
 *  - Bloom is additive: pre-rendered radial-gradient SPRITES drawn with
 *    globalCompositeOperation="lighter" (no per-particle shadowBlur — too slow).
 *  - ONE requestAnimationFrame loop, parked when offscreen / tab-hidden via the
 *    host's data-anim attribute (set by usePauseOffscreen). No per-frame React
 *    state; stage/static live in refs.
 *  - Deterministic geometry (seeded, SSR-safe). reduced-motion => static frame.
 *
 * STRICT MONOCHROME — danger is brighter white + faster/brighter pulses + glow,
 * never hue.
 */
export function NeuralMemoryCore({
  connections = DEMO_CONNECTIONS,
  stage,
  staticFrame = false,
  className,
}: NeuralMemoryCoreProps) {
  const prefersReduced = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const armRef = useRef<(() => void) | null>(null);

  // Pre-flatten pulses across connections once (id, host connection, t-offset).
  const pulses = useMemo(() => buildPulses(connections), [connections]);

  // Latest stage / mode in refs so the rAF loop reads them without re-subscribing.
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

    // Pre-render the glow sprite atlases ONCE (device-independent; reused every
    // frame via drawImage + "lighter"). This is what keeps bloom cheap.
    // Core glow: a soft luminous body with a GRADUAL falloff (no hard white
    // disc) so it reads as a deep, dimensional "mind" rather than a flat orb.
    const coreSprite = makeRadialSprite(SPRITE_CORE, [
      [0.0, "rgba(255,255,255,0.95)"],
      [0.08, "rgba(255,255,255,0.7)"],
      [0.22, "rgba(226,232,240,0.42)"],
      [0.45, "rgba(170,180,196,0.18)"],
      [0.72, "rgba(120,130,148,0.06)"],
      [1.0, "rgba(0,0,0,0)"],
    ]);
    // A small, brighter kernel sprite for the dense hot center (kept tight).
    const kernelSprite = makeRadialSprite(256, [
      [0.0, "rgba(255,255,255,1)"],
      [0.18, "rgba(255,255,255,0.75)"],
      [0.5, "rgba(230,236,244,0.22)"],
      [1.0, "rgba(255,255,255,0)"],
    ]);
    const pulseSprite = makeRadialSprite(SPRITE_PULSE, [
      [0.0, "rgba(255,255,255,1)"],
      [0.35, "rgba(255,255,255,0.7)"],
      [1.0, "rgba(255,255,255,0)"],
    ]);

    // Device-pixel state, recomputed on resize.
    let dpr = 1;
    let cssW = 0;
    let cssH = 0;
    let sx = 1; // viewBox unit -> css px
    let sy = 1;

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      if (rect.width < 2) return;
      dpr = Math.min(DPR_CAP, Math.max(1, window.devicePixelRatio || 1));
      cssW = rect.width;
      cssH = (rect.width * VB_H) / VB_W; // lock the 1000x720 aspect
      sx = cssW / VB_W;
      sy = cssH / VB_H;
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
    };

    // Map a viewBox point to device px (we draw in device space, no ctx.scale,
    // so sprite sizes stay integer-crisp; curves are still AA via the rasterizer).
    const DX = (x: number) => x * sx * dpr;
    const DY = (y: number) => y * sy * dpr;
    const DS = (v: number) => v * ((sx + sy) / 2) * dpr; // scalar (radius/width)

    const eligible = (c: Connection): boolean => {
      const s = stageRef.current;
      if (s == null) return true;
      return c.stage <= s;
    };
    const coreLit = (): boolean => {
      const s = stageRef.current;
      return s == null || s >= 0; // core is the very first thing to light
    };

    // ---- draw a single synaptic connection (curve + soft glow underlay) -----
    const drawConnection = (c: Connection, breath: number) => {
      if (!eligible(c)) return;
      const base = c.tainted ? 0.62 : 0.26 + c.depth * 0.28;
      const alpha = base * (c.tainted ? 0.85 + 0.15 * breath : 1);
      // Soft wide glow pass (additive) so lines read luminous, then a crisp core.
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // glow underlay (lighter)
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = `rgba(255,255,255,${c.tainted ? 0.3 : 0.11 + c.depth * 0.05})`;
      ctx.lineWidth = DS(c.tainted ? 5.5 : 2.6 + c.depth * 1.4);
      strokeCurve(ctx, c, DX, DY);

      // crisp core line (source-over for clean edge)
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = `rgba(${c.tainted ? "255,255,255" : "214,220,228"},${alpha})`;
      ctx.lineWidth = DS(c.tainted ? 1.9 : 0.8 + c.depth * 0.9);
      strokeCurve(ctx, c, DX, DY);
    };

    // ---- draw the breathing luminous core -----------------------------------
    const drawCore = (breath: number) => {
      if (!coreLit()) return;
      const cx = DX(CORE.x);
      const cy = DY(CORE.y);
      // breathing scale 0.94..1.06
      const scale = 0.94 + 0.12 * breath;
      // wide outer volumetric halo
      const rad = DS(CORE_RADIUS) * 2.2 * scale;
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.7 + 0.12 * breath;
      ctx.drawImage(coreSprite, cx - rad, cy - rad, rad * 2, rad * 2);
      // a tight, bright kernel for the dense hot center (much smaller now)
      const inner = DS(CORE_RADIUS) * 0.62 * scale;
      ctx.globalAlpha = 0.85 + 0.15 * breath;
      ctx.drawImage(kernelSprite, cx - inner, cy - inner, inner * 2, inner * 2);
      ctx.globalAlpha = 1;

      // a few elegant internal filaments (neurons/folds) — thin curved strands.
      ctx.globalCompositeOperation = "lighter";
      drawCoreFilaments(ctx, cx, cy, DS(CORE_RADIUS) * scale, breath);
      ctx.globalCompositeOperation = "source-over";
    };

    // ---- draw travelling pulses (additive sprites) --------------------------
    const drawPulses = (now: number) => {
      ctx.globalCompositeOperation = "lighter";
      for (const p of pulses) {
        const c = p.conn;
        if (!eligible(c)) continue;
        const period = c.tainted ? PULSE_TRAVEL_FAST_MS : PULSE_TRAVEL_MS;
        const t = ((now / period + p.offset) % 1 + 1) % 1;
        const pos = quadAt(c, t);
        // fade in/out at the ends so pulses are born at the core, die at the node
        const envelope = Math.sin(t * Math.PI);
        const a = (c.tainted ? 0.95 : 0.6) * envelope;
        if (a <= 0.02) continue;
        const size = DS(c.tainted ? 9 : 6) * (0.6 + envelope * 0.6);
        const px = DX(pos.x);
        const py = DY(pos.y);
        ctx.globalAlpha = a;
        ctx.drawImage(pulseSprite, px - size, py - size, size * 2, size * 2);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    };

    // ---- drifting atmosphere particles --------------------------------------
    const drawDrift = (now: number) => {
      ctx.globalCompositeOperation = "lighter";
      const secs = now / 1000;
      for (const d of DRIFT_PARTICLES) {
        // wrap within the board so the field never empties
        const x = mod(d.x + d.vx * secs, VB_W);
        const y = mod(d.y + d.vy * secs, VB_H);
        const tw = 0.6 + 0.4 * Math.sin((secs + d.phase * 8) * 1.2);
        const a = d.bright * tw * DRIFT_OPACITY;
        if (a <= 0.02) continue;
        const size = DS(d.r) * 3;
        ctx.globalAlpha = a;
        ctx.drawImage(pulseSprite, DX(x) - size, DY(y) - size, size * 2, size * 2);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    };

    const render = (now: number) => {
      const tBreath = staticRef.current
        ? 0.5
        : 0.5 + 0.5 * Math.sin((now / CORE_BREATH_MS) * TWO_PI);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 1) atmosphere behind everything (skip when static for a calmer frame)
      if (!staticRef.current) drawDrift(now);
      // 2) connections (glow + crisp)
      for (const c of connections) drawConnection(c, tBreath);
      // 3) the core on top of the spokes' origins
      drawCore(tBreath);
      // 4) pulses ride above the connections
      if (!staticRef.current) drawPulses(now);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    };

    resize();

    let raf = 0; // 0 = parked
    let lastStage = stageRef.current;
    const isPaused = () => wrap.dataset.anim === "off";
    // Keep animating while there is motion (not static, on-screen). When static
    // or offscreen, render one settled frame then PARK for ~0 main-thread cost.
    const wantsFrame = () => !staticRef.current && !isPaused();

    const arm = () => {
      if (raf === 0) raf = requestAnimationFrame(loop);
    };

    function loop(now: number) {
      raf = 0;
      // A controlled stage change while parked: redraw once even if static.
      const stageChanged = stageRef.current !== lastStage;
      if (stageChanged) lastStage = stageRef.current;

      render(now);

      if (wantsFrame()) {
        arm();
      }
      // else parked; resumed by the data-anim observer, the stage effect, or resize.
    }

    arm();
    armRef.current = arm;

    // Resume when the host flips back on-screen (usePauseOffscreen toggles
    // data-anim). Also redraw a fresh settled frame on resume so re-entry never
    // shows a stale paused frame.
    const animWatch = new MutationObserver(() => {
      render(performance.now());
      arm();
    });
    animWatch.observe(wrap, { attributes: true, attributeFilter: ["data-anim"] });

    let resizeRaf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => {
        resize();
        render(performance.now());
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
  }, [connections, pulses]);

  // Re-arm / redraw when a controlled stage or static flag changes while parked.
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

// ---- pulse flattening -------------------------------------------------------
interface PulseRef {
  conn: Connection;
  offset: number;
}
function buildPulses(connections: Connection[]): PulseRef[] {
  const out: PulseRef[] = [];
  for (const c of connections) {
    for (let i = 0; i < c.pulses; i++) {
      // stagger multiple pulses on the same line evenly + by the line's phase
      out.push({ conn: c, offset: (c.phase + i / Math.max(1, c.pulses)) % 1 });
    }
  }
  return out;
}

// ---- curve stroking ---------------------------------------------------------
function strokeCurve(
  ctx: CanvasRenderingContext2D,
  c: Connection,
  DX: (x: number) => number,
  DY: (y: number) => number,
) {
  ctx.beginPath();
  ctx.moveTo(DX(c.p0.x), DY(c.p0.y));
  ctx.quadraticCurveTo(DX(c.ctrl.x), DY(c.ctrl.y), DX(c.p1.x), DY(c.p1.y));
  ctx.stroke();
}

// ---- core internal filaments (elegant curved strands) -----------------------
function drawCoreFilaments(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  breath: number,
) {
  // 5 fixed strands sweeping across the kernel — deterministic angles.
  const STRANDS = 5;
  ctx.lineCap = "round";
  for (let i = 0; i < STRANDS; i++) {
    const ang = (i / STRANDS) * Math.PI + breath * 0.25;
    const a = { x: cx + Math.cos(ang) * r * 0.85, y: cy + Math.sin(ang) * r * 0.85 };
    const b = {
      x: cx + Math.cos(ang + Math.PI) * r * 0.85,
      y: cy + Math.sin(ang + Math.PI) * r * 0.85,
    };
    const ctrl = {
      x: cx + Math.cos(ang + Math.PI / 2) * r * (0.35 + 0.12 * i),
      y: cy + Math.sin(ang + Math.PI / 2) * r * (0.35 + 0.12 * i),
    };
    ctx.strokeStyle = `rgba(255,255,255,${0.05 + 0.04 * Math.sin(breath * 6.28 + i)})`;
    ctx.lineWidth = Math.max(1, r * 0.03);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(ctrl.x, ctrl.y, b.x, b.y);
    ctx.stroke();
  }
}

// ---- pre-rendered radial glow sprite ----------------------------------------
function makeRadialSprite(
  size: number,
  stops: Array<[number, string]>,
): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const g = c.getContext("2d");
  if (g) {
    const grad = g.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size / 2,
    );
    for (const [stop, color] of stops) grad.addColorStop(stop, color);
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
  }
  return c;
}

function mod(v: number, m: number): number {
  return ((v % m) + m) % m;
}
