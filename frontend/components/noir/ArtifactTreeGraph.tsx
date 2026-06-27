"use client";

import { useEffect, useRef, useState } from "react";
import { m } from "framer-motion";
import { cn } from "@/lib/cn";
import { EASE_OUT_EXPO } from "@/lib/motion";
import { useReducedMotionSafe } from "@/hooks/useReducedMotionSafe";

/**
 * ArtifactTreeGraph, the signature animated memory graph behind the homepage
 * hero. A crisp, retina SVG (viewBox-scaled, vector-everything, no canvas) that
 * draws the memory_poisoning_refund scenario as a small directed graph: the user
 * task at the crown, the clean policy spine on the left, the poisoned memory
 * branch on the right, the query_path that carried the poison, the MCP firewall
 * that severs it, and the Memory Integrity Certificate at the foot.
 *
 * STAGE MODEL. The component is driven by a single `stage` prop on a 0..100
 * scale so the demo controller (next build stage) can scrub it linearly:
 *
 *   0   INIT         depth grid + concentric rings only (calm scaffold)
 *   15  SEED         the trunk/spine draws up from the task
 *   30  RETRIEVE     context nodes (memory/policy/document/skill/tool/chunk) reveal
 *   45  PATHS        the clean retrieval path glows (query_path established)
 *   60  POISON       the poisoned memory node surfaces (intensity, not hue)
 *   75  RISK         the tainted path intensifies (conflict -> path -> action)
 *   90  BLOCK        the MCP firewall blocks the unsafe action
 *   100 CERTIFICATE  the Memory Integrity Certificate node appears
 *
 * Each node/edge carries its own `at` threshold; it is "live" once
 * `stage >= at`. Live edges draw (pathLength) + glow; the tainted active path
 * gets an animated dashed overlay. Dim hairlines otherwise. Danger is always
 * intensity (brightness/weight/glow), never colour, monochrome end to end.
 *
 * DEFAULT (no `stage`): a calm LIVING IDLE graph, the full composition is shown
 * at rest (NOT blank) with gentle node breathing and a slow dashed crawl on the
 * tainted path. It is never empty and never depends on a run.
 *
 * REDUCED MOTION: renders the fully-composed end-ish state statically and fully
 * visible, every node and edge at final opacity, no entrance, no dashed crawl,
 * no breathing. No critical content is ever hidden behind opacity:0 and no text
 * is gradient-clipped (labels are solid-fill SVG text).
 *
 * The component is purely decorative (aria-hidden); the hero copy carries the
 * accessible content. Self-contained: it owns its own node/edge data and shares
 * nothing with the older WebGL hero data module.
 */

const VB_W = 920;
const VB_H = 660;

/** Stage thresholds, the public contract the demo controller scrubs over. */
export const ATG_STAGES = {
  INIT: 0,
  SEED: 15,
  RETRIEVE: 30,
  PATHS: 45,
  POISON: 60,
  RISK: 75,
  BLOCK: 90,
  CERTIFICATE: 100,
} as const;

export const ATG_MAX_STAGE = 100;

type NodeKind =
  | "task"
  | "memory"
  | "policy"
  | "document"
  | "skill"
  | "tool"
  | "conflict"
  | "path"
  | "chunk"
  | "firewall"
  | "certificate";

interface TreeNode {
  id: string;
  kind: NodeKind;
  /** Eyebrow shown above the title (the node type). */
  eyebrow: string;
  /** Primary label (the exact content from the brief). */
  title: string;
  /** Node center in viewBox space. */
  x: number;
  y: number;
  /** Stage at/after which the node is live. */
  at: number;
  /** On the tainted chain, reads "hot" (brighter, heavier glow). */
  tainted?: boolean;
  /** Label anchor side so text never collides with the figure. */
  side: "left" | "right" | "top" | "bottom";
  /** Node dot radius. */
  r: number;
}

