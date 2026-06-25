/**
 * Deterministic VOXEL layout for the hero tree canvas.
 *
 * The tree is rasterised ONCE at module load into a flat array of square cells
 * on an integer grid (no Math.random / Date at render -> SSR-safe, no hydration
 * drift). Brightness per cell encodes white intensity: hot trunk + the tainted
 * path burn brightest, outer twigs fade. This is the cheap, pixel-perfect
 * replacement for the per-frame framer-motion SVG strokes — the canvas draws
 * crisp white squares at any DPR, the layout never recomputes.
 *
 * Coordinate space matches artifactTreeData's 1000x720 viewBox so the existing
 * HTML node-badge overlay lines up unchanged.
 */
import {
  BRANCHES,
  DEMO_BADGES,
  DEMO_TAINTED_PATH,
  VB_W,
  VB_H,
  badgeCenter,
} from "./artifactTreeData";
import type { Graph } from "@/lib/types";

// Grid cell size in viewBox units. ~5px cells over a 1000-wide board => a dense
// but legible voxel tree. The canvas snaps each cell to integer device pixels.
export const CELL = 5;
export const GRID_W = Math.ceil(VB_W / CELL); // 200 columns
export const GRID_H = Math.ceil(VB_H / CELL); // 144 rows

export interface Voxel {
  /** Grid column / row (integer). */
  gx: number;
  gy: number;
  /** White intensity 0..1 (drawn as alpha). */
  bright: number;
  /** On the tainted chain -> white-hot + the only cells that pulse. */
  tainted: boolean;
  /**
   * Reveal bucket 0..1 by distance from the tree base (0 = base, 1 = tips).
   * The build-in animation fills cells whose `reveal` <= progress.
   */
  reveal: number;
  /**
   * Demo stage at which this voxel becomes eligible (so a controlled stage can
   * gate which layers show without per-frame React churn). Trunk/branches seed
   * early; the tainted chain appears with CONFLICT.
   */
  stage: number;
}

// ---- deterministic PRNG (mulberry32) — same as artifactTreeData -------------
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

interface Pt {
  x: number;
  y: number;
}
function parsePathPoints(d: string): [Pt, Pt, Pt, Pt] | null {
  const nums = d.match(/-?\d+(?:\.\d+)?/g)?.map(Number);
  if (!nums || nums.length < 8) return null;
  return [
    { x: nums[0], y: nums[1] },
    { x: nums[2], y: nums[3] },
    { x: nums[4], y: nums[5] },
    { x: nums[6], y: nums[7] },
  ];
}
function cubicAt(p: [Pt, Pt, Pt, Pt], t: number): Pt {
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

// The base row (bottom of the trunk) — reveal distance is measured from here.
const BASE_GY = (VB_H - 30) / CELL;

function revealFor(gy: number): number {
  // 1 at the base, 0 at the very top; clamp to 0..1.
  const r = (BASE_GY - gy) / BASE_GY;
  return Math.max(0, Math.min(1, r));
}

/**
 * Rasterise one bezier into grid cells with a brush whose half-width grows with
 * the stroke width. Returns a map keyed by "gx,gy" so overlapping limbs keep the
 * brightest contribution (trunk stays hottest where branches cross it).
 */
function stampBezier(
  acc: Map<string, Voxel>,
  pts: [Pt, Pt, Pt, Pt],
  width: number,
  bright: number,
  stage: number,
  tainted: boolean,
  rng: () => number,
) {
  const half = Math.max(0, Math.round(width / CELL / 1.4));
  const steps = 120;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const p = cubicAt(pts, t);
    const cgx = Math.round(p.x / CELL);
    const cgy = Math.round(p.y / CELL);
    for (let ox = -half; ox <= half; ox++) {
      for (let oy = -half; oy <= half; oy++) {
        const gx = cgx + ox;
        const gy = cgy + oy;
        if (gx < 0 || gy < 0 || gx >= GRID_W || gy >= GRID_H) continue;
        // Round brush: skip corners so limbs read as rounded, not blocky bars.
        if (ox * ox + oy * oy > half * half + 0.5) continue;
        // Edge cells of a thick limb dim slightly; add a touch of seeded
        // sparkle so the tree shimmers like embers rather than a solid fill.
        const edge = half > 0 ? 1 - (Math.hypot(ox, oy) / (half + 1)) * 0.5 : 1;
        const jitter = 0.85 + rng() * 0.15;
        const b = Math.min(1, bright * edge * jitter);
        const key = `${gx},${gy}`;
        const prev = acc.get(key);
        if (!prev || b > prev.bright || (tainted && !prev.tainted)) {
          acc.set(key, {
            gx,
            gy,
            bright: prev ? Math.max(prev.bright, b) : b,
            tainted: tainted || (prev?.tainted ?? false),
            reveal: revealFor(gy),
            stage: prev ? Math.min(prev.stage, stage) : stage,
          });
        }
      }
    }
  }
}

