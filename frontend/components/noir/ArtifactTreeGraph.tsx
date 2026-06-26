"use client";

import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";
import { usePauseOffscreen } from "@/hooks/usePauseOffscreen";
import { usePointerField } from "@/hooks/usePointerField";
import { GraphNodeLabel } from "./GraphNodeLabel";
import type { InspectorNode } from "./NodeInspectorPreview";
import type { Graph, GraphNode } from "@/lib/types";
import { NeuralMemoryCore } from "./NeuralMemoryCore";
import {
  DEMO_BADGES,
  DEMO_TAINTED_PATH,
  MAX_STAGE,
  STAGE_COUNT,
  VB_H,
  VB_W,
  type DemoBadge,
} from "./artifactTreeData";
import {
  CORE,
  DEMO_CONNECTIONS,
  buildRealConnections,
  type Connection,
  type Pt,
} from "./neuralCoreData";

interface ArtifactTreeGraphProps {
  /** Drive a specific stage 0..7 (overrides autoplay). */
  stage?: number;
  /** Cycle stages slowly (hero default). Ignored if `stage` set. */
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
  /**
   * Optional override for the visual FIELD layer behind the badges. Defaults to
   * the lightweight 2D NeuralMemoryCore (used by /graph, /results, /replay). The
   * LANDING hero injects the WebGL2 GPU field here instead. Receives the resolved
   * stage + currently-hovered node id so it can light branches by stage/hover.
   */
  renderField?: (args: { stage: number; hoveredNodeId: string | null }) => React.ReactNode;
  className?: string;
}

// Autoplay pacing (ms the build spends per stage, then a long idle hold).
const STAGE_HOLD_MS = 1150;
const IDLE_HOLD_MS = 3400;

/**
 * The signature monochrome hero, now a DPR-scaled NEURAL MEMORY CORE canvas: a
 * luminous breathing core with elegant curved synaptic connections radiating to
 * the labelled context-node badges, light pulses travelling them like memories.
 * Geometry is precomputed once (seeded, SSR-safe); the canvas runs ONE rAF loop
 * with additive-bloom sprites, parked offscreen / when hidden. No per-frame React
 * state. The tainted path (memory -> conflict -> risk -> firewall) burns brighter
 * and pulses hotter/faster, danger is intensity, never hue.
 *
 * Public props are unchanged so /graph, /results and /replay keep working. When
 * a real `graph` is passed, its edges become the core-and-spokes web and its
 * nodes drive the badge overlay (same visual language as the demo).
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
  renderField,
  className,
}: ArtifactTreeGraphProps) {
  const prefersReduced = useReducedMotion();
  // Pause the rAF loop when the tree is offscreen or the tab is hidden (the
  // canvas reads the host's data-anim attribute set here).
  const pauseRef = usePauseOffscreen<HTMLDivElement>("200px 0px");
  // Spring-smoothed pointer field driving canvas parallax + attraction.
  const { hostRef: pointerHostRef, field: pointerField } =
    usePointerField<HTMLDivElement>();
  // Attach BOTH behaviours to the one host div via a merged callback ref.
  const setHostRef = useCallback(
    (el: HTMLDivElement | null) => {
      pauseRef.current = el;
      pointerHostRef.current = el;
    },
    [pauseRef, pointerHostRef],
  );

  // Which node is hovered (lifts + illuminates its canvas edges). Forwarded to
  // any external onNodeHover too so /graph etc. keep their inspector behaviour.
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const handleHover = useCallback(
    (node: InspectorNode | null) => {
      setHoveredId(node?.id ?? null);
      onNodeHover?.(node);
    },
    [onNodeHover],
  );

  // ---- resolve the active stage ---------------------------------------------
  const controlled = stage != null;
  const [autoStage, setAutoStage] = useState<number>(
    prefersReduced ? MAX_STAGE : 0,
  );

  // Autoplay walks 0 -> MAX_STAGE on a timer then holds, then loops. Reduced
  // motion freezes on the final frame. Stage updates only fire on transitions
  // (a handful per cycle), they re-gate voxel layers + badges, no per-frame work.
  useEffect(() => {
    if (controlled || !autoplay || prefersReduced) return;
    // One tracked timer id: every scheduling point cancels the prior timer
    // before reassigning, so at most one timeout is ever live and cleanup
    // always reaches it (no leaked setState-after-unmount on any branch).
    let timer: ReturnType<typeof setTimeout>;
    let current = 0;
    const schedule = (fn: () => void, ms: number) => {
      clearTimeout(timer);
      timer = setTimeout(fn, ms);
    };
    const tick = () => {
      if (current < MAX_STAGE) {
        current += 1;
        setAutoStage(current);
        schedule(tick, STAGE_HOLD_MS);
      } else if (loop) {
        schedule(() => {
          current = 0;
          setAutoStage(0);
          schedule(tick, STAGE_HOLD_MS);
        }, IDLE_HOLD_MS);
      }
    };
    schedule(() => {
      setAutoStage(0);
      schedule(tick, STAGE_HOLD_MS);
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

  // Synaptic web: demo by default; build the real graph's core-and-spokes web
  // when present (its edges + a core hub spoke to every node).
  const connections: Connection[] = useMemo(() => {
    if (useReal && realModel) {
      const centers = new Map<string, Pt>();
      centers.set("core", CORE);
      for (const b of realModel.badges) centers.set(b.id, { x: b.x, y: b.y });
      return buildRealConnections(graph as Graph, centers);
    }
    return DEMO_CONNECTIONS;
  }, [useReal, realModel, graph]);

  const badges = useReal && realModel ? realModel.badges : DEMO_BADGES;

  return (
    <div
      ref={setHostRef}
      className={cn("relative w-full select-none", className)}
      aria-hidden="true"
    >
      {/* The FIELD layer. By default the lightweight 2D NeuralMemoryCore (used by
          /graph, /results, /replay). The landing hero injects the WebGL2 GPU
          field via renderField, it owns its own pointer/pause hooks, so this
          host's pointerField simply goes unused in that case. Both draw their own
          volumetric core light + vignette + grain, so no CSS spotlight layers. */}
      {renderField ? (
        renderField({ stage: activeStage, hoveredNodeId: hoveredId })
      ) : (
        <NeuralMemoryCore
          connections={connections}
          stage={activeStage}
          staticFrame={!isAnimated}
          pointer={pointerField}
          hoveredNodeId={hoveredId}
        />
      )}

      {/* node badges as HTML overlay (real lucide icons + hover/click) */}
      <div className="pointer-events-none absolute inset-0">
        {badges.map((badge) => (
          <BadgeOverlay
            key={badge.id}
            badge={badge}
            activeStage={activeStage}
            isAnimated={isAnimated}
            selectedPathId={selectedPathId}
            onNodeClick={onNodeClick}
            onNodeHover={handleHover}
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
interface RealModel {
  badges: DemoBadge[];
}

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
    const col =
      COLUMN_FOR[n.type] ?? (left.length <= right.length ? "left" : "right");
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
      const y =
        column === "top" ? 70 : 150 + (i * span) / Math.max(1, list.length - 1);
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

  return { badges };
}

function iconForType(type: string) {
  const map = DEMO_BADGES.find((b) => b.type === type);
  return map ? map.Icon : DEMO_BADGES[0].Icon;
}

export { STAGE_COUNT };
