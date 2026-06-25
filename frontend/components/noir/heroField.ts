/**
 * Deterministic particle-field model for the Constellan hero — a monochrome
 * "guarded memory graph". HydraDB renders its graph as a luminous voxel tree of
 * thousands of heat-mapped dots that grow and shimmer; Constellan renders the
 * same DNA in STRICT MONOCHROME: a dense breathing CORE cluster with synaptic
 * EDGES built from streams of silver particles that flow core -> node like
 * memories. Danger is intensity (brighter / faster / denser white), never hue.
 *
 * Everything here is a pure function of FIXED data or a SEEDED PRNG (mulberry32)
 * — no Math.random / Date at module scope — so SSR and client render
 * byte-identical (no hydration drift). Coordinate space reuses the 1000 x 720
 * viewBox so the HTML node-badge overlay + inspector line up unchanged.
 */
import {
  CANOPY,
  DEMO_BADGES,
  DEMO_TAINTED_PATH,
  VB_W,
  VB_H,
  badgeCenter,
} from "./artifactTreeData";
import {
  CORE,
  CORE_RADIUS,
  DEMO_CONNECTIONS,
  quadAt,
  type Connection,
  type Pt,
} from "./neuralCoreData";

export { VB_W, VB_H, CORE, CORE_RADIUS, quadAt };
export type { Pt, Connection };

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

/**
 * One particle riding an EDGE. We don't store a live position — only the
 * immutable spawn parameters; the renderer evaluates position from `now` so
 * there is zero per-frame allocation and the field is fully deterministic.
 */
export interface EdgeParticle {
  connIndex: number; // which Connection it rides
  /** 0..1 phase offset along the travel cycle. */
  offset: number;
  /** lateral scatter off the curve centreline (vb units, signed). */
  jitter: number;
  /** base radius (vb units). */
  size: number;
  /** base brightness 0..1. */
  bright: number;
  /** travel-speed multiplier (small variance so the stream isn't lockstep). */
  speed: number;
}

/**
 * One particle in the CORE cluster — a dense breathing nebula of memory. Stored
 * in polar form around the core so the breathe scale is a single multiply.
 */
export interface CoreParticle {
  ang: number; // angle around core
  rad: number; // radius fraction 0..1 of CORE_RADIUS
  size: number;
  bright: number;
  /** orbit angular velocity (rad/sec, signed) — slow swirl. */
  spin: number;
  /** twinkle phase. */
  twinkle: number;
  /** depth 0..1 (near=1) for parallax + DoF. */
  depth: number;
}

/** Free-floating atmosphere mote (drift + parallax, gives the field air). */
export interface DustParticle {
  x: number;
  y: number;
  size: number;
  bright: number;
  vx: number;
  vy: number;
  twinkle: number;
  /** depth 0..1 (near=1) — parallax + DoF strength. */
  depth: number;
}

export interface HeroField {
  coreParticles: CoreParticle[];
  dust: DustParticle[];
}

// ---- tuning (named, no magic numbers in the hot loop) ------------------------
// We have huge frame-budget headroom (~0.6ms/frame), so the field is DENSE for
// HydraDB-grade voxel richness — thousands of discrete motes, not a sparse glow.
const CORE_PARTICLE_COUNT = 460; // dense nebula cluster (reads as structure)
const HALO_PARTICLE_COUNT = 140; // looser motes orbiting beyond the core body
const DUST_COUNT = 150;

/** Build the immutable particle field. Seeded → identical on server + client. */
export function buildHeroField(): HeroField {
  const rng = mulberry32(0x5e27);

  // CORE: a dense cluster biased toward the centre (pow crowds the middle → a
  // luminous mind of discrete motes, not a flat ring), PLUS a looser corona of
  // motes that extends past the core body so the cluster has structure + reach
  // instead of one tight blob. Brightness rises toward the centre; the centre is
  // densest, the corona sparser — the eye reads a real particle nebula.
  const coreParticles: CoreParticle[] = [];
  for (let i = 0; i < CORE_PARTICLE_COUNT; i++) {
    const ang = rng() * Math.PI * 2;
    const radFrac = Math.pow(rng(), 1.5); // crowd the centre
    const depth = 0.5 + (1 - radFrac) * 0.5; // centre reads nearer/sharper
    coreParticles.push({
      ang,
      rad: radFrac,
      // smaller, crisper motes so individuals READ (no fat overlapping discs)
      size: 0.5 + rng() * (radFrac < 0.25 ? 1.6 : 0.9),
      bright: Math.min(1, 0.4 + (1 - radFrac) * 0.7 + rng() * 0.22),
      spin: (rng() - 0.5) * 0.45,
      twinkle: rng(),
      depth,
    });
  }
  // corona: motes from the core edge outward (rad 0.9..1.9), dimmer + slower, so
  // the cluster dissolves into the field instead of ending at a hard rim.
  for (let i = 0; i < HALO_PARTICLE_COUNT; i++) {
    const ang = rng() * Math.PI * 2;
    const rad = 0.9 + rng() * 1.0;
    coreParticles.push({
      ang,
      rad,
      size: 0.5 + rng() * 1.0,
      bright: 0.18 + rng() * 0.26,
      spin: (rng() - 0.5) * 0.32,
      twinkle: rng(),
      depth: 0.4 + rng() * 0.35,
    });
  }

  // DUST: sparse atmosphere drifting up, parallaxed by depth.
  const dust: DustParticle[] = [];
  for (let i = 0; i < DUST_COUNT; i++) {
    const depth = Math.pow(rng(), 1.3); // mostly far, a few near
    dust.push({
      x: rng() * VB_W,
      y: rng() * VB_H,
      size: 0.5 + depth * 1.8,
      bright: 0.05 + depth * 0.22,
      vx: (rng() - 0.5) * 5,
      vy: -(1.5 + rng() * 5),
      twinkle: rng(),
      depth,
    });
  }

  return { coreParticles, dust };
}

/**
 * Build the per-edge particle streams for a given connection set. Denser +
 * brighter + faster streams on tainted edges (danger = intensity). Pure given
 * the connections, so memoise on the connections reference.
 */
export function buildEdgeParticles(connections: Connection[]): EdgeParticle[] {
  const rng = mulberry32(0x1c4f);
  const out: EdgeParticle[] = [];
  connections.forEach((c, connIndex) => {
    // particle count scales with depth (near edges denser) + taint.
    const base = c.tainted ? 18 : 6 + Math.round(c.depth * 8);
    for (let i = 0; i < base; i++) {
      out.push({
        connIndex,
        offset: (i / base + rng() * 0.12) % 1,
        jitter: (rng() - 0.5) * (c.tainted ? 5 : 3.2),
        size: (c.tainted ? 1.5 : 1.0) + rng() * 1.4,
        bright: (c.tainted ? 0.75 : 0.4 + c.depth * 0.35) + rng() * 0.2,
        speed: 0.85 + rng() * 0.3,
      });
    }
  });
  return out;
}

/**
 * Perpendicular unit vector of a connection's chord, for lateral scatter of
 * edge particles off the centreline. Precomputed per connection by the renderer.
 */
export function chordNormal(c: Connection): Pt {
  const dx = c.p1.x - c.p0.x;
  const dy = c.p1.y - c.p0.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: -dy / len, y: dx / len };
}

export { DEMO_CONNECTIONS, DEMO_BADGES, DEMO_TAINTED_PATH, CANOPY, badgeCenter };
