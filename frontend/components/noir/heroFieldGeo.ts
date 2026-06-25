/**
 * Deterministic GPU-buffer geometry for the WebGL2 hero — the "guarded memory
 * graph" rendered as a dense particle FIELD that forms a recognizable organic
 * TREE/GRAPH silhouette (HydraDB's voxel-tree DNA) in STRICT MONOCHROME.
 *
 * This is the CPU side: it bakes ~30k–60k points into flat Float32Arrays ONCE
 * (seeded mulberry32 → byte-identical on server import and client, no hydration
 * drift, no Math.random / Date at module scope). Each point carries its base
 * target position plus the per-point attributes the vertex shader needs to
 * animate it (branch flow, noise drift, mouse displacement, tainted intensity).
 *
 * Coordinate space is the SAME 1000 x 720 viewBox the badge overlay + inspector
 * use, so the HTML node badges line up over the canvas exactly as they did with
 * the 2D NeuralMemoryCore. The renderer maps viewBox → clip space in the shader.
 *
 * The silhouette is assembled from three families, all monochrome:
 *   1. CORE   — a dense breathing nebula cluster (the agent's memory).
 *   2. BRANCH — points sampled along the hand-authored tree limbs (the trunk +
 *               canopy beziers from artifactTreeData), grid-biased so they read
 *               as discrete voxels growing outward, not a smooth airbrush.
 *   3. EDGE   — curved filaments streaming from the core out to each of the 11
 *               context-node anchors; the tainted chain (memory → conflict →
 *               risk → firewall) gets denser, brighter, faster-flowing points.
 *   + DUST    — sparse far atmosphere motes for depth/parallax.
 */
import {
  BRANCHES,
  DEMO_BADGES,
  DEMO_TAINTED_PATH,
  VB_W,
  VB_H,
  badgeCenter,
} from "./artifactTreeData";
import { CORE, CORE_RADIUS, type Pt } from "./neuralCoreData";
import { NO_ANCHOR, ANCHOR_IDS, ANCHOR_STAGE, anchorIndexFor } from "./heroAnchors";

export { VB_W, VB_H, CORE, CORE_RADIUS };
export type { Pt };
// Re-export the featherweight anchor helpers so the dynamic WebGL renderer can
// keep importing them from here; the eager hero wrapper imports them straight
// from ./heroAnchors so the heavy baker below never lands in the first-load chunk.
export { NO_ANCHOR, ANCHOR_IDS, ANCHOR_STAGE, anchorIndexFor };

/**
 * Per-point GPU attributes, packed into interleaved-free parallel arrays (one
 * VBO each — simplest, and lets us update none of them per frame; all motion is
 * in the shader from these immutable bases + uniforms).
 *
 *  aBase    : vec3  — base target position in viewBox space (x, y) + depth z in
 *                     [-1..1] (z<0 far/dim/small, z>0 near/bright/large).
 *  aRnd     : vec4  — per-point randoms: (phase, sizeSeed, brightSeed, driftSeed).
 *  aMeta    : vec4  — (kind, anchorIndex, tainted, flow):
 *                       kind     0=core 1=branch 2=edge 3=dust
 *                       anchorIndex  which node spoke this rides (or -1)
 *                       tainted  1 if on the tainted chain (brighter/faster)
 *                       flow     0..1 position ALONG its edge (edge pts only;
 *                                drives the core→node streaming animation)
 */
export interface HeroGeometry {
  count: number;
  base: Float32Array; // count * 3
  rnd: Float32Array; // count * 4
  meta: Float32Array; // count * 4
}

// ---- deterministic PRNG (mulberry32) — matches the rest of the codebase ------
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

