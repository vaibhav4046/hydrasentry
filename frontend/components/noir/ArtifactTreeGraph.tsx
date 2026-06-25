"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { m, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";
import { usePauseOffscreen } from "@/hooks/usePauseOffscreen";
import { GraphNodeLabel } from "./GraphNodeLabel";
import type { InspectorNode } from "./NodeInspectorPreview";
import type { Graph, GraphNode } from "@/lib/types";
import {
  BRANCHES,
  CANOPY,
  DEMO_BADGES,
  DEMO_TAINTED_PATH,
  MAX_STAGE,
  NODE_EDGES,
  PARTICLES,
  QUERY_PATH_D,
  STAGE_COUNT,
  VB_H,
  VB_W,
  badgeCenter,
  type DemoBadge,
} from "./artifactTreeData";

interface ArtifactTreeGraphProps {
  /** Drive a specific stage 0..7 (overrides autoplay). */
  stage?: number;
  /** Cycle stages slowly and idle-breathe (hero default). Ignored if `stage` set. */
  autoplay?: boolean;
  /** Loop the autoplay cycle (default true when autoplay). */
  loop?: boolean;
  /** Real run graph; when present, renders its nodes/edges instead of the demo. */
  graph?: Graph | null;
  /** Which badge id is force-highlighted as the selected tainted path. */
  selectedPathId?: string | null;
  onNodeClick?: (node: InspectorNode) => void;
  onNodeHover?: (node: InspectorNode | null) => void;
  onPathSelect?: (id: string) => void;
  className?: string;
}

// Autoplay pacing (seconds the build spends per stage, then a long idle breathe).
const STAGE_HOLD_MS = 1150;
const IDLE_HOLD_MS = 3400;

/**
 * The signature monochrome "artifact tree graph" — a luminous white context
 * tree (trunk -> canopy of thin branch strokes + glowing node-dots) ringed by
 * labelled context-node badges, with a dramatic white-hot TAINTED PATH
 * (memory -> conflict -> risk -> firewall). Staged 0..7: INIT, SEED, RETRIEVE,
 * BUILD PATHS, CONFLICT, RISK, BLOCK, REPORT.
 *
 * Geometry is deterministic (seeded, fixed arrays in artifactTreeData) so SSR
 * and client match — no hydration drift. GPU-light: only opacity / transform /
 * pathLength / stroke-dashoffset animate, plus a couple of small SVG glow
 * filters. A bounded rAF-free timer advances stages in autoplay; CSS/framer
 * loops carry the traveling dash + dot breathing. prefers-reduced-motion renders
 * the fully composed final frame with no loops.
 *
 * When a real `graph` is passed it renders that graph's nodes/edges/tainted_path
 * (same visual language) instead of the demo artifact tree.
 */
