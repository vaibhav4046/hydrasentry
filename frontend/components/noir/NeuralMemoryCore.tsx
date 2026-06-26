"use client";

import { useEffect, useMemo, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";
import type { PointerField } from "@/hooks/usePointerField";
import {
  CORE,
  CORE_RADIUS,
  DEMO_CONNECTIONS,
  VB_W,
  VB_H,
  quadAt,
  buildHeroField,
  buildEdgeParticles,
  chordNormal,
  type Connection,
  type Pt,
} from "./heroField";
import { makeHeroSprites, makeGrainTexture } from "./heroSprites";

interface NeuralMemoryCoreProps {
  /** Connection web to draw (demo by default; real-graph web when passed). */
  connections?: Connection[];
  /** Active demo stage 0..MAX_STAGE; gates which edges/particles are live. */
  stage?: number;
  /** Force a composed STATIC frame (reduced-motion / settled real runs). */
  staticFrame?: boolean;
  /** Smoothed pointer field from usePointerField (parallax + attraction). */
  pointer?: PointerField | null;
  /** id of a hovered node (lifts + illuminates its edges). */
  hoveredNodeId?: string | null;
  /** Map node id -> its centre in viewBox space (for hover edge matching). */
  className?: string;
}

// ---- timing + look constants (named, no magic numbers in the loop) ----------
const CORE_BREATH_MS = 5600; // slow core scale/opacity breathe
const EDGE_TRAVEL_MS = 4200; // a safe particle traverses an edge in this
const EDGE_TRAVEL_FAST_MS = 2400; // tainted particles move faster (hotter)
const TWO_PI = Math.PI * 2;
const DPR_CAP = 2.5;
// Parallax: how far (vb units) each depth layer shifts at full pointer offset.
const PARALLAX_NEAR = 26; // near layer (depth=1) travel
const PARALLAX_FAR = 6; // far layer (depth=0) travel
// Pointer attraction radius (vb units) and max pull/illumination.
const ATTRACT_RADIUS = 230;
const ATTRACT_PULL = 16;
const GRAIN_ALPHA = 0.035;

/**
 * The signature monochrome hero, a "guarded MEMORY GRAPH" rendered as a living
 * PARTICLE FIELD, peer-grade with HydraDB's voxel-tree but in strict monochrome.
 *
 *  - A dense breathing CORE cluster (the agent's memory) of silver motes.
 *  - Synaptic EDGES built from streams of particles FLOWING core -> node like
 *    memories being recalled. Tainted edges are denser/faster/brighter (danger
 *    = intensity, never hue). The tainted chain burns hottest.
 *  - INTERACTIVE: a spring-smoothed pointer drives layered PARALLAX (near motes
 *    move more than far, real depth) and local ATTRACTION + illumination
 *    (particles near the cursor brighten and drift toward it). Hovering a node
 *    lifts + lights its edges. Touch → a gentle drift, no sticky follow.
 *  - DEPTH-OF-FIELD: far particles are smaller/dimmer/softer, near ones sharp +
 *    bright. Volumetric core halo, vignette, fine film grain.
 *  - Bloom is additive pre-rendered SPRITES drawn with "lighter" (no per-mote
 *    shadowBlur). ONE rAF loop, parked offscreen/hidden via the host's
 *    data-anim attribute. No per-frame React state. Seeded geometry → SSR-safe.
 *    reduced-motion => composed static frame.
 */
export function NeuralMemoryCore({
  connections = DEMO_CONNECTIONS,
  stage,
  staticFrame = false,
  pointer = null,
  hoveredNodeId = null,
  className,
}: NeuralMemoryCoreProps) {
  const prefersReduced = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const armRef = useRef<(() => void) | null>(null);

  // Immutable field + per-edge particle streams (seeded, SSR-safe). Memoised so
  // the rAF loop never reallocates; edge streams rebuild only if edges change.
  const field = useMemo(() => buildHeroField(), []);
  const edgeParticles = useMemo(
    () => buildEdgeParticles(connections),
    [connections],
  );
  // Per-connection chord normals (for lateral particle scatter), precomputed.
  const normals = useMemo(() => connections.map(chordNormal), [connections]);

  // Latest stage / mode / pointer / hover in refs so the loop reads them without
  // re-subscribing the effect.
  const stageRef = useRef(stage);
  const staticRef = useRef(staticFrame || prefersReduced);
  const pointerRef = useRef(pointer);
  const hoverRef = useRef(hoveredNodeId);
  useEffect(() => {
    stageRef.current = stage;
    staticRef.current = staticFrame || prefersReduced;
    pointerRef.current = pointer;
    hoverRef.current = hoveredNodeId;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const sprites = makeHeroSprites();
    const grain = makeGrainTexture();
    const grainPattern = ctx.createPattern(grain, "repeat");

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

    // viewBox -> device px (draw in device space; integer-crisp sprites, AA curves)
    const DX = (x: number) => x * sx * dpr;
    const DY = (y: number) => y * sy * dpr;
    const DS = (v: number) => v * ((sx + sy) / 2) * dpr;

    // ---- pointer-derived per-frame values -----------------------------------
    // parallax offset (vb units) for a given depth 0..1; plus the pointer's
    // position in vb space (for local attraction) and presence 0..1.
    const px = { x: 0, y: 0 }; // pointer in vb space
    let presence = 0;
    let offX = 0; // normalised -1..1 pointer offset (smoothed)
    let offY = 0;
    const readPointer = () => {
      const p = pointerRef.current;
      if (!p || staticRef.current) {
        offX = 0;
        offY = 0;
        presence = 0;
        return;
      }
      offX = p.x;
      offY = p.y;
      presence = p.active;
      px.x = p.ex * VB_W;
      px.y = p.ey * VB_H;
    };
    // shift for a depth layer: nearer layers travel further (negative so the
    // field leans INTO the cursor, content drifts opposite the pointer like
    // looking through a window). Returns {dx,dy} in vb units.
    const parallax = (depth: number) => {
      const amt = PARALLAX_FAR + (PARALLAX_NEAR - PARALLAX_FAR) * depth;
      return { dx: -offX * amt, dy: -offY * amt };
    };
    // local attraction: pull + brighten particles near the pointer. Returns a
    // {dx,dy,glow} for a vb-space point. Cheap: one hypot guarded by bbox.
    const attract = (x: number, y: number) => {
      if (presence <= 0.02) return { dx: 0, dy: 0, glow: 0 };
      const ddx = px.x - x;
      const ddy = px.y - y;
      if (Math.abs(ddx) > ATTRACT_RADIUS || Math.abs(ddy) > ATTRACT_RADIUS)
        return { dx: 0, dy: 0, glow: 0 };
      const d = Math.hypot(ddx, ddy);
      if (d > ATTRACT_RADIUS) return { dx: 0, dy: 0, glow: 0 };
      const t = 1 - d / ATTRACT_RADIUS; // 1 at cursor -> 0 at radius
      const e = t * t * presence;
      const inv = d > 0.001 ? 1 / d : 0;
      return {
        dx: ddx * inv * ATTRACT_PULL * e,
        dy: ddy * inv * ATTRACT_PULL * e,
        glow: e,
      };
    };

    const eligible = (c: Connection): boolean => {
      const s = stageRef.current;
      if (s == null) return true;
      return c.stage <= s;
    };
    // is this connection touched by the hovered node? -> lift + illuminate.
    const hoverHit = (c: Connection): number => {
      const h = hoverRef.current;
      if (!h) return 0;
      return c.from === h || c.to === h ? 1 : 0;
    };

    // ---- core cluster (breathing nebula of memory) --------------------------
    const drawCore = (now: number, breath: number) => {
      const s = stageRef.current;
      if (s != null && s < 0) return;
      const { dx, dy } = parallax(0.9); // core sits near-front
      const cx0 = CORE.x + dx;
      const cy0 = CORE.y + dy;
      const scale = 0.92 + 0.16 * breath;

      // 1) volumetric halo (soft body) + a SMALL hot kernel. Kept restrained on
      //    purpose: the discrete cluster motes (below) must read as structure
      //    a giant kernel disc would wash them into a featureless blob.
      ctx.globalCompositeOperation = "lighter";
      const halo = DS(CORE_RADIUS) * 1.9 * scale;
      ctx.globalAlpha = 0.32 + 0.1 * breath;
      ctx.drawImage(sprites.halo, DX(cx0) - halo, DY(cy0) - halo, halo * 2, halo * 2);
      const kern = DS(CORE_RADIUS) * 0.34 * scale;
      ctx.globalAlpha = 0.55 + 0.16 * breath;
      ctx.drawImage(sprites.kernel, DX(cx0) - kern, DY(cy0) - kern, kern * 2, kern * 2);

      // 2) the cluster motes, slow swirl + twinkle, parallaxed by their depth,
      //    pulled/brightened near the cursor.
      const secs = now / 1000;
      for (const m of field.coreParticles) {
        const ang = m.ang + (staticRef.current ? 0 : m.spin * secs);
        const r = m.rad * CORE_RADIUS * scale;
        let x = CORE.x + Math.cos(ang) * r;
        let y = CORE.y + Math.sin(ang) * r * 0.92; // slight vertical squash
        const pl = parallax(m.depth);
        x += pl.dx;
        y += pl.dy;
        const at = attract(x, y);
        x += at.dx;
        y += at.dy;
        const tw = staticRef.current
          ? 0.9
          : 0.72 + 0.28 * Math.sin((secs + m.twinkle * 9) * 1.6);
        const a = Math.min(1, m.bright * tw * (0.92 + 0.45 * breath) + at.glow * 0.5);
        if (a <= 0.02) continue;
        const size = DS(m.size) * (0.7 + m.depth * 0.85) * (1 + at.glow * 0.8);
        ctx.globalAlpha = a;
        ctx.drawImage(sprites.dot, DX(x) - size, DY(y) - size, size * 2, size * 2);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    };

    // ---- edge particle streams (memories flowing core -> node) --------------
    const drawEdges = (now: number, breath: number) => {
      ctx.globalCompositeOperation = "lighter";
      for (const p of edgeParticles) {
        const c = connections[p.connIndex];
        if (!c || !eligible(c)) continue;
        const period = c.tainted ? EDGE_TRAVEL_FAST_MS : EDGE_TRAVEL_MS;
        const t = (((now / (period * p.speed)) + p.offset) % 1 + 1) % 1;
        const pos = quadAt(c, t);
        const n = normals[p.connIndex];
        let x = pos.x + n.x * p.jitter;
        let y = pos.y + n.y * p.jitter;
        // depth from the connection (near edges sharper); parallax + attraction
        const pl = parallax(c.depth);
        x += pl.dx;
        y += pl.dy;
        const at = attract(x, y);
        x += at.dx;
        y += at.dy;
        // born at core, die at node: sine envelope keeps the stream luminous
        // mid-run. Floor keeps the stream visible end-to-end (memories flowing,
        // not blinking on/off), the signature "energy travelling the edge".
        const envelope = 0.32 + 0.68 * Math.sin(t * Math.PI);
        const hov = hoverHit(c);
        const baseA =
          (c.tainted ? 0.92 : 0.45 + p.bright * 0.55) *
          envelope *
          (c.tainted ? 0.85 + 0.15 * breath : 1);
        const a = Math.min(1, baseA + at.glow * 0.6 + hov * 0.5);
        if (a <= 0.02) continue;
        const size =
          DS(p.size) *
          (0.7 + c.depth * 0.9) *
          (0.8 + envelope * 0.5) *
          (1 + at.glow * 0.7 + hov * 0.55);
        ctx.globalAlpha = a;
        ctx.drawImage(sprites.dot, DX(x) - size, DY(y) - size, size * 2, size * 2);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    };

    // ---- faint connective filament under each edge (gives line continuity) --
    const drawEdgeFilaments = (breath: number) => {
      ctx.lineCap = "round";
      for (let i = 0; i < connections.length; i++) {
        const c = connections[i];
        if (!eligible(c)) continue;
        const hov = hoverHit(c);
        const pl = parallax(c.depth);
        const a =
          (c.tainted ? 0.22 + 0.08 * breath : 0.08 + c.depth * 0.08) + hov * 0.22;
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = `rgba(${c.tainted ? "255,255,255" : "208,216,228"},${a})`;
        ctx.lineWidth = DS(c.tainted ? 1.5 + hov : 0.6 + c.depth * 0.6 + hov);
        ctx.beginPath();
        ctx.moveTo(DX(c.p0.x + pl.dx), DY(c.p0.y + pl.dy));
        ctx.quadraticCurveTo(
          DX(c.ctrl.x + pl.dx),
          DY(c.ctrl.y + pl.dy),
          DX(c.p1.x + pl.dx),
          DY(c.p1.y + pl.dy),
        );
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
    };

    // ---- atmosphere dust (parallaxed, drifting) -----------------------------
    const drawDust = (now: number) => {
      ctx.globalCompositeOperation = "lighter";
      const secs = now / 1000;
      for (const d of field.dust) {
        let x = mod(d.x + (staticRef.current ? 0 : d.vx * secs), VB_W);
        let y = mod(d.y + (staticRef.current ? 0 : d.vy * secs), VB_H);
        const pl = parallax(d.depth);
        x += pl.dx;
        y += pl.dy;
        const at = attract(x, y);
        x += at.dx * 0.5;
        y += at.dy * 0.5;
        const tw = staticRef.current
          ? 0.7
          : 0.55 + 0.45 * Math.sin((secs + d.twinkle * 8) * 1.1);
        const a = Math.min(1, d.bright * tw + at.glow * 0.3);
        if (a <= 0.02) continue;
        const size = DS(d.size) * (0.5 + d.depth) * 1.6;
        ctx.globalAlpha = a;
        ctx.drawImage(sprites.dot, DX(x) - size, DY(y) - size, size * 2, size * 2);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    };

    // ---- cinematic overlays: vignette + grain -------------------------------
    const drawOverlays = () => {
      // vignette (deepen corners to black), drawn in device space, cheap radial
      const g = ctx.createRadialGradient(
        canvas.width * 0.5,
        canvas.height * 0.46,
        Math.min(canvas.width, canvas.height) * 0.28,
        canvas.width * 0.5,
        canvas.height * 0.46,
        Math.max(canvas.width, canvas.height) * 0.72,
      );
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, "rgba(2,3,5,0.62)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // fine film grain (tiled pattern, very low alpha, overlay-ish via lighter)
      if (grainPattern) {
        ctx.globalAlpha = GRAIN_ALPHA;
        ctx.globalCompositeOperation = "overlay";
        ctx.fillStyle = grainPattern;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
      }
    };

    const render = (now: number) => {
      // Optional dev-only frame-cost meter: set window.__heroPerf = {n:0,sum:0}
      // before timing, read its rolling average (ms/frame, GPU-independent).
      const perf =
        typeof window !== "undefined"
          ? (window as unknown as { __heroPerf?: { n: number; sum: number; max: number } }).__heroPerf
          : undefined;
      const t0 = perf ? performance.now() : 0;

      const tBreath = staticRef.current
        ? 0.5
        : 0.5 + 0.5 * Math.sin((now / CORE_BREATH_MS) * TWO_PI);
      readPointer();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      drawDust(now);
      drawEdgeFilaments(tBreath);
      drawEdges(now, tBreath);
      drawCore(now, tBreath);
      drawOverlays();

      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;

      if (perf) {
        const dtMs = performance.now() - t0;
        perf.n += 1;
        perf.sum += dtMs;
        if (dtMs > perf.max) perf.max = dtMs;
      }
    };

    resize();

    let raf = 0; // 0 = parked
    let lastT = performance.now();
    let lastStage = stageRef.current;
    const isPaused = () => wrap.dataset.anim === "off";
    // Animate while there is motion (not static, on-screen) OR while the pointer
    // spring is still settling (so parallax coasts to rest after the mouse stops
    // and after pointerleave), then PARK at ~0 main-thread cost.
    const springSettling = () => {
      const p = pointerRef.current;
      if (!p) return false;
      const moving =
        Math.abs(p.x - p.tx) > 0.001 ||
        Math.abs(p.y - p.ty) > 0.001 ||
        Math.abs(p.active - p.tactive) > 0.001;
      return moving;
    };
    const wantsFrame = () =>
      !isPaused() && (!staticRef.current || springSettling());

    const arm = () => {
      if (raf === 0) raf = requestAnimationFrame(loop);
    };

    function loop(now: number) {
      raf = 0;
      const dt = Math.max(0, (now - lastT) / 1000);
      lastT = now;
      // advance the pointer spring even when otherwise static (lets parallax
      // glide while the core/edges hold still under reduced-motion).
      pointerRef.current?.step(dt);

      const stageChanged = stageRef.current !== lastStage;
      if (stageChanged) lastStage = stageRef.current;

      render(now);

      if (wantsFrame()) arm();
      // else parked; resumed by data-anim observer, the stage effect, pointer, or resize.
    }

    arm();
    armRef.current = arm;

    // Resume on re-entry (usePauseOffscreen toggles data-anim) with a fresh frame.
    const animWatch = new MutationObserver(() => {
      lastT = performance.now();
      render(lastT);
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
  }, [connections, edgeParticles, normals, field]);

  // Re-arm when a controlled stage / static / hover changes while parked.
  useEffect(() => {
    armRef.current?.();
  }, [stage, staticFrame, prefersReduced, hoveredNodeId]);

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

function mod(v: number, m: number): number {
  return ((v % m) + m) % m;
}

// expose so ArtifactTreeGraph can position overlays consistently
export { CORE, CORE_RADIUS, type Pt };