// ---- cubic bezier sampling (branch limbs are cubic) --------------------------
interface Cubic {
  p0: Pt;
  p1: Pt;
  p2: Pt;
  p3: Pt;
}
function parseCubic(d: string): Cubic | null {
  const n = d.match(/-?\d+(?:\.\d+)?/g)?.map(Number);
  if (!n || n.length < 8) return null;
  return {
    p0: { x: n[0], y: n[1] },
    p1: { x: n[2], y: n[3] },
    p2: { x: n[4], y: n[5] },
    p3: { x: n[6], y: n[7] },
  };
}
function cubicAt(c: Cubic, t: number): Pt {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const cc = 3 * mt * t * t;
  const e = t * t * t;
  return {
    x: a * c.p0.x + b * c.p1.x + cc * c.p2.x + e * c.p3.x,
    y: a * c.p0.y + b * c.p1.y + cc * c.p2.y + e * c.p3.y,
  };
}

/** Quadratic bezier (core→node filaments are quadratic, bowed). */
function quadAt(p0: Pt, ctrl: Pt, p1: Pt, t: number): Pt {
  const mt = 1 - t;
  const a = mt * mt;
  const b = 2 * mt * t;
  const e = t * t;
  return {
    x: a * p0.x + b * ctrl.x + e * p1.x,
    y: a * p0.y + b * ctrl.y + e * p1.y,
  };
}

/** Bow a chord into an organic control point (perpendicular push), like the
 *  2D web — alternating sign per spoke keeps the filaments from being clean
 *  radial spokes. */
function bowCtrl(a: Pt, b: Pt, bow: number): Pt {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: mx + (-dy / len) * bow * len, y: my + (dx / len) * bow * len };
}

// ---- density tuning (named; particle budget) --------------------------------
// HydraDB-grade density: tens of thousands of discrete motes forming the tree.
// `scale` lets the renderer dial the whole field down on mobile / low power
// without changing the silhouette (same seeded distribution, just fewer points).
export interface GeoOptions {
  /** 0..1 multiplier on every population (mobile/low-power → ~0.4). */
  scale?: number;
}

const CORE_COUNT = 9000; // dense central nebula
const CORE_CORONA = 3000; // looser motes spilling past the core body
const BRANCH_TOTAL = 24000; // points distributed across all tree limbs
const EDGE_PER_SPOKE = 900; // streaming points per core→node filament
const EDGE_TAINTED_BONUS = 700; // extra on tainted-chain links (denser/brighter)
const DUST_COUNT = 2200; // far atmosphere

const TAINTED_SET = new Set(DEMO_TAINTED_PATH);

/** Tainted chain links as ordered [fromId, toId] pairs (memory→…→firewall). */
const TAINTED_LINKS: Array<[string, string]> = DEMO_TAINTED_PATH.slice(0, -1).map(
  (id, i) => [id, DEMO_TAINTED_PATH[i + 1]],
);

/**
 * Build the immutable hero geometry. Seeded → identical every call; the renderer
 * builds it once and uploads the arrays to the GPU. `scale` shrinks every
 * population uniformly (mobile) while preserving the silhouette and determinism.
 */