export function ArtifactTreeGraph({
  stage,
  autoplay = false,
  loop = true,
  graph = null,
  selectedPathId = null,
  onNodeClick,
  onNodeHover,
  onPathSelect,
  className,
}: ArtifactTreeGraphProps) {
  const prefersReduced = useReducedMotion();
  // Pause the perpetual ember twinkle + traveling dash when the tree is
  // scrolled out of view or the tab is hidden (CSS animation-play-state).
  const hostRef = usePauseOffscreen<HTMLDivElement>("200px 0px");

  // ---- resolve the active stage ---------------------------------------------
  const controlled = stage != null;
  const [autoStage, setAutoStage] = useState<number>(
    prefersReduced ? MAX_STAGE : 0,
  );

  // Autoplay: walk 0 -> MAX_STAGE on a timer, hold at the end (idle breathe),
  // then loop back to 0. Reduced motion freezes on the final frame. All stage
  // updates happen inside timer callbacks (never synchronously in the effect).
  useEffect(() => {
    if (controlled || !autoplay || prefersReduced) return;
    let timer: ReturnType<typeof setTimeout>;
    let current = 0;
    const tick = () => {
      if (current < MAX_STAGE) {
        current += 1;
        setAutoStage(current);
        timer = setTimeout(tick, STAGE_HOLD_MS);
      } else if (loop) {
        timer = setTimeout(() => {
          current = 0;
          setAutoStage(0);
          timer = setTimeout(tick, STAGE_HOLD_MS);
        }, IDLE_HOLD_MS);
      }
    };
    // Reset to INIT on the next frame, then begin the build — avoids a
    // synchronous setState in the effect body.
    timer = setTimeout(() => {
      setAutoStage(0);
      timer = setTimeout(tick, STAGE_HOLD_MS);
    }, 0);
    return () => clearTimeout(timer);
  }, [controlled, autoplay, loop, prefersReduced]);

  const activeStage = controlled
    ? clampStage(stage as number)
    : prefersReduced
      ? MAX_STAGE
      : autoStage;

  const isAnimated = !prefersReduced;

  // ---- demo vs real graph ---------------------------------------------------
  const useReal = graph != null && graph.nodes.length > 0;
  const realModel = useMemo(
    () => (useReal ? buildRealModel(graph as Graph) : null),
    [useReal, graph],
  );

  // Stable filter ids (component can mount more than once).
  const ids = useMemo(
    () => ({
      glow: "atg-glow",
      taintGlow: "atg-taint-glow",
      spot: "atg-spot",
      softBlur: "atg-soft",
    }),
    [],
  );

  // ---- shared SVG defs ------------------------------------------------------
  // Glow is a SEPARATE pre-blurred halo layer rendered BENEATH the crisp
  // strokes — never a blur smeared over the linework (that's what made the tree
  // fuzzy). `softBlur` blurs a duplicate of the strokes for the halo; the real
  // strokes paint on top at full crispness with shape-rendering=geometricPrecision.
  const defs = (
    <defs>
      <radialGradient id={ids.spot} cx="50%" cy="42%" r="62%">
        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.1" />
        <stop offset="46%" stopColor="#FFFFFF" stopOpacity="0.035" />
        <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
      </radialGradient>
      {/* pure blur for the underneath halo pass (no source-merge => no smear on top) */}
      <filter
        id={ids.softBlur}
        x="-40%"
        y="-40%"
        width="180%"
        height="180%"
        colorInterpolationFilters="sRGB"
      >
        <feGaussianBlur stdDeviation="2.2" />
      </filter>
      {/* crisp taint glow: tight blur, merged under the source so the hot edge stays sharp */}
      <filter
        id={ids.taintGlow}
        x="-80%"
        y="-80%"
        width="260%"
        height="260%"
        colorInterpolationFilters="sRGB"
      >
        <feGaussianBlur stdDeviation="2.4" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  );

  return (
    <div
      ref={hostRef}
      className={cn("relative w-full select-none", className)}
      aria-hidden="true"
    >
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="block h-auto w-full overflow-visible [transform:translateZ(0)]"
        fill="none"
        preserveAspectRatio="xMidYMid meet"
        shapeRendering="geometricPrecision"
        role="presentation"
      >
        {defs}

        {/* INIT layer (stage >= 0): grid rings + spotlight wash + particles */}
        <rect x="0" y="0" width={VB_W} height={VB_H} fill={`url(#${ids.spot})`} />
        <Rings isAnimated={isAnimated} />
        <Particles isAnimated={isAnimated} activeStage={activeStage} />

        {useReal && realModel ? (
          <RealEdges
            model={realModel}
            activeStage={activeStage}
            isAnimated={isAnimated}
            ids={ids}
          />
        ) : (
          <>
            {/* SEED (stage >= 1): branches draw in via pathLength */}
            <Branches activeStage={activeStage} isAnimated={isAnimated} ids={ids} />

            {/* BUILD PATHS (stage >= 3): a clean query path glows through */}
            <QueryPath activeStage={activeStage} isAnimated={isAnimated} ids={ids} />

            {/* node edges (badge -> canopy / chain), revealed per stage */}
            <NodeEdges
              activeStage={activeStage}
              isAnimated={isAnimated}
              ids={ids}
              selectedPathId={selectedPathId}
            />
          </>
        )}
      </svg>

      {/* node badges as HTML overlay (real lucide icons + hover/click) */}
      <div className="pointer-events-none absolute inset-0">
        {(useReal && realModel ? realModel.badges : DEMO_BADGES).map((badge) => (
          <BadgeOverlay
            key={badge.id}
            badge={badge}
            activeStage={activeStage}
            isAnimated={isAnimated}
            selectedPathId={selectedPathId}
            onNodeClick={onNodeClick}
            onNodeHover={onNodeHover}
            onPathSelect={onPathSelect}
          />
        ))}
      </div>
    </div>
  );
}

