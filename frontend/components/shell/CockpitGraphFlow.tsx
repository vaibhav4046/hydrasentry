"use client";

import { useId, useMemo } from "react";
import { useReducedMotion } from "framer-motion";
import {
  Crosshair,
  ShieldCheck,
  Skull,
  AlertOctagon,
  GitBranch,
  Zap,
  ShieldAlert,
  FileText,
  type LucideIcon,
} from "lucide-react";
import type { Graph } from "@/lib/types";
import {
  buildGraphModel,
  type FlowModel,
  type FlowNode,
  type GraphRole,
} from "@/lib/cockpit/graphModel";

/**
 * Context Graph — a deterministic, tiered, left-to-right DIRECTED graph rendered
 * as crisp SVG (no free canvas scatter). It always shows the logical
 * memory-poisoning attack flow so /graph is never blank on the deployed
 * standalone, and renders a REAL run's graph in the same tiered layout when one
 * is present. Nodes sit in fixed columns (USER TASK → POLICY/MEMORY → CONFLICT →
 * QUERY_PATH → UNSAFE ACTION → FIREWALL → REPORT); edges carry arrowheads and
 * short relation labels (retrieves / contradicts / carries / invokes / blocks /
 * logs). The tainted path burns bright white with an animated directed flow;
 * clean edges stay dim. Danger is brightness + motion, never hue. Clicking a
 * node reports its id to the inspector.
 */

const ROLE_ICON: Record<GraphRole, LucideIcon> = {
  user_task: Crosshair,
  clean_policy: ShieldCheck,
  poisoned_memory: Skull,
  policy_conflict: AlertOctagon,
  query_path: GitBranch,
  unsafe_tool_action: Zap,
  mcp_firewall: ShieldAlert,
  report: FileText,
};

interface CockpitGraphFlowProps {
  /** Real run graph; when present its nodes/edges drive the layout. */
  graph: Graph | null;
  selectedId: string;
  onInspect: (id: string) => void;
}

const MONO = "var(--font-geist-mono), 'JetBrains Mono', monospace";

export function CockpitGraphFlow({
  graph,
  selectedId,
  onInspect,
}: CockpitGraphFlowProps) {
  const prefersReduced = useReducedMotion();
  const uid = useId().replace(/[:]/g, "");
  const model: FlowModel = useMemo(() => buildGraphModel(graph), [graph]);

  const nodeById = useMemo(() => {
    const m = new Map<string, FlowNode>();
    for (const n of model.nodes) m.set(n.id, n);
    return m;
  }, [model.nodes]);

  // The canonical attack flow always carries a tainted path; we highlight it
  // bright (decoupled from any live posture) so /graph reads as a clear,
  // logical directed graph even on the cold standalone. Both the demo graph and
  // any real run graph are inherently poisoned scenarios.
  const hasTaint = model.nodes.some((n) => n.tainted);

  const animate = !prefersReduced;
  const arrowDim = `arrow-dim-${uid}`;
  const arrowHot = `arrow-hot-${uid}`;

  return (
    <svg
      viewBox={`0 0 ${model.width} ${model.height}`}
      preserveAspectRatio="xMidYMid meet"
      width="100%"
      height="100%"
      role="img"
      aria-label="Context graph showing the memory poisoning attack flow intercepted by the MCP firewall"
      style={{ display: "block" }}
    >
      <defs>
        <marker
          id={arrowDim}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M0,0 L10,5 L0,10 z" fill="rgba(210,220,235,0.32)" />
        </marker>
        <marker
          id={arrowHot}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M0,0 L10,5 L0,10 z" fill="#ffffff" />
        </marker>
        <style>{`
          @keyframes flow-${uid} { to { stroke-dashoffset: -36; } }
          .flow-${uid} { animation: flow-${uid} 1s linear infinite; }
          @media (prefers-reduced-motion: reduce) {
            .flow-${uid} { animation: none; }
          }
        `}</style>
      </defs>

      {/* Edges first so nodes sit on top of the line endpoints. */}
      <g>
        {model.edges.map((e) => {
          const a = nodeById.get(e.source);
          const b = nodeById.get(e.target);
          if (!a || !b) return null;
          const hot = e.tainted;
          const path = edgePath(a, b);
          const labelPt = edgeLabelPoint(a, b);
          return (
            <g key={e.id}>
              {/* Base line + arrowhead */}
              <path
                d={path}
                fill="none"
                stroke={
                  hot
                    ? "rgba(255,255,255,0.85)"
                    : e.tainted
                      ? "rgba(220,228,240,0.22)"
                      : "rgba(200,212,230,0.16)"
                }
                strokeWidth={hot ? 1.8 : 1.1}
                markerEnd={`url(#${hot ? arrowHot : arrowDim})`}
                style={hot ? { filter: `drop-shadow(0 0 4px rgba(255,255,255,0.7))` } : undefined}
              />
              {/* Animated directed flow overlay on the tainted path. */}
              {hot && (
                <path
                  d={path}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth={2.2}
                  strokeLinecap="round"
                  strokeDasharray="6 30"
                  className={animate ? `flow-${uid}` : undefined}
                />
              )}
              {e.label && (
                <text
                  x={labelPt.x}
                  y={labelPt.y}
                  textAnchor="middle"
                  fontFamily={MONO}
                  fontSize={9}
                  letterSpacing="0.04em"
                  fill={hot ? "rgba(255,255,255,0.92)" : "rgba(220,228,240,0.45)"}
                  style={{ textTransform: "uppercase" }}
                >
                  {e.label}
                </text>
              )}
            </g>
          );
        })}
      </g>

      {/* Nodes */}
      <g>
        {model.nodes.map((n) => (
          <FlowNodeChip
            key={n.id}
            node={n}
            hasTaint={hasTaint}
            selected={selectedId === n.id}
            animate={animate}
            Icon={ROLE_ICON[n.role]}
            onInspect={onInspect}
          />
        ))}
      </g>
    </svg>
  );
}

