"use client";

import { useEffect, useMemo, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";
import type { PointerField } from "@/hooks/usePointerField";
import {
  buildHeroGeometry,
  ANCHOR_STAGE,
  VB_W,
  VB_H,
  type HeroGeometry,
} from "./heroFieldGeo";
import { HERO_VERT, HERO_FRAG } from "./heroShaders";

interface WebGLMemoryFieldProps {
  /** Active demo stage 0..7 (gates which spokes are lit). undefined => show all. */
  stage?: number;
  /** Force a composed static frame (reduced motion / settled). */
  staticFrame?: boolean;
  /** Smoothed pointer field (parallax + attraction) from usePointerField. */
  pointer?: PointerField | null;
  /** Hovered anchor index (-1 / null = none) — brightens that node's filament. */
  hoveredAnchor?: number | null;
  /** Extra core/tainted energy while a demo runs (0..1). */
  corePulse?: number;
  className?: string;
}

// ---- look + perf constants (named; no magic numbers in the loop) ------------
const DPR_CAP = 2; // brief: cap DPR ~2 (crisp at 4K without melting fill-rate)
const CORE_BREATH_MS = 5600;
const TWO_PI = Math.PI * 2;
const EXPOSURE = 0.92; // global additive trim so bloom stays restrained
// Mobile / low-power → fewer particles (same silhouette, scaled population).
function pickScale(): number {
  if (typeof window === "undefined") return 1;
  const w = window.innerWidth || 1280;
  const cores = navigator.hardwareConcurrency || 8;
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 8;
  if (w < 640 || cores <= 4 || mem <= 4) return 0.4; // phones / low-power
  if (w < 1100) return 0.66; // tablets / small laptops
  return 1;
}

/**
 * The signature monochrome hero — a WebGL2 GPU PARTICLE FIELD that forms an
 * organic memory-graph TREE silhouette (HydraDB's voxel-tree DNA, in strict
 * monochrome). ~tens of thousands of GPU points: a breathing CORE, voxel-biased
 * BRANCH limbs, and streaming EDGE filaments core→node; the tainted chain burns
 * hottest. All motion lives in the vertex shader from immutable base buffers +
 * a few uniforms; ONE rAF only advances uTime / pointer / stage / hover. Bloom
 * is GPU-native additive blending (gl.blendFunc(ONE, ONE)). Parked offscreen /
 * tab-hidden via the host's data-anim attribute. Context-loss is recovered.
 *
 * Client-only (next/dynamic ssr:false) + deterministic seeded geometry → no
 * hydration mismatch. A CSS vignette + film-grain overlay sits above the canvas.
 */
export function WebGLMemoryField({
  stage,
  staticFrame = false,
  pointer = null,
  hoveredAnchor = null,
  corePulse = 0,
  className,
}: WebGLMemoryFieldProps) {
  const prefersReduced = useReducedMotion();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const armRef = useRef<(() => void) | null>(null);

  // Build the immutable geometry once (seeded → SSR-safe even though we only
  // mount client-side). Population scaled for the device.
  const geo: HeroGeometry = useMemo(() => buildHeroGeometry({ scale: pickScale() }), []);

  // Latest dynamic inputs in refs so the GL loop reads them without re-subscribing.
  const stageRef = useRef(stage);
  const staticRef = useRef(staticFrame || !!prefersReduced);
  const pointerRef = useRef(pointer);
  const hoverRef = useRef(hoveredAnchor ?? -1);
  const pulseRef = useRef(corePulse);
  useEffect(() => {
    stageRef.current = stage;
    staticRef.current = staticFrame || !!prefersReduced;
    pointerRef.current = pointer;
    hoverRef.current = hoveredAnchor ?? -1;
    pulseRef.current = corePulse;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    // GL resources that must be rebuilt on context loss live in this closure
    // object so the restore handler can re-create them cleanly.
    type GL = WebGL2RenderingContext;
    let gl: GL | null = null;
    let program: WebGLProgram | null = null;
    let vao: WebGLVertexArrayObject | null = null;
    const buffers: WebGLBuffer[] = [];
    let lost = false;

    // device-pixel state, recomputed on resize
    let dpr = 1;
    let cssW = 0;
    let cssH = 0;

    // uniform locations (filled on (re)build)
    let u: Record<string, WebGLUniformLocation | null> = {};

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      if (rect.width < 2) return;
      dpr = Math.min(DPR_CAP, Math.max(1, window.devicePixelRatio || 1));
      cssW = rect.width;
      cssH = (rect.width * VB_H) / VB_W; // lock the 1000x720 aspect
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      const pw = Math.round(cssW * dpr);
      const ph = Math.round(cssH * dpr);
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
      }
      if (gl) gl.viewport(0, 0, canvas.width, canvas.height);
    };

    const compile = (g: GL, type: number, src: string): WebGLShader | null => {
      const sh = g.createShader(type);
      if (!sh) return null;
      g.shaderSource(sh, src);
      g.compileShader(sh);
      if (!g.getShaderParameter(sh, g.COMPILE_STATUS)) {
        // Surface the reason in dev; caller falls back to poster on null.
        if (process.env.NODE_ENV !== "production") {
          console.error("[WebGLMemoryField] shader compile failed:", g.getShaderInfoLog(sh));
        }
        g.deleteShader(sh);
        return null;
      }
      return sh;
    };

    // (Re)build the GL program + VAO + buffers. Returns true on success.
    const build = (): boolean => {
      const g = canvas.getContext("webgl2", {
        antialias: false, // we bloom additively; MSAA wastes fill-rate here
        alpha: true,
        premultipliedAlpha: true,
        depth: false,
        stencil: false,
        powerPreference: "high-performance",
        failIfMajorPerformanceCaveat: false,
      }) as GL | null;
      if (!g) return false;
      gl = g;

      const vs = compile(g, g.VERTEX_SHADER, HERO_VERT);
      const fs = compile(g, g.FRAGMENT_SHADER, HERO_FRAG);
      if (!vs || !fs) return false;
      const prog = g.createProgram();
      if (!prog) return false;
      g.attachShader(prog, vs);
      g.attachShader(prog, fs);
      g.linkProgram(prog);
      g.deleteShader(vs);
      g.deleteShader(fs);
      if (!g.getProgramParameter(prog, g.LINK_STATUS)) {
        if (process.env.NODE_ENV !== "production") {
          console.error("[WebGLMemoryField] link failed:", g.getProgramInfoLog(prog));
        }
        return false;
      }
      program = prog;
      g.useProgram(prog);

      // VAO + interleaved-free attribute buffers (3 static VBOs, never updated).
      const va = g.createVertexArray();
      if (!va) return false;
      vao = va;
      g.bindVertexArray(va);

      const makeBuf = (data: Float32Array, loc: number, size: number) => {
        const buf = g.createBuffer();
        if (!buf) return;
        buffers.push(buf);
        g.bindBuffer(g.ARRAY_BUFFER, buf);
        g.bufferData(g.ARRAY_BUFFER, data, g.STATIC_DRAW);
        g.enableVertexAttribArray(loc);
        g.vertexAttribPointer(loc, size, g.FLOAT, false, 0, 0);
      };
      const aBase = g.getAttribLocation(prog, "aBase");
      const aRnd = g.getAttribLocation(prog, "aRnd");
      const aMeta = g.getAttribLocation(prog, "aMeta");
      makeBuf(geo.base, aBase, 3);
      makeBuf(geo.rnd, aRnd, 4);
      makeBuf(geo.meta, aMeta, 4);
      g.bindVertexArray(null);

      // resolve uniform locations
      const names = [
        "uViewBox", "uResolution", "uTime", "uMouse", "uMousePx", "uMouseActive",
        "uStage", "uHover", "uBreath", "uDpr", "uReduced", "uCorePulse",
        "uExposure", "uTimeF", "uResolutionF",
      ];
      u = {};
      for (const n of names) u[n] = g.getUniformLocation(prog, n);
      // per-anchor stage array (16 slots; we fill the first ANCHOR_STAGE.length)
      const anchorStageArr = new Float32Array(16);
      anchorStageArr.set(ANCHOR_STAGE.subarray(0, 16));
      const locAS = g.getUniformLocation(prog, "uAnchorStage[0]");
      g.uniform1fv(locAS, anchorStageArr);

      // constant uniforms
      g.uniform2f(u.uViewBox, VB_W, VB_H);
      g.uniform1f(u.uExposure, EXPOSURE);

      // additive bloom: ONE, ONE (premultiplied alpha sprites)
      g.disable(g.DEPTH_TEST);
      g.enable(g.BLEND);
      g.blendFunc(g.ONE, g.ONE);
      g.clearColor(0, 0, 0, 0);

      resize();
      return true;
    };

    const ok = build();
    if (!ok) {
      // Could not init WebGL2 — leave the canvas transparent; the parent's
      // <Poster> remains visible behind it (it is not unmounted on success
      // either, so this degrades gracefully to the static monochrome poster).
      return;
    }

    // ---- pointer-derived per-frame values -----------------------------------
    let offX = 0;
    let offY = 0;
    let presence = 0;
    let pxVB = 0;
    let pyVB = 0;
    const readPointer = () => {
      const p = pointerRef.current;
      if (!p || staticRef.current) {
        // even under reduced-motion we still allow gentle parallax to coast,
        // but if no pointer, hold centred.
        if (!p) {
          offX = 0;
          offY = 0;
          presence = 0;
          return;
        }
      }
      if (!p) return;
      offX = p.x;
      offY = p.y;
      presence = p.active;
      pxVB = p.ex * VB_W;
      pyVB = p.ey * VB_H;
    };

    // ---- the loop -----------------------------------------------------------
    let raf = 0; // 0 = parked
    let lastT = performance.now();
    const startT = lastT;
    const isPaused = () => wrap.dataset.anim === "off";
    const springSettling = () => {
      const p = pointerRef.current;
      if (!p) return false;
      return (
        Math.abs(p.x - p.tx) > 0.001 ||
        Math.abs(p.y - p.ty) > 0.001 ||
        Math.abs(p.active - p.tactive) > 0.001
      );
    };
    // Animate while there is motion (not static + on-screen) OR while the
    // pointer spring or core pulse is still settling; otherwise PARK at ~0 cost.
    const wantsFrame = () =>
      !lost &&
      !isPaused() &&
      (!staticRef.current || springSettling() || pulseRef.current > 0.001);

    const render = (now: number) => {
      const g = gl;
      if (!g || !program || lost) return;
      const perf =
        typeof window !== "undefined"
          ? (window as unknown as { __heroPerf?: { n: number; sum: number; max: number } }).__heroPerf
          : undefined;
      const t0 = perf ? performance.now() : 0;

      readPointer();
      const secs = (now - startT) / 1000;
      const reduced = staticRef.current ? 1 : 0;
      const breath = staticRef.current
        ? 0.5
        : 0.5 + 0.5 * Math.sin((now / CORE_BREATH_MS) * TWO_PI);

      g.useProgram(program);
      g.bindVertexArray(vao);

      g.uniform1f(u.uTime, secs);
      g.uniform2f(u.uMouse, offX, offY);
      g.uniform2f(u.uMousePx, pxVB, pyVB);
      g.uniform1f(u.uMouseActive, presence);
      g.uniform1f(u.uStage, stageRef.current == null ? -1 : stageRef.current);
      g.uniform1f(u.uHover, hoverRef.current);
      g.uniform1f(u.uBreath, breath);
      g.uniform1f(u.uDpr, dpr);
      g.uniform1f(u.uReduced, reduced);
      g.uniform1f(u.uCorePulse, clamp01(pulseRef.current));
      g.uniform2f(u.uResolution, canvas.width, canvas.height);
      g.uniform1f(u.uTimeF, secs);
      g.uniform2f(u.uResolutionF, canvas.width, canvas.height);

      g.clear(g.COLOR_BUFFER_BIT);
      g.drawArrays(g.POINTS, 0, geo.count);
      g.bindVertexArray(null);

      if (perf) {
        const dt = performance.now() - t0;
        perf.n += 1;
        perf.sum += dt;
        if (dt > perf.max) perf.max = dt;
      }
    };

    const arm = () => {
      if (raf === 0 && !lost) raf = requestAnimationFrame(loop);
    };
    function loop(now: number) {
      raf = 0;
      const dt = Math.max(0, (now - lastT) / 1000);
      lastT = now;
      pointerRef.current?.step(dt);
      render(now);
      if (wantsFrame()) arm();
    }
    arm();
    armRef.current = arm;

    // ---- context-loss handling ----------------------------------------------
    const onLost = (e: Event) => {
      e.preventDefault(); // required so the context becomes restorable
      lost = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };
    const onRestored = () => {
      lost = false;
      // drop stale handles and rebuild everything against the fresh context
      program = null;
      vao = null;
      buffers.length = 0;
      const good = build();
      if (good) {
        lastT = performance.now();
        render(lastT);
        arm();
      }
    };
    canvas.addEventListener("webglcontextlost", onLost as EventListener, false);
    canvas.addEventListener("webglcontextrestored", onRestored as EventListener, false);

    // resume on re-entry (usePauseOffscreen toggles data-anim) with a fresh frame
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
      canvas.removeEventListener("webglcontextlost", onLost as EventListener);
      canvas.removeEventListener("webglcontextrestored", onRestored as EventListener);
      armRef.current = null;
      // free GL resources
      if (gl) {
        for (const b of buffers) gl.deleteBuffer(b);
        if (vao) gl.deleteVertexArray(vao);
        if (program) gl.deleteProgram(program);
        const ext = gl.getExtension("WEBGL_lose_context");
        ext?.loseContext();
      }
    };
  }, [geo]);

  // Re-arm when a controlled input changes while parked.
  useEffect(() => {
    armRef.current?.();
  }, [stage, staticFrame, prefersReduced, hoveredAnchor, corePulse]);

  return (
    <div
      ref={wrapRef}
      className={cn("hydra-webgl-field relative w-full", className)}
      style={{ aspectRatio: `${VB_W} / ${VB_H}` }}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="block h-auto w-full" />
      {/* Cinematic vignette sits ABOVE the additive canvas — a pure CSS gradient,
          costs nothing per frame, never touches GL fill-rate. Film grain is baked
          into the shader (per-fragment, DPR-proof) rather than a CSS noise layer,
          which avoids the data-URI/feTurbulence decode failures at high DPR. */}
      <div className="hydra-webgl-vignette pointer-events-none absolute inset-0" />
    </div>
  );
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export default WebGLMemoryField;