// ---- helpers ----------------------------------------------------------------
function clampStage(s: number): number {
  if (!Number.isFinite(s)) return 0;
  return Math.max(0, Math.min(MAX_STAGE, Math.round(s)));
}

const pct = (v: number, total: number) => `${(v / total) * 100}%`;

// ---- INIT: faint concentric rings behind the canopy -------------------------
function Rings({ isAnimated }: { isAnimated: boolean }) {
  const rings = [120, 200, 300];
  return (
    <g>
      {rings.map((r, i) => (
        <m.circle
          key={r}
          cx={CANOPY.x}
          cy={CANOPY.y}
          r={r}
          fill="none"
          stroke="#FFFFFF"
          strokeOpacity={0.05}
          strokeWidth={1}
          strokeDasharray="2 6"
          initial={isAnimated ? { opacity: 0, scale: 0.9 } : false}
          animate={isAnimated ? { opacity: 1, scale: 1 } : undefined}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: i * 0.1 }}
          style={{ transformOrigin: `${CANOPY.x}px ${CANOPY.y}px` }}
        />
      ))}
    </g>
  );
}

// ---- INIT: glowing node-dots, breathing forever -----------------------------
// Breathing is driven by ONE CSS keyframe (.atg-ember), staggered per-dot via
// custom properties — not ~90 framer motion values. This is the single biggest
// jank win: the twinkle runs on the compositor with near-zero main-thread cost.
function Particles({
  isAnimated,
  activeStage,
}: {
  isAnimated: boolean;
  activeStage: number;
}) {
  return (
    <g style={{ willChange: "opacity", transform: "translateZ(0)" }}>
      {PARTICLES.map((p, i) => {
        const shown = activeStage >= (p.bright > 0.55 ? 0 : 1);
        const baseOpacity = 0.25 + p.bright * 0.6;
        if (!shown) return null;
        if (!isAnimated) {
          return (
            <circle
              key={`p-${i}`}
              cx={p.x}
              cy={p.y}
              r={p.r}
              fill="#FFFFFF"
              opacity={baseOpacity}
            />
          );
        }
        return (
          <circle
            key={`p-${i}`}
            cx={p.x}
            cy={p.y}
            r={p.r}
            fill="#FFFFFF"
            className="atg-ember"
            style={
              {
                "--atg-bright": baseOpacity.toFixed(3),
                "--atg-dur": `${(3 + p.phase * 2).toFixed(2)}s`,
                "--atg-delay": `${(p.phase * 1.5).toFixed(2)}s`,
              } as CSSProperties
            }
          />
        );
      })}
    </g>
  );
}

