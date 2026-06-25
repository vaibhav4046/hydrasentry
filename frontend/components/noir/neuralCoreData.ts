/**
 * Deterministic geometry for the NeuralMemoryCore hero.
 *
 * Constellan guards an agent's MEMORY. We render that memory as a luminous
 * neural CORE: a glowing center with elegant CURVED synaptic connections
 * radiating out to the context nodes, light pulses travelling the connections
 * like thoughts. Everything is computed from FIXED data or a SEEDED PRNG
 * (mulberry32) — no Math.random / Date at module or render scope — so SSR and
 * client render byte-identical and there is no hydration drift.
 *
 * Coordinate space reuses artifactTreeData's 1000 x 720 viewBox so the existing
 * HTML node-badge overlay lines up unchanged. The CORE sits at CORE (the old
 * canopy focal point); each connection is a quadratic bezier from the core to a
 * node, bowed organically (water-like flow, never a ruler line). Depth comes
 * from per-connection brightness/blur, never from hue. STRICT MONOCHROME.
 */
import {
  CANOPY,
  DEMO_BADGES,
  DEMO_TAINTED_PATH,
  VB_W,
  VB_H,
  badgeCenter,
  type BadgeColumn,
} from "./artifactTreeData";
import type { Graph } from "@/lib/types";

export { VB_W, VB_H };

/** The luminous memory core — the focal point everything connects to. */
export const CORE = { x: CANOPY.x, y: 330 };
/** Core glow radius in viewBox units (the soft luminous body, not the sprite). */
export const CORE_RADIUS = 88;

// ---- deterministic PRNG (mulberry32) — same generator as artifactTreeData ----
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

export interface Pt {
  x: number;
  y: number;
}

/**
 * A synaptic connection: a quadratic bezier (p0 -> control -> p1) with a depth
 * factor (1 = near/bright/sharp, 0 = far/dim/soft) and the demo stage at which
 * it lights up. Tainted links burn brighter and pulse hotter.
 */
export interface Connection {
  id: string;
  /** Endpoint node ids (or "core"). */
  from: string;
  to: string;
  p0: Pt;
  ctrl: Pt;
  p1: Pt;
  /** 0..1 depth — drives brightness, line width and glow blur. */
  depth: number;
  tainted: boolean;
  /** Eligible from this demo stage onward (gated cheaply, no React churn). */
  stage: number;
  /** Number of travelling pulses riding this connection. */
  pulses: number;
  /** Phase offset 0..1 so pulses stagger rather than march in lockstep. */
  phase: number;
}

/**
 * Bow a straight segment into an organic curve. The control point is the
 * midpoint pushed perpendicular to the chord by `bow` (a signed fraction of the
 * chord length) — alternating sign per index gives the web a natural, non-radial
 * sway instead of clean spokes.
 */
function curve(a: Pt, b: Pt, bow: number): Pt {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  // perpendicular unit vector
  const nx = -dy / len;
  const ny = dx / len;
  const push = bow * len;
  return { x: mx + nx * push, y: my + ny * push };
}

/** Depth heuristic: nodes nearer the core (and the task at top) read sharper. */
function depthFor(node: Pt): number {
  const d = Math.hypot(node.x - CORE.x, node.y - CORE.y);
  // Map ~110..420 vb-units onto 1..0.42 so even far nodes stay legible.
  const t = (d - 110) / (420 - 110);
  return Math.max(0.42, Math.min(1, 1 - t * 0.58));
}