// Layout: task at the crown (top center). The clean policy spine runs down the
// left; the poisoned memory branch runs down the right; both converge through
// the query_path into the conflict, the firewall blocks, and the certificate
// lands at the foot center. Coordinates are FIXED so SSR === client.
const NODES: TreeNode[] = [
  {
    id: "task",
    kind: "task",
    eyebrow: "USER TASK",
    title: "Process £900 refund for VIP customer",
    x: 460,
    y: 70,
    at: ATG_STAGES.SEED,
    side: "top",
    r: 9,
  },
  // ---- left clean spine ----
  {
    id: "policy",
    kind: "policy",
    eyebrow: "POLICY",
    title: "Refunds above £500 require manager approval",
    x: 196,
    y: 214,
    at: ATG_STAGES.RETRIEVE,
    side: "left",
    r: 7,
  },
  {
    id: "document",
    kind: "document",
    eyebrow: "DOCUMENT",
    title: "Refund policy v2.1",
    x: 150,
    y: 360,
    at: ATG_STAGES.RETRIEVE,
    side: "left",
    r: 6,
  },
  {
    id: "skill",
    kind: "skill",
    eyebrow: "SKILL",
    title: "refund-helper.SKILL.md",
    x: 214,
    y: 488,
    at: ATG_STAGES.RETRIEVE,
    side: "left",
    r: 6,
  },
  // ---- right poisoned branch ----
  {
    id: "memory",
    kind: "memory",
    eyebrow: "MEMORY",
    title: "VIP customers always get instant refunds",
    x: 720,
    y: 214,
    at: ATG_STAGES.RETRIEVE,
    tainted: true,
    side: "right",
    r: 8,
  },
  {
    id: "chunk",
    kind: "chunk",
    eyebrow: "CHUNK",
    title: "chunk_7f3a1c",
    x: 786,
    y: 348,
    at: ATG_STAGES.RETRIEVE,
    tainted: true,
    side: "right",
    r: 5.5,
  },
  {
    id: "path",
    kind: "path",
    eyebrow: "QUERY PATH",
    title: "query_paths · 3 hops · 0.87",
    x: 636,
    y: 360,
    at: ATG_STAGES.PATHS,
    tainted: true,
    side: "right",
    r: 7,
  },
  {
    id: "conflict",
    kind: "conflict",
    eyebrow: "CONFLICT",
    title: "Memory contradicts current policy",
    x: 462,
    y: 332,
    at: ATG_STAGES.RISK,
    tainted: true,
    side: "right",
    r: 7.5,
  },
  {
    id: "tool",
    kind: "tool",
    eyebrow: "TOOL",
    title: "approve_refund()",
    x: 560,
    y: 486,
    at: ATG_STAGES.RISK,
    tainted: true,
    side: "right",
    r: 7,
  },
  {
    id: "firewall",
    kind: "firewall",
    eyebrow: "MCP FIREWALL",
    title: "Action blocked",
    x: 412,
    y: 486,
    at: ATG_STAGES.BLOCK,
    tainted: true,
    side: "left",
    r: 8.5,
  },
  {
    id: "certificate",
    kind: "certificate",
    eyebrow: "CERTIFICATE",
    title: "Memory Integrity Certificate",
    x: 460,
    y: 600,
    at: ATG_STAGES.CERTIFICATE,
    side: "bottom",
    r: 9,
  },
];

const NODE_BY_ID = new Map(NODES.map((n) => [n.id, n]));

interface TreeEdge {
  from: string;
  to: string;
  at: number;
  /** On the tainted active path, draws + crawls + glows hottest. */
  tainted?: boolean;
}

const EDGES: TreeEdge[] = [
  // task seeds both spines
  { from: "task", to: "policy", at: ATG_STAGES.SEED },
  { from: "task", to: "memory", at: ATG_STAGES.SEED, tainted: true },
  // clean policy provenance
  { from: "policy", to: "document", at: ATG_STAGES.RETRIEVE },
  { from: "policy", to: "skill", at: ATG_STAGES.RETRIEVE },
  // poisoned branch provenance + retrieval
  { from: "memory", to: "chunk", at: ATG_STAGES.RETRIEVE, tainted: true },
  { from: "memory", to: "path", at: ATG_STAGES.PATHS, tainted: true },
  // the tainted active path: path -> conflict -> tool -> firewall
  { from: "path", to: "conflict", at: ATG_STAGES.RISK, tainted: true },
  { from: "policy", to: "conflict", at: ATG_STAGES.RISK },
  { from: "conflict", to: "tool", at: ATG_STAGES.RISK, tainted: true },
  { from: "tool", to: "firewall", at: ATG_STAGES.BLOCK, tainted: true },
  // firewall logs the certificate
  { from: "firewall", to: "certificate", at: ATG_STAGES.CERTIFICATE },
];