// ---- SEED: branch strokes draw in -------------------------------------------
// Two passes for razor-sharp luminosity:
//   1) a soft, low-opacity HALO underneath (pre-blurred, thicker) — the glow
//   2) the CRISP white strokes on top (no filter) — the actual linework
// This keeps every limb pixel-sharp at 4K while still reading as luminous.
function Branches({
  activeStage,
  isAnimated,
  ids,
}: {
  activeStage: number;
  isAnimated: boolean;
  ids: { softBlur: string };
}) {
  const drawn = activeStage >= 1;

  const drawProps = (b: (typeof BRANCHES)[number]) => ({
    initial: isAnimated ? ({ pathLength: 0, opacity: 0 } as const) : false,
    animate: isAnimated
      ? { pathLength: drawn ? 1 : 0, opacity: drawn ? 1 : 0 }
      : { pathLength: 1, opacity: 1 },
    transition: isAnimated
      ? {
          pathLength: {
            duration: 0.7,
            ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
            delay: drawn ? b.order * 0.16 : 0,
          },
          opacity: { duration: 0.3, delay: drawn ? b.order * 0.16 : 0 },
        }
      : undefined,
  });

  return (
    <>
      {/* 1) blurred halo pass (the glow) — beneath, never smeared over strokes */}
      <g style={{ filter: `url(#${ids.softBlur})`, willChange: "opacity" }}>
        {BRANCHES.map((b, i) => (
          <m.path
            key={`bh-${i}`}
            d={b.d}
            stroke="#FFFFFF"
            strokeOpacity={(0.1 + b.bright * 0.28).toFixed(3)}
            strokeWidth={b.width + 1.6}
            strokeLinecap="round"
            fill="none"
            {...drawProps(b)}
          />
        ))}
      </g>
      {/* 2) crisp linework pass — no filter, geometricPrecision from the root svg */}
      <g>
        {BRANCHES.map((b, i) => (
          <m.path
            key={`bc-${i}`}
            d={b.d}
            stroke="#FFFFFF"
            strokeOpacity={(0.34 + b.bright * 0.62).toFixed(3)}
            strokeWidth={b.width}
            strokeLinecap="round"
            fill="none"
            {...drawProps(b)}
          />
        ))}
      </g>
    </>
  );
}

// ---- BUILD PATHS: a clean retrieval path glows through the safe branches ----
function QueryPath({
  activeStage,
  isAnimated,
  ids,
}: {
  activeStage: number;
  isAnimated: boolean;
  ids: { softBlur: string };
}) {
  const shown = activeStage >= 3;
  if (!shown) return null;
  const reveal = isAnimated
    ? { pathLength: 1, opacity: [0, 0.78, 0.5] }
    : { pathLength: 1, opacity: 0.55 };
  const trans = isAnimated
    ? { pathLength: { duration: 1, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }, opacity: { duration: 1 } }
    : undefined;
  return (
    <>
      {/* soft halo beneath */}
      <m.path
        d={QUERY_PATH_D}
        stroke="#FFFFFF"
        strokeOpacity={0.22}
        strokeWidth={4}
        strokeLinecap="round"
        fill="none"
        style={{ filter: `url(#${ids.softBlur})` }}
        initial={isAnimated ? { pathLength: 0, opacity: 0 } : false}
        animate={reveal}
        transition={trans}
      />
      {/* crisp accent on top */}
      <m.path
        d={QUERY_PATH_D}
        stroke="#FFFFFF"
        strokeOpacity={0.7}
        strokeWidth={1.8}
        strokeLinecap="round"
        fill="none"
        initial={isAnimated ? { pathLength: 0, opacity: 0 } : false}
        animate={reveal}
        transition={trans}
      />
    </>
  );
}

