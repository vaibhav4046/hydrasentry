import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { COLORS, FONTS } from "./lib/theme";

/**
 * Remotion-native monochrome "artifact tree" — the same visual language as the
 * frontend ArtifactTreeGraph, rebuilt with raw SVG + interpolate (no framer, no
 * Next imports). Deterministic geometry on a 1920x1080 stage: a luminous white
 * trunk rises into a canopy of thin branch strokes scattered with glowing
 * node-dots, ringed by labelled context-node badges, with a dramatic white-hot
 * TAINTED PATH (memory -> conflict -> risk -> firewall). All "danger" is white
 * intensity + glow + a traveling dash, never hue.
 *
 * Driven by a single `progress` 0..1 (the parent maps scene frames onto it) plus
 * a `taint` 0..1 that lights the poison chain, and `block` 0..1 for the firewall.
 */

export const TREE_W = 1200;
export const TREE_H = 920;

const CANOPY = { x: 600, y: 320 };
const BASE = { x: 600, y: 880 };

// ---- branch skeleton (cubic beziers, trunk -> canopy) -----------------------
interface Branch {
  d: string;
  width: number;
  bright: number;
  order: number;
}

// Scaled-up analogue of the frontend BRANCHES, centered on a 1200x920 stage.
const BRANCHES: Branch[] = [
  { d: "M600 880 C 597 760, 603 590, 600 450", width: 4.2, bright: 1, order: 0 },
  { d: "M600 520 C 560 450, 500 410, 446 372", width: 3, bright: 0.85, order: 1 },
  { d: "M600 520 C 642 448, 706 410, 760 372", width: 3, bright: 0.85, order: 1 },
  { d: "M600 480 C 580 400, 540 350, 512 290", width: 2.6, bright: 0.78, order: 1 },
  { d: "M600 480 C 622 400, 664 352, 692 292", width: 2.6, bright: 0.78, order: 1 },
  { d: "M446 372 C 396 340, 356 308, 326 262", width: 1.9, bright: 0.6, order: 2 },
  { d: "M446 372 C 430 318, 416 280, 408 236", width: 1.7, bright: 0.56, order: 2 },
  { d: "M512 290 C 488 246, 470 212, 466 176", width: 1.6, bright: 0.54, order: 2 },
  { d: "M760 372 C 810 340, 852 312, 882 268", width: 1.9, bright: 0.6, order: 2 },
  { d: "M760 372 C 776 320, 792 282, 800 238", width: 1.7, bright: 0.56, order: 2 },
  { d: "M692 292 C 716 248, 736 214, 742 178", width: 1.6, bright: 0.54, order: 2 },
  { d: "M326 262 C 300 232, 284 212, 274 184", width: 1.1, bright: 0.4, order: 3 },
  { d: "M408 236 C 396 206, 388 186, 386 160", width: 1.1, bright: 0.4, order: 3 },
  { d: "M882 268 C 908 238, 924 218, 934 190", width: 1.1, bright: 0.4, order: 3 },
  { d: "M800 238 C 812 208, 820 188, 822 162", width: 1.1, bright: 0.4, order: 3 },
  { d: "M600 450 C 596 400, 600 372, 600 340", width: 1.5, bright: 0.7, order: 2 },
];

// A clean retrieval path that glows through the safe (right) branches.
const QUERY_PATH_D =
  "M600 880 C 597 720, 603 590, 600 520 C 642 448, 706 410, 760 372 C 810 340, 852 312, 882 268";

// ---- deterministic node-dots (seeded; identical every render) ---------------
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

interface Dot {
  x: number;
  y: number;
  r: number;
  bright: number;
  phase: number;
}

function buildDots(): Dot[] {
  const rng = mulberry32(0x4ad7);
  const out: Dot[] = [];
  for (const b of BRANCHES) {
    const pts = parsePts(b.d);
    if (!pts) continue;
    const density = b.order === 0 ? 16 : b.order === 1 ? 10 : b.order === 2 ? 6 : 3;
    for (let i = 0; i < density; i++) {
      const t = (i + 0.5) / density;
      const p = cubicAt(pts, t);
      const jx = (rng() - 0.5) * (10 - b.order * 1.6);
      const jy = (rng() - 0.5) * (10 - b.order * 1.6);
      if (b.order >= 2 && rng() < 0.25) continue;
      out.push({
        x: p.x + jx,
        y: p.y + jy,
        r: 1.2 + rng() * (b.order === 0 ? 2 : 1.2),
        bright: Math.max(0.2, b.bright * (0.7 + rng() * 0.45)),
        phase: rng(),
      });
    }
  }
  return out;
}