/** A gentle quadratic curve between two node centers (slight vertical bow). */
function edgePath(from: TreeNode, to: TreeNode): string {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  // bow the control point a touch perpendicular to the segment for an organic arc
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const bow = Math.min(34, len * 0.12);
  const cx = mx + nx * bow;
  const cy = my + ny * bow;
  return `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`;
}

interface ArtifactTreeGraphProps {
  /**
   * Drive a specific stage on the 0..100 scale (15/30/45/60/75/90/100 are the
   * meaningful breakpoints). When omitted, the graph shows a calm living idle
   * composition (full graph at rest, NOT blank).
   */
  stage?: number;
  className?: string;
}

export function ArtifactTreeGraph({ stage, className }: ArtifactTreeGraphProps) {
  // Hydration-safe read: the server (and the client's first render) see `false`,
  // so the SSR markup and the initial client markup agree. Using framer-motion's
  // raw useReducedMotion() here seeded `idleStage` differently on server vs client
  // under Reduced Motion (stage 0 vs composed end-state), which renders different
  // node labels and triggers React hydration error #418. The store settles to the
  // live preference on the next commit; reduced-motion users still skip the sweep
  // and land on the composed graph, just one commit later, never blank.
  const prefersReduced = useReducedMotionSafe();
  const controlled = stage != null;

  // Idle autoplay: when no `stage` is supplied AND motion is allowed, sweep the
  // graph 0 -> 100 once, then hold the composed end-state and breathe. This gives
  // a "living" hero on first paint without ever blanking. Reduced motion skips
  // straight to the composed state.
  const [idleStage, setIdleStage] = useState<number>(
    prefersReduced || controlled ? ATG_MAX_STAGE : 0,
  );
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (controlled || prefersReduced) return;
    let start: number | null = null;
    const DURATION = 5200; // ms for the full 0 -> 100 idle build
    const step = (ts: number) => {
      if (start == null) start = ts;
      const t = Math.min(1, (ts - start) / DURATION);
      setIdleStage(Math.round(t * ATG_MAX_STAGE));
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [controlled, prefersReduced]);

  // Resolve the active stage: controlled -> prop; reduced -> end; else idle sweep.
  const activeStage = controlled
    ? clampStage(stage as number)
    : prefersReduced
      ? ATG_MAX_STAGE
      : idleStage;

  // Once the composed graph is reached (idle finished, controlled at 100, or
  // reduced motion), let the tainted path crawl + nodes breathe.
  const composed = activeStage >= ATG_MAX_STAGE;
  const isAnimated = !prefersReduced;

  return (
    <div
      aria-hidden="true"
      className={cn("relative w-full select-none", className)}
    >
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        width="100%"
        height="100%"
        role="presentation"
        // shapeRendering geometricPrecision keeps strokes crisp at any DPR.
        style={{ display: "block", shapeRendering: "geometricPrecision" }}
      >
        <defs>
          {/* soft white glow for active edges + node halos */}
          <filter id="atg-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="3.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="atg-glow-hard" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="5.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* radial node fill, bright core fading to glass */}
          <radialGradient id="atg-node" cx="50%" cy="42%" r="62%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.98)" />
            <stop offset="50%" stopColor="rgba(217,222,231,0.34)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.04)" />
          </radialGradient>
          <radialGradient id="atg-node-dim" cx="50%" cy="42%" r="62%">
            <stop offset="0%" stopColor="rgba(217,222,231,0.55)" />
            <stop offset="60%" stopColor="rgba(217,222,231,0.12)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.02)" />
          </radialGradient>
          {/* atmospheric depth-fog: a soft brighten at the graph's heart that
              collapses to void at the edges, so the figure sits in a lit chamber
              rather than on a flat black plate. */}
          <radialGradient id="atg-fog" cx="50%" cy="46%" r="62%">
            <stop offset="0%" stopColor="rgba(150,166,190,0.10)" />
            <stop offset="42%" stopColor="rgba(90,102,124,0.05)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
          {/* edge-vignette so the plate reads as an instrument, deepening corners */}
          <radialGradient id="atg-vignette" cx="50%" cy="50%" r="72%">
            <stop offset="58%" stopColor="rgba(0,0,0,0)" />
            <stop offset="100%" stopColor="rgba(2,3,5,0.55)" />
          </radialGradient>
        </defs>

        {/* atmosphere behind everything: depth-fog then a corner vignette */}
        <rect x={0} y={0} width={VB_W} height={VB_H} fill="url(#atg-fog)" />
        <rect
          x={0}
          y={0}
          width={VB_W}
          height={VB_H}
          fill="url(#atg-vignette)"
          pointerEvents="none"
        />

        {/* ---- INIT scaffold: depth grid + concentric rings (always visible) ---- */}
        <DepthScaffold animated={isAnimated} />

        {/* ---- edges ---- */}
        <g fill="none" strokeLinecap="round">
          {EDGES.map((e) => {
            const from = NODE_BY_ID.get(e.from)!;
            const to = NODE_BY_ID.get(e.to)!;
            const live = activeStage >= e.at;
            return (
              <EdgeView
                key={`${e.from}-${e.to}`}
                d={edgePath(from, to)}
                live={live}
                tainted={Boolean(e.tainted)}
                composed={composed}
                isAnimated={isAnimated}
              />
            );
          })}
        </g>

        {/* ---- nodes (dots + glow) ---- */}
        <g>
          {NODES.map((n) => {
            const live = activeStage >= n.at;
            // poisoned memory only reads "hot" once POISON surfaces it
            const hot =
              Boolean(n.tainted) &&
              (activeStage >= ATG_STAGES.POISON || n.kind === "firewall");
            return (
              <NodeDot
                key={n.id}
                node={n}
                live={live}
                hot={hot}
                isAnimated={isAnimated}
                composed={composed}
              />
            );
          })}
        </g>

        {/* ---- labels (solid-fill SVG text, never gradient-clipped) ---- */}
        <g>
          {NODES.map((n) => {
            const live = activeStage >= n.at;
            const hot =
              Boolean(n.tainted) &&
              (activeStage >= ATG_STAGES.POISON || n.kind === "firewall");
            return (
              <NodeLabel
                key={`label-${n.id}`}
                node={n}
                live={live}
                hot={hot}
                isAnimated={isAnimated}
              />
            );
          })}
        </g>
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------

function clampStage(s: number): number {
  if (!Number.isFinite(s)) return 0;
  return Math.max(0, Math.min(ATG_MAX_STAGE, Math.round(s)));
}

/** The INIT scaffold: a faint dot grid + concentric depth rings around the core. */
function DepthScaffold({ animated }: { animated: boolean }) {
  const cx = 460;
  const cy = 330;
  const rings = [120, 200, 280];
  // a sparse dot grid for "depth"
  const dots: { x: number; y: number }[] = [];
  for (let gx = 60; gx < VB_W; gx += 76) {
    for (let gy = 60; gy < VB_H; gy += 76) {
      dots.push({ x: gx, y: gy });
    }
  }
  return (
    <g>
      {/* sparse depth dot-grid, brighter near the core (falls off radially) */}
      <g fill="rgba(214,222,236,0.06)">
        {dots.map((d, i) => {
          const dist = Math.hypot(d.x - cx, d.y - cy);
          const near = Math.max(0, 1 - dist / 360);
          return (
            <circle
              key={i}
              cx={d.x}
              cy={d.y}
              r={0.8 + near * 0.5}
              opacity={0.35 + near * 0.55}
            />
          );
        })}
      </g>
      {/* concentric depth rings, hairline, gently breathing */}
      <g fill="none" stroke="rgba(214,222,236,0.085)" strokeWidth={1}>
        {rings.map((r, i) =>
          animated ? (
            <m.circle
              key={r}
              cx={cx}
              cy={cy}
              r={r}
              initial={false}
              animate={{ opacity: [0.28, 0.5, 0.28] }}
              transition={{
                duration: 6 + i * 1.4,
                ease: "easeInOut",
                repeat: Infinity,
              }}
            />
          ) : (
            <circle key={r} cx={cx} cy={cy} r={r} opacity={0.4} />
          ),
        )}
        {/* a single bright azimuth tick ring with quarter ticks (instrument) */}
        <circle cx={cx} cy={cy} r={rings[1]} stroke="rgba(214,222,236,0.05)" />
      </g>
      {/* faint cross-hair at the core, the chart's anchor */}
      <g stroke="rgba(214,222,236,0.12)" strokeWidth={1}>
        <line x1={cx - 16} y1={cy} x2={cx + 16} y2={cy} />
        <line x1={cx} y1={cy - 16} x2={cx} y2={cy + 16} />
      </g>
      {/* core glow at the heart of the rings */}
      <circle
        cx={cx}
        cy={cy}
        r={6}
        fill="rgba(255,255,255,0.55)"
        filter="url(#atg-glow)"
      />
    </g>
  );
}

/** One edge: a dim hairline always, drawing + glowing when live; tainted-active
 *  edges get an animated dashed crawl once composed. */
function EdgeView({
  d,
  live,
  tainted,
  composed,
  isAnimated,
}: {
  d: string;
  live: boolean;
  tainted: boolean;
  composed: boolean;
  isAnimated: boolean;
}) {
  const stroke = live
    ? tainted
      ? "rgba(255,255,255,0.98)"
      : "rgba(217,222,231,0.68)"
    : "rgba(214,222,236,0.16)";
  const width = live ? (tainted ? 2.2 : 1.5) : 1;

  return (
    <g>
      {/* the base edge (dim hairline -> bright when live) */}
      {isAnimated ? (
        <m.path
          d={d}
          stroke={stroke}
          strokeWidth={width}
          initial={false}
          animate={{
            pathLength: live ? 1 : 0.001,
            opacity: live ? 1 : 0.5,
          }}
          transition={{ duration: 0.7, ease: EASE_OUT_EXPO }}
          filter={live && tainted ? "url(#atg-glow)" : undefined}
        />
      ) : (
        <path
          d={d}
          stroke={stroke}
          strokeWidth={width}
          opacity={live ? 1 : 0.5}
          filter={live && tainted ? "url(#atg-glow)" : undefined}
        />
      )}

      {/* animated dashed crawl on the tainted ACTIVE path once composed */}
      {tainted && live && composed && isAnimated && (
        <path
          d={d}
          stroke="rgba(255,255,255,0.95)"
          strokeWidth={2.2}
          strokeDasharray="7 13"
          filter="url(#atg-glow)"
          className="atg-travel"
        />
      )}
    </g>
  );
}

/** A node dot: glass/radial fill, white-hot ring + breathing halo when hot. */
function NodeDot({
  node,
  live,
  hot,
  isAnimated,
  composed,
}: {
  node: TreeNode;
  live: boolean;
  hot: boolean;
  isAnimated: boolean;
  composed: boolean;
}) {
  const fill = hot
    ? "url(#atg-node)"
    : live
      ? "url(#atg-node)"
      : "url(#atg-node-dim)";
  const ring = hot
    ? "rgba(255,255,255,0.96)"
    : live
      ? "rgba(217,222,231,0.55)"
      : "rgba(255,255,255,0.16)";

  const dot = (
    <>
      {/* breathing halo: hot nodes pulse hardest, live nodes breathe gently */}
      {isAnimated && live && composed && (
        <m.circle
          cx={node.x}
          cy={node.y}
          r={node.r + 5}
          fill="none"
          stroke="rgba(255,255,255,0.4)"
          strokeWidth={1}
          animate={{
            opacity: hot ? [0.3, 0.75, 0.3] : [0.12, 0.32, 0.12],
            scale: hot ? [1, 1.25, 1] : [1, 1.12, 1],
          }}
          style={{ transformOrigin: `${node.x}px ${node.y}px` }}
          transition={{
            duration: hot ? 2.4 : 3.6,
            ease: "easeInOut",
            repeat: Infinity,
          }}
        />
      )}
      <circle
        cx={node.x}
        cy={node.y}
        r={node.r}
        fill={fill}
        stroke={ring}
        strokeWidth={hot ? 1.6 : 1.1}
        filter={hot ? "url(#atg-glow-hard)" : live ? "url(#atg-glow)" : undefined}
      />
      {/* firewall gets a small severing tick across the incoming limb */}
      {node.kind === "firewall" && live && (
        <line
          x1={node.x - 13}
          y1={node.y - 13}
          x2={node.x + 13}
          y2={node.y + 13}
          stroke="rgba(255,255,255,0.96)"
          strokeWidth={2}
          filter="url(#atg-glow)"
        />
      )}
      {/* certificate gets an inner ring so it reads as a seal */}
      {node.kind === "certificate" && live && (
        <circle
          cx={node.x}
          cy={node.y}
          r={node.r - 3.5}
          fill="none"
          stroke="rgba(255,255,255,0.85)"
          strokeWidth={1}
        />
      )}
    </>
  );

  if (!isAnimated) {
    return <g opacity={live ? 1 : 0.4}>{dot}</g>;
  }

  return (
    <m.g
      initial={false}
      animate={{ opacity: live ? 1 : 0.4, scale: live ? 1 : 0.7 }}
      style={{ transformOrigin: `${node.x}px ${node.y}px` }}
      transition={{ duration: 0.55, ease: EASE_OUT_EXPO }}
    >
      {dot}
    </m.g>
  );
}

/** A node's two-line label (eyebrow + title), solid-fill SVG text. Positioned
 *  on the node's anchor side so it never overlaps the figure. */
function NodeLabel({
  node,
  live,
  hot,
  isAnimated,
}: {
  node: TreeNode;
  live: boolean;
  hot: boolean;
  isAnimated: boolean;
}) {
  // anchor offsets by side
  const gap = node.r + 12;
  let tx = node.x;
  let ty = node.y;
  let anchor: "start" | "middle" | "end" = "middle";
  let eyebrowDy = -gap - 8;
  let titleDy = -gap + 6;

  if (node.side === "left") {
    tx = node.x - gap;
    anchor = "end";
    eyebrowDy = -7;
    titleDy = 9;
  } else if (node.side === "right") {
    tx = node.x + gap;
    anchor = "start";
    eyebrowDy = -7;
    titleDy = 9;
  } else if (node.side === "top") {
    ty = node.y - gap;
    anchor = "middle";
    eyebrowDy = -15;
    titleDy = 1;
  } else {
    // bottom
    ty = node.y + gap;
    anchor = "middle";
    eyebrowDy = 8;
    titleDy = 23;
  }

  const titleColor = hot
    ? "rgba(245,247,250,1)"
    : live
      ? "rgba(217,222,231,0.92)"
      : "rgba(217,222,231,0.4)";
  const eyebrowColor = live ? "rgba(159,164,175,0.95)" : "rgba(95,104,117,0.6)";

  const content = (
    <>
      <text
        x={tx}
        y={ty + eyebrowDy}
        textAnchor={anchor}
        className="atg-eyebrow"
        fill={eyebrowColor}
      >
        {node.eyebrow}
      </text>
      <text
        x={tx}
        y={ty + titleDy}
        textAnchor={anchor}
        className="atg-title"
        fill={titleColor}
      >
        {node.title}
      </text>
    </>
  );

  if (!isAnimated) {
    return <g opacity={live ? 1 : 0.5}>{content}</g>;
  }

  return (
    <m.g
      initial={false}
      animate={{ opacity: live ? 1 : 0.45 }}
      transition={{ duration: 0.5, ease: EASE_OUT_EXPO, delay: 0.12 }}
    >
      {content}
    </m.g>
  );
}