// ---- node edges (demo): badge -> canopy / tainted chain ---------------------
function NodeEdges({
  activeStage,
  isAnimated,
  ids,
  selectedPathId,
}: {
  activeStage: number;
  isAnimated: boolean;
  ids: { taintGlow: string };
  selectedPathId: string | null;
}) {
  const pathSelected = isPathSelected(selectedPathId);
  return (
    <g>
      {NODE_EDGES.map((e, i) => {
        const a = badgeCenter(e.from);
        const b = badgeCenter(e.to);
        // Render once the edge's stage is reached, OR (for tainted edges) as
        // soon as the user explicitly selects the risky path — so clicking
        // Path 1 lights the tainted branch even before the demo reaches it.
        const shown = activeStage >= e.appearStage || (e.tainted && pathSelected);
        if (!shown) return null;
        // Tainted edges go white-hot once CONFLICT (stage 4) surfaces, or when
        // the risky path is selected.
        const hot = e.tainted && (activeStage >= 4 || pathSelected);
        return (
          <g key={`ne-${i}`}>
            <m.line
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="#FFFFFF"
              strokeOpacity={hot ? 0.96 : e.tainted ? 0.66 : 0.32}
              strokeWidth={hot ? 2.4 : e.tainted ? 1.6 : 1.1}
              strokeDasharray={e.tainted ? "5 4" : "3 5"}
              style={{
                filter: hot ? `url(#${ids.taintGlow})` : undefined,
                transition: "stroke-opacity 0.4s ease, stroke-width 0.4s ease",
              }}
              initial={isAnimated ? { pathLength: 0, opacity: 0 } : false}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={
                isAnimated
                  ? {
                      pathLength: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
                      opacity: { duration: 0.3 },
                    }
                  : undefined
              }
            />
            {/* traveling dash on hot tainted edges — CSS keyframe, GPU-cheap */}
            {isAnimated && hot && (
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="#FFFFFF"
                strokeOpacity={0.98}
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeDasharray="10 200"
                className="atg-travel"
                style={{ filter: `url(#${ids.taintGlow})` }}
              />
            )}
          </g>
        );
      })}
    </g>
  );
}

// ---- real-graph edges -------------------------------------------------------
interface RealModel {
  badges: DemoBadge[];
  edges: { from: string; to: string; tainted: boolean }[];
}

function RealEdges({
  model,
  activeStage,
  isAnimated,
  ids,
}: {
  model: RealModel;
  activeStage: number;
  isAnimated: boolean;
  ids: { taintGlow: string };
}) {
  const lookup = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    map.set("canopy", CANOPY);
    for (const b of model.badges) map.set(b.id, { x: b.x, y: b.y });
    return map;
  }, [model]);

  return (
    <g>
      {model.edges.map((e, i) => {
        const a = lookup.get(e.from) ?? CANOPY;
        const b = lookup.get(e.to) ?? CANOPY;
        const hot = e.tainted && activeStage >= 4;
        return (
          <g key={`re-${i}`}>
            <m.line
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="#FFFFFF"
              strokeOpacity={hot ? 0.96 : e.tainted ? 0.66 : 0.32}
              strokeWidth={hot ? 2.4 : e.tainted ? 1.6 : 1.1}
              strokeDasharray={e.tainted ? "5 4" : "3 5"}
              style={{
                filter: hot ? `url(#${ids.taintGlow})` : undefined,
                transition: "stroke-opacity 0.4s ease, stroke-width 0.4s ease",
              }}
              initial={isAnimated ? { pathLength: 0, opacity: 0 } : false}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={
                isAnimated
                  ? { pathLength: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } }
                  : undefined
              }
            />
            {isAnimated && hot && (
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="#FFFFFF"
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeDasharray="10 200"
                className="atg-travel"
                style={{ filter: `url(#${ids.taintGlow})` }}
              />
            )}
          </g>
        );
      })}
    </g>
  );
}

