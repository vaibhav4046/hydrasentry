"use client";

import { useMemo } from "react";
import { m, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";
import { EASE_OUT_EXPO } from "@/lib/motion";

interface MemoryTreeProps {
  className?: string;
  /** Run the grow -> nodes -> edges -> tainted-path arc (default true). */
  animate?: boolean;
  /** Show the bright `87 / RISK` node-box at top-right (default true). */
  showRisk?: boolean;
}

/**
 * Pixelated voxel "memory tree" + context node-box graph, in HydraSentry noir.
 *
 * Echoes HydraDB.com's signature hero, a tree built from thousands of small
 * square cells, a thick trunk splitting into branches that splay up and to the
 * RIGHT, scattering to embers at the tips, whose right limbs extend into a
 * graph of small outlined node-boxes joined by dashed edges. HydraDB renders it
 * as an orange heat-map; ours is strictly MONOCHROME: the "heat" becomes WHITE
 * BRIGHTNESS. Hottest cells (trunk core + the tainted path) are bright white;
 * cooler/outer cells fade to dim gray (#5F6875) and low opacity. No hue, ever
 * danger is intensity, not colour (the project's hard brand law).
 *
 * The rightward graph tells HydraSentry's story: node-boxes labelled `policy
 * v2`, `mem_poison_047`, `tool_action`, `MCP BLOCK`, and the bright `87 / RISK`.
 * The chain poison -> action -> RISK is the TAINTED PATH: brightest, heavier,
 * with a perpetual traveling dash + soft pulse. Other edges are faint dashed.
 *
 * Technique: SVG <rect> cells (vector-sharp at every DPI), count capped ~720.
 * Geometry is DETERMINISTIC, a seeded mulberry32 PRNG drives a fixed layout in
 * useMemo, so SSR and client render identical markup (no hydration mismatch, no
 * Math.random at module/render scope). GPU-light: animates only opacity /
 * transform / stroke-dashoffset. prefers-reduced-motion renders the fully
 * composed static scene (no growth, no loops).
 */

// ---- viewBox -----------------------------------------------------------------
// 360 wide x 460 tall. Tree grows upward from a base puck near y=438. Branches
// lean right; the upper-right quadrant hosts the node-box graph.
const VB_W = 360;
const VB_H = 460;

const CELL = 7; // square edge in user units
const GAP = 1; // visual gap -> rect drawn at CELL - GAP
const STEP = CELL; // grid pitch (cell centers land on this lattice)
const DRAW = CELL - GAP;

// ---- palette (monochrome only) ----------------------------------------------
const WHITE = "#FFFFFF";
const SILVER = "#D9DEE7";
const MUTED = "#5F6875"; // --hs-text-muted
const BLACK = "#000000";

// ---- deterministic PRNG ------------------------------------------------------
// mulberry32: tiny, fast, fully deterministic from a 32-bit seed. Used only to
// jitter cell placement and brightness so the silhouette reads organic while
// staying identical across SSR/CSR.
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

interface Cell {
  /** snapped grid coords (top-left of the rect) */
  gx: number;
  gy: number;
  /** 0..1 brightness; drives opacity + tone (white -> muted gray) */
  b: number;
  /** reveal bucket 0..N from base upward, for staggered growth */
  gen: number;
  /** true if part of the tainted limb -> rendered white-hot */
  taint: boolean;
}

interface Spine {
  /** start point */
  x0: number;
  y0: number;
  /** end point */
  x1: number;
  y1: number;
  /** half-thickness in cells at the base of this spine */
  t0: number;
  /** half-thickness in cells at the tip */
  t1: number;
  /** base brightness for this limb */
  bright: number;
  taint: boolean;
}

// Authored skeleton: trunk + limbs leaning up-and-right, then fine right twigs.
// Coordinates are hand-placed; the generator fills voxels around each spine.
const SPINES: Spine[] = [
  // trunk (thick, bright core), bottom-center rising slightly right
  { x0: 168, y0: 436, x1: 176, y1: 300, t0: 3.1, t1: 1.7, bright: 1.0, taint: false },
  // primary fork: left limb
  { x0: 176, y0: 318, x1: 120, y1: 236, t0: 1.7, t1: 0.9, bright: 0.66, taint: false },
  // primary fork: upright-left
  { x0: 174, y0: 322, x1: 156, y1: 214, t0: 1.6, t1: 0.8, bright: 0.62, taint: false },
  // primary fork: right limb (leans hard right -> toward graph)
  { x0: 176, y0: 314, x1: 246, y1: 250, t0: 1.9, t1: 1.0, bright: 0.78, taint: false },
  // primary fork: upright-right
  { x0: 176, y0: 320, x1: 206, y1: 212, t0: 1.6, t1: 0.8, bright: 0.6, taint: false },
  // secondary left twigs
  { x0: 120, y0: 236, x1: 86, y1: 190, t0: 0.9, t1: 0.5, bright: 0.46, taint: false },
  { x0: 120, y0: 236, x1: 104, y1: 168, t0: 0.9, t1: 0.5, bright: 0.42, taint: false },
  { x0: 156, y0: 214, x1: 138, y1: 156, t0: 0.8, t1: 0.45, bright: 0.42, taint: false },
  // secondary right twigs (denser, brighter, the active side)
  { x0: 246, y0: 250, x1: 286, y1: 214, t0: 0.95, t1: 0.5, bright: 0.56, taint: false },
  { x0: 246, y0: 250, x1: 300, y1: 246, t0: 0.9, t1: 0.5, bright: 0.5, taint: false },
  { x0: 206, y0: 212, x1: 236, y1: 168, t0: 0.8, t1: 0.45, bright: 0.46, taint: false },
  { x0: 206, y0: 212, x1: 190, y1: 158, t0: 0.7, t1: 0.4, bright: 0.4, taint: false },
  // fine canopy twigs (sparse embers)
  { x0: 86, y0: 190, x1: 70, y1: 152, t0: 0.5, t1: 0.3, bright: 0.34, taint: false },
  { x0: 138, y0: 156, x1: 126, y1: 120, t0: 0.5, t1: 0.3, bright: 0.34, taint: false },
  { x0: 236, y0: 168, x1: 250, y1: 128, t0: 0.5, t1: 0.3, bright: 0.36, taint: false },
  { x0: 286, y0: 214, x1: 304, y1: 182, t0: 0.5, t1: 0.3, bright: 0.36, taint: false },
];

// The tainted limb: a continuous chain off the right fork that drives the graph.
// Brightest, slightly thicker; cells flagged taint -> white-hot in render.
const TAINT_SPINES: Spine[] = [
  { x0: 176, y0: 314, x1: 238, y1: 256, t0: 1.5, t1: 1.0, bright: 1.0, taint: true },
  { x0: 238, y0: 256, x1: 288, y1: 196, t0: 1.0, t1: 0.8, bright: 1.0, taint: true },
  { x0: 288, y0: 196, x1: 316, y1: 138, t0: 0.85, t1: 0.6, bright: 1.0, taint: true },
];

/** Snap a coordinate to the cell lattice. */
function snap(v: number): number {
  return Math.round(v / STEP) * STEP;
}

/**
 * Walk a spine and stamp voxels in a thinning band around it. Brightness falls
 * off toward the tip and toward the band edges; a little seeded jitter scatters
 * the outer cells like embers. Returns a keyed map so overlapping limbs dedupe
 * to the brightest contributor.
 */
function stampSpine(
  spine: Spine,
  rng: () => number,
  out: Map<string, Cell>,
  genBase: number,
): void {
  const dx = spine.x1 - spine.x0;
  const dy = spine.y1 - spine.y0;
  const len = Math.hypot(dx, dy);
  const steps = Math.max(2, Math.round(len / (STEP * 0.7)));
  // unit normal for lateral spread
  const nx = -dy / len;
  const ny = dx / len;

  for (let i = 0; i <= steps; i++) {
    const f = i / steps; // 0 at base, 1 at tip
    const cx = spine.x0 + dx * f;
    const cy = spine.y0 + dy * f;
    const halfT = spine.t0 + (spine.t1 - spine.t0) * f; // cells
    const reach = Math.max(0, Math.round(halfT));

    for (let s = -reach; s <= reach; s++) {
      // outer cells thin out: skip with rising probability toward the edge/tip
      const edge = reach === 0 ? 0 : Math.abs(s) / reach;
      const skip = edge * 0.55 + f * 0.32;
      if (s !== 0 && rng() < skip) continue;

      const px = cx + nx * s * STEP;
      const py = cy + ny * s * STEP;
      const gx = snap(px);
      const gy = snap(py);
      if (gy < 0 || gy > VB_H || gx < 0 || gx > VB_W) continue;

      // brightness: limb base brightness, dimmed toward tip + band edge,
      // with a touch of jitter so the field shimmers rather than banding.
      const fall = 1 - f * 0.5 - edge * 0.4;
      const jitter = 0.85 + rng() * 0.3;
      const b = Math.max(0.1, Math.min(1, spine.bright * fall * jitter));
      const gen = genBase + Math.round((1 - f) * 1.5);

      const key = `${gx},${gy}`;
      const prev = out.get(key);
      if (!prev || spine.taint || b > prev.b) {
        out.set(key, { gx, gy, b, gen, taint: spine.taint || prev?.taint || false });
      }
    }
  }
}

interface BuiltScene {
  cells: Cell[];
  maxGen: number;
}

/** Build the full deterministic voxel field once. */
function buildScene(): BuiltScene {
  const rng = mulberry32(0x5e47); // fixed seed -> identical SSR/CSR
  const map = new Map<string, Cell>();

  // Safe limbs first (lower gen near base), tainted limbs last (always win).
  SPINES.forEach((sp, i) => stampSpine(sp, rng, map, i === 0 ? 0 : 1 + Math.floor(i / 4)));
  TAINT_SPINES.forEach((sp) => stampSpine(sp, rng, map, 3));

  const cells = Array.from(map.values());
  let maxGen = 0;
  for (const c of cells) if (c.gen > maxGen) maxGen = c.gen;
  return { cells, maxGen };
}

// ---- node-box graph (SVG overlay) -------------------------------------------
interface NodeBox {
  x: number; // top-left
  y: number;
  w: number;
  h: number;
  label: string;
  /** brightness 0..1 */
  b: number;
  taint: boolean;
  /** big-number box (87 / RISK) */
  risk?: boolean;
}

// Squares with a tiny mono label above, placed where right branches reach.
const NODE_BOXES: NodeBox[] = [
  { x: 196, y: 196, w: 22, h: 22, label: "policy v2", b: 0.5, taint: false },
  { x: 236, y: 244, w: 24, h: 24, label: "mem_poison_047", b: 1, taint: true },
  { x: 284, y: 198, w: 22, h: 22, label: "tool_action", b: 1, taint: true },
  { x: 252, y: 150, w: 22, h: 22, label: "MCP BLOCK", b: 0.62, taint: false },
  { x: 300, y: 250, w: 20, h: 20, label: "ctx_chunk", b: 0.4, taint: false },
];

const RISK_BOX: NodeBox = {
  x: 308,
  y: 96,
  w: 40,
  h: 40,
  label: "RISK",
  b: 1,
  taint: true,
  risk: true,
};

interface Edge {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  taint: boolean;
  /** reveal order */
  gen: number;
}

const center = (n: NodeBox) => ({ cx: n.x + n.w / 2, cy: n.y + n.h / 2 });

// Faint edges (context graph) + the tainted backbone poison -> action -> RISK.
const [POLICY, POISON, ACTION, MCP, CHUNK] = NODE_BOXES;
const EDGES: Edge[] = [
  // faint context links
  { ...lineBetween(POLICY, POISON), taint: false, gen: 0 },
  { ...lineBetween(POLICY, MCP), taint: false, gen: 0 },
  { ...lineBetween(POISON, CHUNK), taint: false, gen: 1 },
  { ...lineBetween(MCP, RISK_BOX), taint: false, gen: 2 },
  // tainted backbone
  { ...lineBetween(POISON, ACTION), taint: true, gen: 1 },
  { ...lineBetween(ACTION, RISK_BOX), taint: true, gen: 2 },
];

function lineBetween(a: NodeBox, b: NodeBox): { x1: number; y1: number; x2: number; y2: number } {
  const ca = center(a);
  const cb = center(b);
  return { x1: ca.cx, y1: ca.cy, x2: cb.cx, y2: cb.cy };
}

// Continuous tainted path (tree right-fork -> poison -> action -> RISK) for the
// traveling-dash highlight. Built from the taint spine tip + node centers.
const POISON_C = center(POISON);
const ACTION_C = center(ACTION);
const RISK_C = center(RISK_BOX);
const TAINT_TRAVEL_D = `M176 314 L238 256 L${POISON_C.cx} ${POISON_C.cy} L${ACTION_C.cx} ${ACTION_C.cy} L${RISK_C.cx} ${RISK_C.cy}`;

// ---- tone helper -------------------------------------------------------------
// Map brightness -> fill tone: bright cells white, dim cells fade toward muted
// gray. Opacity carries most of the falloff; tone adds the cool dim look.
function toneFor(b: number): string {
  if (b >= 0.72) return WHITE;
  if (b >= 0.45) return SILVER;
  return MUTED;
}

// Per-generation reveal delay (s) for the staggered "growth from the base".
const GROW_STEP = 0.13;
const GROW_DUR = 0.4;
const NODE_DELAY = 1.45; // node-boxes pop after the canopy settles
const EDGE_DELAY = 1.85; // dashed edges draw next
const TAINT_DELAY = 2.25; // tainted path lights white-hot + loop begins
const RISK_DELAY = 2.75;

export function MemoryTree({ className, animate = true, showRisk = true }: MemoryTreeProps) {
  const prefersReduced = useReducedMotion();
  const isAnimated = animate && !prefersReduced;

  // Deterministic, built once. Same output on server and client.
  const { cells, maxGen } = useMemo(() => buildScene(), []);

  // Stable filter ids (component may mount more than once on a page).
  const ids = useMemo(
    () => ({ spot: "mt-spot", base: "mt-base", taintGlow: "mt-taint-glow" }),
    [],
  );

  return (
    <div className={cn("relative w-full select-none", className)} aria-hidden="true">
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="block h-auto w-full"
        fill="none"
        preserveAspectRatio="xMidYMid meet"
        role="presentation"
        shapeRendering="crispEdges"
      >
        <defs>
          <radialGradient id={ids.spot} cx="58%" cy="40%" r="60%">
            <stop offset="0%" stopColor={WHITE} stopOpacity="0.14" />
            <stop offset="44%" stopColor={WHITE} stopOpacity="0.045" />
            <stop offset="100%" stopColor={WHITE} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={ids.base} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={WHITE} stopOpacity="0.5" />
            <stop offset="55%" stopColor={WHITE} stopOpacity="0.1" />
            <stop offset="100%" stopColor={WHITE} stopOpacity="0" />
          </radialGradient>
          <filter id={ids.taintGlow} x="-160%" y="-160%" width="420%" height="420%">
            <feGaussianBlur stdDeviation="2.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* soft spotlight wash behind the canopy */}
        <rect x="0" y="0" width={VB_W} height={VB_H} fill={`url(#${ids.spot})`} />

        {/* glowing base puck the trunk rises from */}
        <ellipse cx="172" cy="438" rx="60" ry="18" fill={`url(#${ids.base})`} />

        {/* ---- voxel tree: many small <rect> cells, staggered growth ---- */}
        <g shapeRendering="crispEdges">
          {cells.map((c, i) => {
            const baseOpacity = c.taint
              ? Math.min(1, 0.7 + c.b * 0.3)
              : Math.max(0.16, c.b * 0.92);
            const delay = ((maxGen - c.gen) / (maxGen || 1)) * (maxGen * GROW_STEP);
            return (
              <m.rect
                key={`c-${i}`}
                x={c.gx}
                y={c.gy}
                width={DRAW}
                height={DRAW}
                fill={c.taint ? WHITE : toneFor(c.b)}
                style={{ transformBox: "fill-box", transformOrigin: "center" }}
                initial={isAnimated ? { opacity: 0, scale: 0.4 } : false}
                animate={
                  isAnimated
                    ? { opacity: baseOpacity, scale: 1 }
                    : { opacity: baseOpacity, scale: 1 }
                }
                transition={
                  isAnimated
                    ? { duration: GROW_DUR, ease: EASE_OUT_EXPO, delay }
                    : undefined
                }
              />
            );
          })}
        </g>

        {/* ---- graph edges (faint dashed) then tainted backbone ---- */}
        <g>
          {EDGES.map((e, i) => (
            <m.line
              key={`e-${i}`}
              x1={e.x1}
              y1={e.y1}
              x2={e.x2}
              y2={e.y2}
              stroke={e.taint ? WHITE : SILVER}
              strokeOpacity={e.taint ? 0.95 : 0.32}
              strokeWidth={e.taint ? 1.5 : 0.9}
              strokeDasharray="3 3"
              initial={isAnimated ? { pathLength: 0, opacity: 0 } : false}
              animate={isAnimated ? { pathLength: 1, opacity: 1 } : { opacity: 1 }}
              transition={
                isAnimated
                  ? {
                      pathLength: { duration: 0.6, ease: EASE_OUT_EXPO, delay: EDGE_DELAY + e.gen * 0.18 },
                      opacity: { duration: 0.3, delay: EDGE_DELAY + e.gen * 0.18 },
                    }
                  : undefined
              }
            />
          ))}

          {/* traveling dash along the whole tainted path (single perpetual loop) */}
          {isAnimated && (
            <m.path
              d={TAINT_TRAVEL_D}
              stroke={WHITE}
              strokeOpacity={0.95}
              strokeWidth={1.6}
              strokeLinecap="round"
              fill="none"
              strokeDasharray="8 120"
              style={{ filter: `url(#${ids.taintGlow})` }}
              initial={{ strokeDashoffset: 128, opacity: 0 }}
              animate={{ strokeDashoffset: [128, -128], opacity: [0, 1, 1, 0] }}
              transition={{
                strokeDashoffset: { duration: 2.6, ease: "linear", repeat: Infinity, delay: TAINT_DELAY },
                opacity: { duration: 2.6, ease: "linear", repeat: Infinity, delay: TAINT_DELAY },
              }}
            />
          )}
        </g>

        {/* ---- node-boxes: outlined squares with mono labels ---- */}
        <g className="mono">
          {NODE_BOXES.map((n, i) => (
            <NodeBoxView
              key={`nb-${i}`}
              node={n}
              isAnimated={isAnimated}
              delay={NODE_DELAY + i * 0.12}
              taintGlowId={ids.taintGlow}
            />
          ))}
        </g>

        {/* ---- bright 87 / RISK box, top-right ---- */}
        {showRisk && (
          <m.g
            className="mono"
            initial={isAnimated ? { opacity: 0, y: 6 } : { opacity: 1 }}
            animate={isAnimated ? { opacity: 1, y: 0 } : { opacity: 1 }}
            transition={isAnimated ? { duration: 0.6, ease: EASE_OUT_EXPO, delay: RISK_DELAY } : undefined}
            style={{ filter: `url(#${ids.taintGlow})` }}
          >
            <rect
              x={RISK_BOX.x}
              y={RISK_BOX.y}
              width={RISK_BOX.w}
              height={RISK_BOX.h}
              fill={BLACK}
              fillOpacity="0.55"
              stroke={WHITE}
              strokeWidth="1.4"
            />
            <text
              x={RISK_BOX.x + RISK_BOX.w / 2}
              y={RISK_BOX.y + 20}
              textAnchor="middle"
              fontSize="16"
              fontWeight="700"
              fill={WHITE}
              letterSpacing="0.5"
            >
              87
            </text>
            <text
              x={RISK_BOX.x + RISK_BOX.w / 2}
              y={RISK_BOX.y + 31}
              textAnchor="middle"
              fontSize="6"
              fill={SILVER}
              fillOpacity="0.85"
              letterSpacing="1.6"
            >
              RISK
            </text>
          </m.g>
        )}
      </svg>
    </div>
  );
}

// ---- node-box subcomponent ---------------------------------------------------
interface NodeBoxViewProps {
  node: NodeBox;
  isAnimated: boolean;
  delay: number;
  taintGlowId: string;
}

function NodeBoxView({ node, isAnimated, delay, taintGlowId }: NodeBoxViewProps) {
  const stroke = node.taint ? WHITE : SILVER;
  const strokeOpacity = node.taint ? 1 : 0.45 + node.b * 0.3;
  const cx = node.x + node.w / 2;
  return (
    <m.g
      initial={isAnimated ? { opacity: 0, scale: 0.6 } : false}
      animate={isAnimated ? { opacity: 1, scale: 1 } : { opacity: 1 }}
      transition={isAnimated ? { duration: 0.45, ease: EASE_OUT_EXPO, delay } : undefined}
      style={{
        transformBox: "fill-box",
        transformOrigin: "center",
        filter: node.taint ? `url(#${taintGlowId})` : undefined,
      }}
    >
      {/* the outlined square */}
      <rect
        x={node.x}
        y={node.y}
        width={node.w}
        height={node.h}
        fill={BLACK}
        fillOpacity="0.5"
        stroke={stroke}
        strokeOpacity={strokeOpacity}
        strokeWidth={node.taint ? 1.3 : 0.9}
      />
      {/* tiny inner value tick */}
      <rect
        x={node.x + node.w / 2 - 2}
        y={node.y + node.h / 2 - 2}
        width={4}
        height={4}
        fill={node.taint ? WHITE : SILVER}
        fillOpacity={node.taint ? 1 : 0.6}
      />
      {/* mono label above the box */}
      <text
        x={cx}
        y={node.y - 3}
        textAnchor="middle"
        fontSize="6"
        fill={node.taint ? WHITE : SILVER}
        fillOpacity={node.taint ? 0.95 : 0.6}
        letterSpacing="0.4"
      >
        {node.label}
      </text>
    </m.g>
  );
}