// ---- Node chip --------------------------------------------------------------

interface FlowNodeChipProps {
  node: FlowNode;
  /** True when the graph carries a tainted path (lights the firewall guard). */
  hasTaint: boolean;
  selected: boolean;
  animate: boolean;
  Icon: LucideIcon;
  onInspect: (id: string) => void;
}

const NODE_W = 150;
const NODE_H = 62;

function FlowNodeChip({
  node,
  hasTaint,
  selected,
  animate,
  Icon,
  onInspect,
}: FlowNodeChipProps) {
  const hot = node.tainted;
  const isFirewall = node.role === "mcp_firewall";
  const guard = isFirewall && hasTaint;
  const x = node.x - NODE_W / 2;
  const y = node.y - NODE_H / 2;

  const border = selected
    ? "rgba(255,255,255,0.95)"
    : hot
      ? "rgba(255,255,255,0.6)"
      : guard
        ? "rgba(255,255,255,0.82)"
        : "rgba(255,255,255,0.16)";
  const bg = hot
    ? "rgba(255,255,255,0.07)"
    : guard
      ? "rgba(255,255,255,0.05)"
      : "rgba(13,16,20,0.9)";
  const titleColor = hot || guard ? "#ffffff" : "#f3f6fb";

  return (
    <g
      transform={`translate(${x} ${y})`}
      onClick={() => onInspect(node.id)}
      style={{ cursor: "pointer" }}
      role="button"
      aria-label={`${node.title} — ${node.kicker}`}
    >
      {/* Soft halo for the tainted / blocking nodes. */}
      {(hot || guard) && (
        <rect
          x={-3}
          y={-3}
          width={NODE_W + 6}
          height={NODE_H + 6}
          rx={13}
          fill="none"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth={6}
          style={{ filter: `blur(3px)` }}
        >
          {animate && (
            <animate
              attributeName="opacity"
              values="0.5;1;0.5"
              dur="2.4s"
              repeatCount="indefinite"
            />
          )}
        </rect>
      )}
      <rect
        width={NODE_W}
        height={NODE_H}
        rx={11}
        fill={bg}
        stroke={border}
        strokeWidth={selected ? 1.6 : 1}
      />
      {/* Icon tile */}
      <rect
        x={10}
        y={NODE_H / 2 - 14}
        width={28}
        height={28}
        rx={7}
        fill={hot || guard ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)"}
        stroke={hot || guard ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.1)"}
        strokeWidth={1}
      />
      <foreignObject x={16} y={NODE_H / 2 - 8} width={16} height={16}>
        <Icon
          width={16}
          height={16}
          strokeWidth={1.7}
          color={hot || guard ? "#f3f6fb" : "#9ba3af"}
        />
      </foreignObject>
      {/* Kicker */}
      <text
        x={46}
        y={NODE_H / 2 - 9}
        fontFamily={MONO}
        fontSize={7.5}
        letterSpacing="0.14em"
        fill="rgba(155,163,175,0.9)"
        style={{ textTransform: "uppercase" }}
      >
        {node.kicker}
      </text>
      {/* Title */}
      <text
        x={46}
        y={NODE_H / 2 + 5}
        fontFamily="var(--font-geist-sans), system-ui, sans-serif"
        fontSize={11.5}
        fontWeight={600}
        fill={titleColor}
      >
        {truncate(node.title, 16)}
      </text>
      {/* Sub line */}
      <text
        x={46}
        y={NODE_H / 2 + 18}
        fontFamily={MONO}
        fontSize={8}
        fill="rgba(155,163,175,0.75)"
      >
        {truncate(node.sub, 18)}
      </text>
      {/* Firewall BLOCKED chip */}
      {guard && (
        <text
          x={NODE_W - 10}
          y={14}
          textAnchor="end"
          fontFamily={MONO}
          fontSize={7.5}
          letterSpacing="0.16em"
          fontWeight={700}
          fill="#ffffff"
        >
          BLOCKED
        </text>
      )}
    </g>
  );
}

// ---- geometry ---------------------------------------------------------------

/** A smooth left-to-right path between two node centres (cubic, horizontal tangents). */
function edgePath(a: FlowNode, b: FlowNode): string {
  const x1 = a.x + NODE_W / 2;
  const y1 = a.y;
  const x2 = b.x - NODE_W / 2;
  const y2 = b.y;
  const dx = Math.max(40, (x2 - x1) * 0.5);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

function edgeLabelPoint(a: FlowNode, b: FlowNode): { x: number; y: number } {
  const x1 = a.x + NODE_W / 2;
  const x2 = b.x - NODE_W / 2;
  const midX = (x1 + x2) / 2;
  const midY = (a.y + b.y) / 2;
  // Nudge labels above the line; for steep same-column links nudge less.
  return { x: midX, y: midY - 6 };
}

function truncate(s: string, n: number): string {
  if (!s) return "";
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
