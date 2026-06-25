"use client";

import { useMemo } from "react";
import { cn } from "@/lib/cn";
import {
  BRANCHES,
  DEMO_BADGES,
  DEMO_TAINTED_PATH,
  VB_W,
  VB_H,
  badgeCenter,
} from "./artifactTreeData";
import { CORE, CORE_RADIUS } from "./neuralCoreData";

/**
 * A crisp, lightweight MONOCHROME poster for the WebGL hero — the static first
 * frame. Used three ways:
 *   1. `next/dynamic({ loading })` while the WebGL chunk streams in.
 *   2. The `prefers-reduced-motion` fallback (no animation at all).
 *   3. The graceful fallback when WebGL2 is unavailable.
 *
 * It is pure SVG (resolution-independent → razor sharp at 4K) built from the
 * SAME tree geometry as the GPU field: the branch limbs as faint white strokes,
 * a seeded scatter of glowing dots along them (the voxel feel), a luminous core
 * glow, and the tainted chain reading a touch hotter. Seeded mulberry32 →
 * deterministic, so loading→reduced-motion→WebGL never flicker between layouts.
 * Renders with zero JS work after mount (no rAF, no listeners).
 */
export function WebGLMemoryFieldPoster({ className }: { className?: string }) {
  const { dots, taintDots } = useMemo(() => buildPosterDots(), []);

  return (
    <div
      className={cn("hydra-webgl-field relative w-full", className)}
      style={{ aspectRatio: `${VB_W} / ${VB_H}` }}
      aria-hidden="true"
    >
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="block h-auto w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <radialGradient id="hsfCore" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.95)" />
            <stop offset="22%" stopColor="rgba(238,242,250,0.45)" />
            <stop offset="55%" stopColor="rgba(196,206,222,0.12)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
          <radialGradient id="hsfDot" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255,255,255,1)" />
            <stop offset="45%" stopColor="rgba(255,255,255,0.5)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
        </defs>

        {/* faint branch strokes — the tree skeleton */}
        <g fill="none" stroke="rgba(214,222,234,0.10)" strokeLinecap="round">
          {BRANCHES.map((b, i) => (
            <path key={i} d={b.d} strokeWidth={b.width * 0.6} />
          ))}
        </g>

        {/* core volumetric glow */}
        <circle
          cx={CORE.x}
          cy={CORE.y}
          r={CORE_RADIUS * 2.2}
          fill="url(#hsfCore)"
        />

        {/* scattered glowing motes along the limbs (the voxel field, downsampled) */}
        <g>
          {dots.map((d, i) => (
            <circle key={i} cx={d.x} cy={d.y} r={d.r} fill="url(#hsfDot)" opacity={d.a} />
          ))}
        </g>

        {/* tainted chain — a touch hotter/denser */}
        <g>
          {taintDots.map((d, i) => (
            <circle key={i} cx={d.x} cy={d.y} r={d.r} fill="url(#hsfDot)" opacity={d.a} />
          ))}
        </g>
      </svg>

      {/* matching cinematic vignette so the poster reads identically to the field.
          (Grain is baked into the live field's shader; the static poster relies on
          its own dot texture, so no separate grain layer is needed here.) */}
      <div className="hydra-webgl-vignette pointer-events-none absolute inset-0" />
    </div>
  );
}