// ---- demo connection web (built once) ---------------------------------------
function buildDemoConnections(): Connection[] {
  const rng = mulberry32(0x4ad7);
  const out: Connection[] = [];

  // 1) CORE -> every node (the radiating synapses). Bow alternates for sway.
  DEMO_BADGES.forEach((badge, i) => {
    const node = { x: badge.x, y: badge.y };
    const depth = depthFor(node);
    const tainted = badge.tainted;
    const bow = (i % 2 === 0 ? 1 : -1) * (0.1 + rng() * 0.12);
    out.push({
      id: `core-${badge.id}`,
      from: "core",
      to: badge.id,
      p0: { ...CORE },
      ctrl: curve(CORE, node, bow),
      p1: node,
      depth,
      tainted,
      stage: Math.max(2, badge.appearStage),
      pulses: tainted ? 2 : depth > 0.7 ? 1 : 0,
      phase: rng(),
    });
  });

  // 2) the TAINTED CHAIN as node->node links (the dramatic memory->firewall
  //    route). These ride ON TOP, brightest, and carry hot fast pulses.
  for (let i = 0; i < DEMO_TAINTED_PATH.length - 1; i++) {
    const fromId = DEMO_TAINTED_PATH[i];
    const toId = DEMO_TAINTED_PATH[i + 1];
    const a = badgeCenter(fromId);
    const b = badgeCenter(toId);
    const bow = (i % 2 === 0 ? -1 : 1) * (0.16 + rng() * 0.08);
    out.push({
      id: `taint-${fromId}-${toId}`,
      from: fromId,
      to: toId,
      p0: a,
      ctrl: curve(a, b, bow),
      p1: b,
      depth: 1,
      tainted: true,
      // memory->conflict at CONFLICT(4), conflict->risk at RISK(5), etc.
      stage: 4 + i,
      pulses: 2,
      phase: rng(),
    });
  }

  // 3) a few elegant node-to-node links forming a neural web (safe, dim).
  const WEB: Array<[string, string]> = [
    ["policy", "document"],
    ["document", "skill"],
    ["retrieval", "chunk"],
    ["skill", "tool"],
  ];
  for (const [fromId, toId] of WEB) {
    const a = badgeCenter(fromId);
    const b = badgeCenter(toId);
    const bow = (rng() - 0.5) * 0.3;
    out.push({
      id: `web-${fromId}-${toId}`,
      from: fromId,
      to: toId,
      p0: a,
      ctrl: curve(a, b, bow),
      p1: b,
      depth: 0.5,
      tainted: false,
      stage: 3,
      pulses: 0,
      phase: rng(),
    });
  }

  return out;
}

export const DEMO_CONNECTIONS: Connection[] = buildDemoConnections();

// ---- atmosphere: drifting depth particles (built once) ----------------------
export interface DriftParticle {
  x: number;
  y: number;
  r: number;
  bright: number;
  /** Drift speed (vb-units/sec) and direction. */
  vx: number;
  vy: number;
  phase: number;
}

function buildDrift(): DriftParticle[] {
  const rng = mulberry32(0x91b2);
  const out: DriftParticle[] = [];
  const COUNT = 38; // capped — tasteful atmosphere, not a swarm.
  for (let i = 0; i < COUNT; i++) {
    out.push({
      x: rng() * VB_W,
      y: rng() * VB_H,
      r: 0.6 + rng() * 1.7,
      bright: 0.06 + rng() * 0.22,
      vx: (rng() - 0.5) * 6,
      vy: -(2 + rng() * 6), // gently rise
      phase: rng(),
    });
  }
  return out;
}

export const DRIFT_PARTICLES: DriftParticle[] = buildDrift();

// ---- evaluate a quadratic bezier + tangent (for pulse placement) ------------
export function quadAt(c: Connection, t: number): Pt {
  const mt = 1 - t;
  const a = mt * mt;
  const b = 2 * mt * t;
  const e = t * t;
  return {
    x: a * c.p0.x + b * c.ctrl.x + e * c.p1.x,
    y: a * c.p0.y + b * c.ctrl.y + e * c.p1.y,
  };
}

// ---- real-graph connections (built on demand from a run graph) --------------
// Lays a real run's edges into the same core-and-spokes web so /graph, /results
// and /replay honour their `graph` prop. Tainted membership = tainted_path.
export function buildRealConnections(
  graph: Graph,
  centers: Map<string, Pt>,
): Connection[] {
  const taint = new Set(graph.tainted_path ?? []);
  const out: Connection[] = [];
  let i = 0;
  for (const edge of graph.edges) {
    const a = centers.get(edge.source) ?? centers.get("core");
    const b = centers.get(edge.target);
    if (!a || !b) continue;
    const tainted =
      Boolean(edge.tainted) ||
      taint.has(edge.source) ||
      taint.has(edge.target);
    const depth = depthFor(b);
    const bow = (i % 2 === 0 ? 1 : -1) * 0.14;
    out.push({
      id: `real-${edge.source}-${edge.target}-${i}`,
      from: edge.source,
      to: edge.target,
      p0: a,
      ctrl: curve(a, b, bow),
      p1: b,
      depth: tainted ? 1 : depth,
      tainted,
      stage: 2,
      pulses: tainted ? 2 : depth > 0.7 ? 1 : 0,
      phase: (i * 0.37) % 1,
    });
    i += 1;
  }
  // Also spoke the core to each node so the core reads as the hub of the graph.
  for (const [id, pos] of centers) {
    if (id === "core") continue;
    const tainted = taint.has(id);
    const depth = depthFor(pos);
    out.push({
      id: `real-core-${id}`,
      from: "core",
      to: id,
      p0: { ...CORE },
      ctrl: curve(CORE, pos, (i % 2 === 0 ? -1 : 1) * 0.11),
      p1: pos,
      depth: tainted ? 1 : depth,
      tainted,
      stage: 2,
      pulses: tainted ? 1 : 0,
      phase: (i * 0.21) % 1,
    });
    i += 1;
  }
  return out;
}

export type { BadgeColumn };