export function buildHeroGeometry(opts: GeoOptions = {}): HeroGeometry {
  const scale = clamp01(opts.scale ?? 1);
  const rng = mulberry32(0x5e27c1);

  // Resolve scaled counts up-front so we can size the typed arrays exactly.
  const coreN = Math.round(CORE_COUNT * scale);
  const coronaN = Math.round(CORE_CORONA * scale);
  const branchN = Math.round(BRANCH_TOTAL * scale);
  const dustN = Math.round(DUST_COUNT * scale);

  // Pre-build the spokes (core → each anchor) so we know their point counts.
  const spokes = DEMO_BADGES.map((badge, i) => {
    const node: Pt = { x: badge.x, y: badge.y };
    const bow = (i % 2 === 0 ? 1 : -1) * (0.1 + rng() * 0.12);
    const tainted = badge.tainted;
    const n = Math.round(
      (EDGE_PER_SPOKE + (tainted ? EDGE_TAINTED_BONUS : 0)) * scale,
    );
    return {
      anchor: i,
      node,
      ctrl: bowCtrl(CORE, node, bow),
      tainted,
      n,
    };
  });

  // Tainted chain node→node links (drawn on top, hottest, fastest flow).
  const chain = TAINTED_LINKS.map(([fromId, toId], i) => {
    const a = badgeCenter(fromId);
    const b = badgeCenter(toId);
    const bow = (i % 2 === 0 ? -1 : 1) * (0.16 + rng() * 0.08);
    return {
      a,
      b,
      ctrl: bowCtrl(a, b, bow),
      anchor: anchorIndexFor(toId),
      n: Math.round((EDGE_PER_SPOKE + EDGE_TAINTED_BONUS) * scale),
    };
  });

  const edgeN =
    spokes.reduce((s, sp) => s + sp.n, 0) + chain.reduce((s, c) => s + c.n, 0);

  const count = coreN + coronaN + branchN + edgeN + dustN;
  const base = new Float32Array(count * 3);
  const rnd = new Float32Array(count * 4);
  const meta = new Float32Array(count * 4);

  let w = 0; // write cursor (point index)
  const put = (
    x: number,
    y: number,
    z: number,
    kind: number,
    anchor: number,
    tainted: number,
    flow: number,
    sizeSeed: number,
    brightSeed: number,
  ) => {
    const b3 = w * 3;
    base[b3] = x;
    base[b3 + 1] = y;
    base[b3 + 2] = z;
    const r4 = w * 4;
    rnd[r4] = rng(); // phase
    rnd[r4 + 1] = sizeSeed; // size seed
    rnd[r4 + 2] = brightSeed; // bright seed
    rnd[r4 + 3] = rng(); // drift seed (per-point noise offset)
    const m4 = w * 4;
    meta[m4] = kind;
    meta[m4 + 1] = anchor;
    meta[m4 + 2] = tainted;
    meta[m4 + 3] = flow;
    w += 1;
  };

  // ---- 1) CORE nebula -------------------------------------------------------
  // Crowd the centre (pow) for a luminous mind of discrete motes; depth biases
  // central motes nearer (sharper/brighter). Slight vertical squash for a more
  // organic ovoid than a perfect disc.
  for (let i = 0; i < coreN; i++) {
    const ang = rng() * Math.PI * 2;
    const radFrac = Math.pow(rng(), 1.7); // crowd centre
    const r = radFrac * CORE_RADIUS;
    const x = CORE.x + Math.cos(ang) * r;
    const y = CORE.y + Math.sin(ang) * r * 0.9;
    const z = (1 - radFrac) * 0.9 + (rng() - 0.5) * 0.25; // centre nearer
    const sizeSeed = 0.35 + rng() * (radFrac < 0.3 ? 0.9 : 0.5);
    const brightSeed = Math.min(1, 0.45 + (1 - radFrac) * 0.6 + rng() * 0.2);
    put(x, y, z, 0, NO_ANCHOR, 0, 0, sizeSeed, brightSeed);
  }
  // corona: motes from the rim outward, dimmer/farther — the cluster dissolves
  // into the field rather than ending at a hard edge.
  for (let i = 0; i < coronaN; i++) {
    const ang = rng() * Math.PI * 2;
    const r = (0.85 + rng() * 1.25) * CORE_RADIUS;
    const x = CORE.x + Math.cos(ang) * r;
    const y = CORE.y + Math.sin(ang) * r * 0.92;
    const z = -0.2 + (rng() - 0.5) * 0.5;
    put(x, y, z, 0, NO_ANCHOR, 0, 0, 0.3 + rng() * 0.5, 0.18 + rng() * 0.3);
  }

  // ---- 2) BRANCH limbs ------------------------------------------------------
  // Distribute the branch budget across limbs weighted by limb prominence
  // (thicker/brighter trunk & primaries get more points). Sample along each
  // bezier with a small GRID-SNAP on the jitter so the motes read as voxel-ish
  // steps growing outward, echoing HydraDB's grid tree without copying its hue.
  const cubics = BRANCHES.map((b) => ({ b, c: parseCubic(b.d) })).filter(
    (x): x is { b: (typeof BRANCHES)[number]; c: Cubic } => x.c !== null,
  );
  const weightOf = (order: number, width: number) =>
    (5 - order) * 2 + width; // trunk/primaries dominate
  const totalW = cubics.reduce((s, { b }) => s + weightOf(b.order, b.width), 0);
  const GRID = 7; // voxel step (vb units) the jitter snaps to
  for (const { b, c } of cubics) {
    const share = weightOf(b.order, b.width) / totalW;
    const n = Math.max(8, Math.round(branchN * share));
    const spread = 5 + b.width * 2.2; // thicker limbs → fatter point band
    for (let i = 0; i < n; i++) {
      // bias samples toward the limb base a touch (denser near trunk)
      const t = Math.pow((i + rng() * 0.6) / n, 1.08);
      const p = cubicAt(c, t);
      // lateral + along scatter, grid-snapped → voxel feel
      const jx = snap((rng() - 0.5) * spread, GRID * 0.5);
      const jy = snap((rng() - 0.5) * spread, GRID * 0.5);
      // taper brightness toward the twigs; thin tips become sparse embers
      const taper = 1 - t * 0.45;
      const brightSeed = Math.max(0.16, b.bright * taper * (0.7 + rng() * 0.4));
      const sizeSeed = 0.3 + (b.order === 0 ? 0.6 : 0.4) * (1 - t) + rng() * 0.3;
      // branch depth: nearer the trunk/core reads slightly nearer
      const z = -0.1 + (1 - t) * 0.4 + (rng() - 0.5) * 0.4;
      put(p.x + jx, p.y + jy, z, 1, NO_ANCHOR, 0, t, sizeSeed, brightSeed);
    }
  }

  // ---- 3) EDGE filaments (core → node spokes) -------------------------------
  // Streaming motes along each quadratic spoke. `flow` = position along the
  // curve; the shader animates a luminous packet travelling core→node by
  // modulating brightness with (flow, uTime). Tainted spokes are denser/brighter
  // (already more points) and the shader runs their packets faster.
  for (const sp of spokes) {
    for (let i = 0; i < sp.n; i++) {
      const t = (i + rng() * 0.8) / sp.n;
      const p = quadAt(CORE, sp.ctrl, sp.node, t);
      // lateral scatter off the centreline so the filament has body
      const dx = sp.node.x - CORE.x;
      const dy = sp.node.y - CORE.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const jit = (rng() - 0.5) * (sp.tainted ? 7 : 4.5);
      const x = p.x + nx * jit;
      const y = p.y + ny * jit;
      const z = 0.15 + (rng() - 0.5) * 0.5; // mid-field, gentle depth
      const brightSeed = sp.tainted
        ? 0.7 + rng() * 0.3
        : 0.32 + rng() * 0.4;
      const sizeSeed = (sp.tainted ? 0.5 : 0.32) + rng() * 0.5;
      put(x, y, z, 2, sp.anchor, sp.tainted ? 1 : 0, t, sizeSeed, brightSeed);
    }
  }
  // tainted chain node→node links on top (hottest)
  for (const c of chain) {
    for (let i = 0; i < c.n; i++) {
      const t = (i + rng() * 0.8) / c.n;
      const p = quadAt(c.a, c.ctrl, c.b, t);
      const dx = c.b.x - c.a.x;
      const dy = c.b.y - c.a.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const jit = (rng() - 0.5) * 6;
      put(
        p.x + nx * jit,
        p.y + ny * jit,
        0.35 + (rng() - 0.5) * 0.4,
        2,
        c.anchor,
        1,
        t,
        0.55 + rng() * 0.5,
        0.78 + rng() * 0.22,
      );
    }
  }

  // ---- 4) DUST atmosphere ---------------------------------------------------
  for (let i = 0; i < dustN; i++) {
    const z = -1 + Math.pow(rng(), 1.3) * 1.3; // mostly far
    put(
      rng() * VB_W,
      rng() * VB_H,
      z,
      3,
      NO_ANCHOR,
      0,
      rng(), // reuse flow slot as a drift seed for dust
      0.25 + rng() * 0.5,
      0.05 + (z + 1) * 0.12,
    );
  }

  return { count: w, base, rnd, meta };
}

// ---- small helpers ----------------------------------------------------------
function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
function snap(v: number, step: number): number {
  return Math.round(v / step) * step;
}

// Re-export the tainted membership predicate for the poster/renderer if needed.
export function isTaintedAnchor(id: string): boolean {
  return TAINTED_SET.has(id);
}