/** Rasterise a straight edge (badge -> badge / badge -> canopy). */
function stampLine(
  acc: Map<string, Voxel>,
  a: Pt,
  b: Pt,
  width: number,
  bright: number,
  stage: number,
  tainted: boolean,
) {
  const half = Math.max(0, Math.round(width / CELL / 1.4));
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  const steps = Math.max(2, Math.round(dist / (CELL * 0.7)));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    const cgx = Math.round(x / CELL);
    const cgy = Math.round(y / CELL);
    for (let ox = -half; ox <= half; ox++) {
      for (let oy = -half; oy <= half; oy++) {
        const gx = cgx + ox;
        const gy = cgy + oy;
        if (gx < 0 || gy < 0 || gx >= GRID_W || gy >= GRID_H) continue;
        if (ox * ox + oy * oy > half * half + 0.5) continue;
        const key = `${gx},${gy}`;
        const prev = acc.get(key);
        if (!prev || tainted || bright > prev.bright) {
          acc.set(key, {
            gx,
            gy,
            bright: prev ? Math.max(prev.bright, bright) : bright,
            tainted: tainted || (prev?.tainted ?? false),
            reveal: revealFor(gy),
            stage: prev ? Math.min(prev.stage, stage) : stage,
          });
        }
      }
    }
  }
}

// ---- demo voxel field (built once) ------------------------------------------
function buildDemoVoxels(): Voxel[] {
  const rng = mulberry32(0x5e3d);
  const acc = new Map<string, Voxel>();

  // 1) trunk + branches — seeded early (stage >= 1, trunk at 0).
  for (const b of BRANCHES) {
    const pts = parsePathPoints(b.d);
    if (!pts) continue;
    const stage = b.order === 0 ? 0 : 1;
    stampBezier(acc, pts, b.width, 0.34 + b.bright * 0.62, stage, false, rng);
  }

  // 2) safe node edges (badge -> canopy) — thin, dim, appear with retrieval.
  for (const e of DEMO_BADGES) {
    if (e.tainted) continue;
    const from = badgeCenter(e.id);
    const to = badgeCenter("canopy");
    stampLine(acc, from, to, 1.1, 0.3, Math.max(2, e.appearStage), false);
  }

  // 3) the TAINTED CHAIN — brightest white-hot voxels, appear with CONFLICT.
  //    memory -> conflict -> risk -> firewall (the path that caused + blocked
  //    the unsafe action).
  for (let i = 0; i < DEMO_TAINTED_PATH.length - 1; i++) {
    const a = badgeCenter(DEMO_TAINTED_PATH[i]);
    const b = badgeCenter(DEMO_TAINTED_PATH[i + 1]);
    stampLine(acc, a, b, 2.6, 1, 4, true);
  }

  return [...acc.values()];
}

export const DEMO_VOXELS: Voxel[] = buildDemoVoxels();

// ---- real-graph voxels (built on demand from a run graph) -------------------
// Lays a real run's edges into the same grid so /graph, /results, /replay get a
// voxel tree honoring their `graph` prop. Tainted membership = tainted_path.
export function buildRealVoxels(
  graph: Graph,
  badgeCenters: Map<string, Pt>,
): Voxel[] {
  const taint = new Set(graph.tainted_path ?? []);
  const acc = new Map<string, Voxel>();
  for (const edge of graph.edges) {
    const a = badgeCenters.get(edge.source);
    const b = badgeCenters.get(edge.target);
    if (!a || !b) continue;
    const tainted =
      edge.tainted || taint.has(edge.source) || taint.has(edge.target);
    stampLine(
      acc,
      a,
      b,
      tainted ? 2.6 : 1.2,
      tainted ? 1 : 0.32,
      tainted ? 4 : 2,
      tainted,
    );
  }
  return [...acc.values()];
}