// ---- HTML badge overlay (positioned from viewBox coords) --------------------
function BadgeOverlay({
  badge,
  activeStage,
  isAnimated,
  selectedPathId,
  onNodeClick,
  onNodeHover,
  onPathSelect,
}: {
  badge: DemoBadge;
  activeStage: number;
  isAnimated: boolean;
  selectedPathId: string | null;
  onNodeClick?: (node: InspectorNode) => void;
  onNodeHover?: (node: InspectorNode | null) => void;
  onPathSelect?: (id: string) => void;
}) {
  const shown = activeStage >= badge.appearStage;
  if (!shown) return null;

  const pathSelected = isPathSelected(selectedPathId);
  // A tainted badge reads "hot" once CONFLICT surfaces or the risky path is on.
  const hot = badge.tainted && (activeStage >= 4 || pathSelected);
  const align = badge.column === "right" ? "left" : "right";

  const node: InspectorNode = {
    id: badge.id,
    title: badge.title,
    type: badge.type,
    sourceChunkId: badge.sourceChunkId ?? null,
    tenant: badge.tenant ?? null,
    subTenant: badge.subTenant ?? null,
    relevancy: badge.relevancy ?? null,
    status: badge.status ?? null,
    riskReason: badge.riskReason ?? null,
    tainted: badge.tainted,
  };

  const Icon = badge.Icon;
  // anchor: top-column centers; side columns anchor their inner edge to the point
  const translate =
    badge.column === "top"
      ? "translate(-50%, -50%)"
      : badge.column === "left"
        ? "translate(0, -50%)"
        : "translate(-100%, -50%)";

  return (
    <div
      className="pointer-events-auto absolute"
      style={{
        left: pct(badge.x, VB_W),
        top: pct(badge.y, VB_H),
        transform: translate,
      }}
    >
      <GraphNodeLabel
        icon={<Icon className="h-[18px] w-[18px]" strokeWidth={1.7} />}
        title={badge.title}
        sub={badge.sub}
        tainted={hot}
        animate={isAnimated}
        align={align}
        onClick={onNodeClick ? () => onNodeClick(node) : undefined}
        onHoverStart={onNodeHover ? () => onNodeHover(node) : undefined}
        onHoverEnd={onNodeHover ? () => onNodeHover(null) : undefined}
      />
      {/* invisible click target also selects the tainted path for tainted nodes */}
      {badge.tainted && onPathSelect && (
        <button
          aria-hidden
          tabIndex={-1}
          className="sr-only"
          onClick={() => onPathSelect(badge.id)}
        />
      )}
    </div>
  );
}

function isPathSelected(selectedPathId: string | null): boolean {
  return selectedPathId != null && DEMO_TAINTED_PATH.includes(selectedPathId);
}

// ---- build a layout from a real run graph -----------------------------------
// Lays real nodes into the same top/left/right column rhythm so the visual
// language matches the demo tree. Tainted membership comes from tainted_path.
function buildRealModel(graph: Graph): RealModel {
  const taint = new Set(graph.tainted_path ?? []);
  const COLUMN_FOR: Record<string, "top" | "left" | "right"> = {
    user_task: "top",
    report: "top",
    clean_policy: "left",
    poisoned_memory: "left",
    query_path: "right",
    policy_conflict: "right",
    unsafe_tool_action: "right",
    mcp_firewall: "right",
  };

  const left: GraphNode[] = [];
  const right: GraphNode[] = [];
  const top: GraphNode[] = [];
  for (const n of graph.nodes) {
    const col = COLUMN_FOR[n.type] ?? (left.length <= right.length ? "left" : "right");
    if (col === "top") top.push(n);
    else if (col === "left") left.push(n);
    else right.push(n);
  }

  const place = (
    list: GraphNode[],
    x: number,
    column: "top" | "left" | "right",
  ): DemoBadge[] =>
    list.map((n, i) => {
      const span = list.length > 1 ? 520 : 0;
      const y = column === "top" ? 70 : 150 + (i * span) / Math.max(1, list.length - 1);
      const tainted = taint.has(n.id) || n.trust === "poisoned";
      return {
        id: n.id,
        title: n.label.toUpperCase(),
        sub: n.status || n.type,
        Icon: iconForType(n.type),
        x: column === "top" ? 500 : x,
        y,
        column,
        tainted,
        appearStage: 2,
        type: n.type,
        sourceChunkId: n.source_chunk_id ?? undefined,
        tenant: n.tenant_id ?? undefined,
        subTenant: n.sub_tenant_id ?? undefined,
        status: n.status,
        riskReason: n.risk_reason ?? undefined,
      };
    });

  const badges = [
    ...place(top, 500, "top"),
    ...place(left, 150, "left"),
    ...place(right, 850, "right"),
  ];

  const edges = graph.edges.map((e) => ({
    from: e.source,
    to: e.target,
    tainted: e.tainted,
  }));

  return { badges, edges };
}

function iconForType(type: string) {
  // imported lazily from the data module's icon set via a small switch
  const map = DEMO_BADGES.find((b) => b.type === type);
  return map ? map.Icon : DEMO_BADGES[0].Icon;
}

export { STAGE_COUNT };
