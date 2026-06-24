import React from "react";
import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { COLORS, EASE_OUT_QUINT } from "./theme";

export type GraphNode = {
  id: string;
  x: number;
  y: number;
  label?: string;
  /** "poison" nodes render hot/inverted. */
  kind?: "normal" | "root" | "poison";
};

export type GraphEdge = {
  from: string;
  to: string;
  /** true marks a tainted edge that pulses white-hot. */
  tainted?: boolean;
};

type Props = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Frame at which the graph begins growing in. */
  startFrame?: number;
  /** Per-edge draw stagger in frames. */
  edgeStagger?: number;
  /** When set, a packet travels along tainted edges (drives scene 3). */
  travel?: boolean;
  width?: number;
  height?: number;
};

/**
 * Monochrome memory graph. Edges draw in via stroke-dashoffset, nodes pop with a
 * spring, tainted edges pulse and can carry a traveling packet.
 */
export const GraphMini: React.FC<Props> = ({
  nodes,
  edges,
  startFrame = 0,
  edgeStagger = 6,
  travel = false,
  width = 900,
  height = 600,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - startFrame;

  const nodeById = (id: string) => nodes.find((n) => n.id === id)!;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* EDGES */}
      {edges.map((edge, i) => {
        const a = nodeById(edge.from);
        const b = nodeById(edge.to);
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        const drawStart = i * edgeStagger;
        const draw = interpolate(local, [drawStart, drawStart + 22], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: (t) => t,
        });
        const pulse = edge.tainted
          ? interpolate(Math.sin(local / 7), [-1, 1], [0.35, 1])
          : 1;
        const stroke = edge.tainted ? COLORS.white : "rgba(255,255,255,0.28)";
        const strokeWidth = edge.tainted ? 2.5 * pulse + 1 : 1.4;

        // Traveling packet position along tainted edge.
        const packetT = travel && edge.tainted
          ? (local % 40) / 40
          : null;
        const px = packetT !== null ? a.x + (b.x - a.x) * packetT : 0;
        const py = packetT !== null ? a.y + (b.y - a.y) * packetT : 0;

        return (
          <g key={`${edge.from}-${edge.to}`}>
            <line
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeDasharray={len}
              strokeDashoffset={len * (1 - draw)}
              style={
                edge.tainted
                  ? { filter: `drop-shadow(0 0 ${6 * pulse}px rgba(255,255,255,0.8))` }
                  : undefined
              }
            />
            {packetT !== null && draw >= 1 ? (
              <circle
                cx={px}
                cy={py}
                r={5}
                fill={COLORS.white}
                style={{ filter: "drop-shadow(0 0 8px rgba(255,255,255,0.95))" }}
              />
            ) : null}
          </g>
        );
      })}

      {/* NODES */}
      {nodes.map((node, i) => {
        const appearAt = startFrame + i * edgeStagger * 0.6;
        const pop = spring({
          frame: frame - appearAt,
          fps,
          config: { damping: 14, mass: 0.5, stiffness: 140 },
        });
        const r = (node.kind === "root" ? 13 : 8) * pop;
        const isPoison = node.kind === "poison";
        const poisonPulse = isPoison
          ? interpolate(Math.sin(local / 6), [-1, 1], [0.6, 1])
          : 1;

        return (
          <g key={node.id} opacity={pop}>
            {isPoison ? (
              <circle
                cx={node.x}
                cy={node.y}
                r={r + 8 * poisonPulse}
                fill="none"
                stroke={COLORS.white}
                strokeWidth={1.5}
                opacity={0.5 * poisonPulse}
              />
            ) : null}
            <circle
              cx={node.x}
              cy={node.y}
              r={r}
              fill={isPoison ? COLORS.black : COLORS.white}
              stroke={COLORS.white}
              strokeWidth={isPoison ? 2.5 : 0}
              style={{
                filter: isPoison
                  ? `drop-shadow(0 0 ${10 * poisonPulse}px rgba(255,255,255,0.9))`
                  : node.kind === "root"
                  ? "drop-shadow(0 0 10px rgba(255,255,255,0.55))"
                  : undefined,
              }}
            />
            {node.label ? (
              <text
                x={node.x}
                y={node.y + (node.kind === "root" ? 30 : 24)}
                fill={COLORS.textSecondary}
                fontFamily='"JetBrains Mono", monospace'
                fontSize={13}
                textAnchor="middle"
                opacity={interpolate(
                  frame - appearAt,
                  [0, 14],
                  [0, 1],
                  { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
                )}
              >
                {node.label}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
};

// Easing re-export so scenes can share the house curve.
export const HOUSE_EASE = EASE_OUT_QUINT;