// ---- deterministic poster geometry (tiny — a few hundred dots) --------------
interface Dot {
  x: number;
  y: number;
  r: number;
  a: number;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function parsePts(d: string) {
  const n = d.match(/-?\d+(?:\.\d+)?/g)?.map(Number);
  if (!n || n.length < 8) return null;
  return [
    { x: n[0], y: n[1] },
    { x: n[2], y: n[3] },
    { x: n[4], y: n[5] },
    { x: n[6], y: n[7] },
  ] as const;
}
function cubicAt(p: ReturnType<typeof parsePts>, t: number) {
  if (!p) return { x: 0, y: 0 };
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const c = 3 * mt * t * t;
  const e = t * t * t;
  return {
    x: a * p[0].x + b * p[1].x + c * p[2].x + e * p[3].x,
    y: a * p[0].y + b * p[1].y + c * p[2].y + e * p[3].y,
  };
}
function quadAt(a: { x: number; y: number }, ctrl: { x: number; y: number }, b: { x: number; y: number }, t: number) {
  const mt = 1 - t;
  const ka = mt * mt;
  const kb = 2 * mt * t;
  const ke = t * t;
  return { x: ka * a.x + kb * ctrl.x + ke * b.x, y: ka * a.y + kb * ctrl.y + ke * b.y };
}

function buildPosterDots(): { dots: Dot[]; taintDots: Dot[] } {
  const rng = mulberry32(0x5e27c1);
  const dots: Dot[] = [];

  // core nebula (downsampled)
  for (let i = 0; i < 160; i++) {
    const ang = rng() * Math.PI * 2;
    const radFrac = Math.pow(rng(), 1.7);
    const r = radFrac * CORE_RADIUS;
    dots.push({
      x: CORE.x + Math.cos(ang) * r,
      y: CORE.y + Math.sin(ang) * r * 0.9,
      r: 0.8 + (1 - radFrac) * 1.6 + rng() * 0.6,
      a: Math.min(1, 0.4 + (1 - radFrac) * 0.6),
    });
  }

  // branch motes
  for (const b of BRANCHES) {
    const pts = parsePts(b.d);
    if (!pts) continue;
    const density = b.order === 0 ? 14 : b.order === 1 ? 9 : b.order === 2 ? 6 : 3;
    for (let i = 0; i < density; i++) {
      const t = (i + rng() * 0.6) / density;
      const p = cubicAt(pts, t);
      const spread = 4 + b.width * 1.6;
      dots.push({
        x: p.x + (rng() - 0.5) * spread,
        y: p.y + (rng() - 0.5) * spread,
        r: 0.7 + (b.order === 0 ? 1.1 : 0.7) * (1 - t) + rng() * 0.4,
        a: Math.max(0.12, b.bright * (1 - t * 0.45) * (0.6 + rng() * 0.4)),
      });
    }
  }

  // safe spokes (sparse)
  DEMO_BADGES.forEach((badge, i) => {
    if (badge.tainted) return;
    const node = { x: badge.x, y: badge.y };
    const bow = (i % 2 === 0 ? 1 : -1) * 0.16;
    const mx = (CORE.x + node.x) / 2;
    const my = (CORE.y + node.y) / 2;
    const dx = node.x - CORE.x;
    const dy = node.y - CORE.y;
    const len = Math.hypot(dx, dy) || 1;
    const ctrl = { x: mx + (-dy / len) * bow * len, y: my + (dx / len) * bow * len };
    for (let k = 0; k < 18; k++) {
      const t = (k + rng() * 0.6) / 18;
      const p = quadAt(CORE, ctrl, node, t);
      dots.push({
        x: p.x + (rng() - 0.5) * 4,
        y: p.y + (rng() - 0.5) * 4,
        r: 0.6 + rng() * 0.7,
        a: 0.2 + rng() * 0.25,
      });
    }
  });

  // tainted chain — hotter
  const taintDots: Dot[] = [];
  for (let i = 0; i < DEMO_TAINTED_PATH.length - 1; i++) {
    const a = badgeCenter(DEMO_TAINTED_PATH[i]);
    const b = badgeCenter(DEMO_TAINTED_PATH[i + 1]);
    const bow = (i % 2 === 0 ? -1 : 1) * 0.18;
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ctrl = { x: mx + (-dy / len) * bow * len, y: my + (dx / len) * bow * len };
    for (let k = 0; k < 26; k++) {
      const t = (k + rng() * 0.6) / 26;
      const p = quadAt(a, ctrl, b, t);
      taintDots.push({
        x: p.x + (rng() - 0.5) * 6,
        y: p.y + (rng() - 0.5) * 6,
        r: 1.0 + rng() * 1.0,
        a: 0.6 + rng() * 0.3,
      });
    }
  }

  return { dots, taintDots };
}

export default WebGLMemoryFieldPoster;