interface Pt {
  x: number;
  y: number;
}
function parsePts(d: string): [Pt, Pt, Pt, Pt] | null {
  const n = d.match(/-?\d+(?:\.\d+)?/g)?.map(Number);
  if (!n || n.length < 8) return null;
  return [
    { x: n[0], y: n[1] },
    { x: n[2], y: n[3] },
    { x: n[4], y: n[5] },
    { x: n[6], y: n[7] },
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

const DOTS = buildDots();

// ---- labelled context-node badges -------------------------------------------
type Col = "top" | "left" | "right";
interface Badge {
  id: string;
  title: string;
  sub: string;
  x: number;
  y: number;
  col: Col;
  tainted: boolean;
  /** 0..1 progress threshold at which the badge surfaces. */
  appear: number;
}

const LX = 150;
const RX = 1050;

const BADGES: Badge[] = [
  { id: "user_task", title: "USER TASK", sub: "Process VIP refund", x: 600, y: 80, col: "top", tainted: false, appear: 0.16 },
  { id: "memory", title: "MEMORY NODE", sub: "VIP = instant refund", x: LX, y: 250, col: "left", tainted: true, appear: 0.16 },
  { id: "policy", title: "POLICY NODE", sub: "Refunds >£500 need approval", x: LX, y: 400, col: "left", tainted: false, appear: 0.16 },
  { id: "document", title: "DOCUMENT NODE", sub: "Refund policy v2.1", x: LX, y: 550, col: "left", tainted: false, appear: 0.16 },
  { id: "tool", title: "TOOL NODE", sub: "approve_refund()", x: LX, y: 700, col: "left", tainted: false, appear: 0.4 },
  { id: "retrieval", title: "RETRIEVAL PATH", sub: "3 hops · 0.87", x: RX, y: 250, col: "right", tainted: false, appear: 0.4 },
  { id: "conflict", title: "CONFLICT DETECTED", sub: "Memory vs policy", x: RX, y: 400, col: "right", tainted: true, appear: 0.56 },
  { id: "risk", title: "RISK DETECTED", sub: "Policy bypass", x: RX, y: 550, col: "right", tainted: true, appear: 0.7 },
  { id: "firewall", title: "MCP FIREWALL", sub: "Action blocked", x: RX, y: 700, col: "right", tainted: true, appear: 0.84 },
];

function badgeCenter(id: string): Pt {
  if (id === "canopy") return CANOPY;
  const b = BADGES.find((n) => n.id === id);
  return b ? { x: b.x, y: b.y } : CANOPY;
}

interface Edge {
  from: string;
  to: string;
  tainted: boolean;
  appear: number;
}

const EDGES: Edge[] = [
  { from: "user_task", to: "canopy", tainted: false, appear: 0.16 },
  { from: "memory", to: "canopy", tainted: false, appear: 0.16 },
  { from: "policy", to: "canopy", tainted: false, appear: 0.16 },
  { from: "document", to: "canopy", tainted: false, appear: 0.16 },
  { from: "tool", to: "canopy", tainted: false, appear: 0.4 },
  { from: "retrieval", to: "canopy", tainted: false, appear: 0.4 },
  { from: "memory", to: "conflict", tainted: true, appear: 0.56 },
  { from: "conflict", to: "risk", tainted: true, appear: 0.7 },
  { from: "risk", to: "firewall", tainted: true, appear: 0.84 },
];

interface ArtifactTreeProps {
  /** Overall build progress 0..1. */
  progress: number;
  /** Tainted-chain heat 0..1 (lights the poison path white-hot + traveling dash). */
  taint?: number;
  /** Firewall block flash 0..1. */
  block?: number;
  /** Local frame for loop animations (dot breathing, dash travel). */
  frame?: number;
}

/** The full artifact tree. Pure function of (progress, taint, block, frame). */
export const ArtifactTree: React.FC<ArtifactTreeProps> = ({
  progress,
  taint = 0,
  block = 0,
  frame,
}) => {
  // Always call the hook (rules of hooks); prefer an explicit frame prop.
  const liveFrame = useCurrentFrame();
  const f = frame ?? liveFrame;

  return (
    <svg
      width={TREE_W}
      height={TREE_H}
      viewBox={`0 0 ${TREE_W} ${TREE_H}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ overflow: "visible" }}
    >
      <defs>
        <radialGradient id="atree-spot" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.1" />
          <stop offset="46%" stopColor="#FFFFFF" stopOpacity="0.035" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        <filter id="atree-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="1.8" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="atree-taint" x="-120%" y="-120%" width="340%" height="340%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect x={0} y={0} width={TREE_W} height={TREE_H} fill="url(#atree-spot)" />

      <Rings progress={progress} />
      <Branches progress={progress} frame={f} />
      <Dots progress={progress} frame={f} />
      <QueryPath progress={progress} />
      <Edges progress={progress} taint={taint} frame={f} />
      <Badges progress={progress} taint={taint} block={block} frame={f} />
    </svg>
  );
};

// ---- concentric rings (INIT) ------------------------------------------------
const Rings: React.FC<{ progress: number }> = ({ progress }) => {
  const op = interpolate(progress, [0, 0.08], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <g opacity={op}>
      {[160, 270, 400].map((r) => (
        <circle
          key={r}
          cx={CANOPY.x}
          cy={CANOPY.y}
          r={r}
          fill="none"
          stroke={COLORS.white}
          strokeOpacity={0.05}
          strokeWidth={1}
          strokeDasharray="2 8"
        />
      ))}
    </g>
  );
};

// ---- branch strokes draw in (SEED) ------------------------------------------
const Branches: React.FC<{ progress: number; frame: number }> = ({ progress }) => {
  return (
    <g filter="url(#atree-glow)">
      {BRANCHES.map((b, i) => {
        const start = 0.06 + b.order * 0.05;
        const draw = interpolate(progress, [start, start + 0.16], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const len = approxLen(b.d);
        return (
          <path
            key={i}
            d={b.d}
            stroke={COLORS.white}
            strokeOpacity={(0.18 + b.bright * 0.6) * (draw > 0 ? 1 : 0)}
            strokeWidth={b.width}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={len}
            strokeDashoffset={len * (1 - draw)}
          />
        );
      })}
    </g>
  );
};

// ---- glowing node-dots, breathing -------------------------------------------
const Dots: React.FC<{ progress: number; frame: number }> = ({ progress, frame }) => {
  const op = interpolate(progress, [0.1, 0.24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <g opacity={op}>
      {DOTS.map((d, i) => {
        const breathe = interpolate(
          Math.sin(frame / (40 + d.phase * 30) + d.phase * 6),
          [-1, 1],
          [0.55, 1],
        );
        return (
          <circle
            key={i}
            cx={d.x}
            cy={d.y}
            r={d.r}
            fill={COLORS.white}
            fillOpacity={(0.25 + d.bright * 0.6) * breathe}
          />
        );
      })}
    </g>
  );
};

// ---- clean query path glow (BUILD PATHS) ------------------------------------
const QueryPath: React.FC<{ progress: number }> = ({ progress }) => {
  const draw = interpolate(progress, [0.36, 0.56], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  if (draw <= 0) return null;
  const len = approxLen(QUERY_PATH_D);
  return (
    <path
      d={QUERY_PATH_D}
      stroke={COLORS.white}
      strokeOpacity={0.5}
      strokeWidth={2.6}
      strokeLinecap="round"
      fill="none"
      filter="url(#atree-glow)"
      strokeDasharray={len}
      strokeDashoffset={len * (1 - draw)}
    />
  );
};

// ---- node edges (safe + tainted chain) --------------------------------------
const Edges: React.FC<{ progress: number; taint: number; frame: number }> = ({
  progress,
  taint,
  frame,
}) => {
  return (
    <g>
      {EDGES.map((e, i) => {
        const a = badgeCenter(e.from);
        const b = badgeCenter(e.to);
        const draw = interpolate(progress, [e.appear, e.appear + 0.1], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        if (draw <= 0) return null;
        const hot = e.tainted ? taint : 0;
        const op = e.tainted ? 0.6 + hot * 0.36 : 0.2;
        const w = e.tainted ? 1.8 + hot * 0.8 : 1.2;
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        // traveling packet along hot tainted edges
        const travelT = e.tainted && hot > 0.4 ? (frame % 44) / 44 : null;
        const px = travelT !== null ? a.x + (b.x - a.x) * travelT : 0;
        const py = travelT !== null ? a.y + (b.y - a.y) * travelT : 0;
        return (
          <g key={i}>
            <line
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={COLORS.white}
              strokeOpacity={op}
              strokeWidth={w}
              strokeDasharray={e.tainted ? "6 5" : "3 6"}
              strokeDashoffset={len * (1 - draw)}
              style={hot > 0.3 ? { filter: "url(#atree-taint)" } : undefined}
            />
            {travelT !== null && draw >= 1 ? (
              <circle
                cx={px}
                cy={py}
                r={5}
                fill={COLORS.white}
                style={{ filter: "drop-shadow(0 0 9px rgba(255,255,255,0.95))" }}
              />
            ) : null}
          </g>
        );
      })}
    </g>
  );
};

// ---- glass node badges ------------------------------------------------------
const Badges: React.FC<{
  progress: number;
  taint: number;
  block: number;
  frame: number;
}> = ({ progress, taint, block, frame }) => {
  return (
    <g>
      {BADGES.map((bd) => {
        const op = interpolate(progress, [bd.appear, bd.appear + 0.08], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        if (op <= 0) return null;
        const hot = bd.tainted ? taint : 0;
        const isFirewall = bd.id === "firewall";
        const pulse =
          hot > 0.3
            ? interpolate(Math.sin(frame / 8), [-1, 1], [0.6, 1])
            : 1;
        const ringGlow = isFirewall ? Math.max(hot, block) : hot;
        const r = 26;
        // label sits outside the column
        const labelLeft = bd.col === "right";
        const tx = labelLeft ? bd.x - r - 14 : bd.x + r + 14;
        const anchor = labelLeft ? "end" : "start";
        const topAnchor = bd.col === "top";
        return (
          <g key={bd.id} opacity={op}>
            {/* pulse halo on hot tainted badges */}
            {ringGlow > 0.3 ? (
              <circle
                cx={bd.x}
                cy={bd.y}
                r={r + 8 * pulse}
                fill="none"
                stroke={COLORS.white}
                strokeWidth={1.5}
                opacity={0.5 * pulse * ringGlow}
              />
            ) : null}
            {/* badge disc */}
            <circle
              cx={bd.x}
              cy={bd.y}
              r={r}
              fill="rgba(255,255,255,0.06)"
              stroke={COLORS.white}
              strokeOpacity={hot > 0.3 ? 0.75 : 0.32}
              strokeWidth={hot > 0.3 ? 2 : 1.2}
              style={
                ringGlow > 0.3
                  ? {
                      filter: `drop-shadow(0 0 ${
                        14 * pulse * ringGlow
                      }px rgba(255,255,255,${0.42 * ringGlow}))`,
                    }
                  : undefined
              }
            />
            {/* firewall block glyph */}
            {isFirewall && block > 0.2 ? (
              <g opacity={block} transform={`translate(${bd.x} ${bd.y})`}>
                <line x1={-9} y1={-9} x2={9} y2={9} stroke={COLORS.white} strokeWidth={2.6} />
                <line x1={9} y1={-9} x2={-9} y2={9} stroke={COLORS.white} strokeWidth={2.6} />
              </g>
            ) : (
              <circle cx={bd.x} cy={bd.y} r={4.5} fill={COLORS.white} fillOpacity={hot > 0.3 ? 1 : 0.7} />
            )}
            {/* label */}
            <text
              x={topAnchor ? bd.x : tx}
              y={topAnchor ? bd.y - r - 14 : bd.y - 4}
              fill={COLORS.textPrimary}
              fontFamily={FONTS.mono}
              fontSize={15}
              fontWeight={600}
              letterSpacing="1.4px"
              textAnchor={topAnchor ? "middle" : anchor}
            >
              {bd.title}
            </text>
            <text
              x={topAnchor ? bd.x : tx}
              y={topAnchor ? bd.y - r + 4 : bd.y + 16}
              fill={COLORS.textMuted}
              fontFamily={FONTS.mono}
              fontSize={13}
              textAnchor={topAnchor ? "middle" : anchor}
            >
              {bd.sub}
            </text>
          </g>
        );
      })}
    </g>
  );
};

// Cheap polyline length estimate for stroke-dash draw-in (sampled bezier).
function approxLen(d: string): number {
  const pts = parsePts(d);
  if (!pts) return 600;
  let len = 0;
  let prev = cubicAt(pts, 0);
  for (let i = 1; i <= 16; i++) {
    const p = cubicAt(pts, i / 16);
    len += Math.hypot(p.x - prev.x, p.y - prev.y);
    prev = p;
  }
  return Math.ceil(len);
}
