"use client";

import { m } from "framer-motion";
import { cn } from "@/lib/cn";
import { graphEdgeReveal, staggerContainer } from "@/lib/motion";

interface ContextGraphPreviewProps {
  className?: string;
  /** Animate edges drawing in on view (default true). */
  animated?: boolean;
}

/**
 * Small decorative context graph with one highlighted tainted path. Pure SVG,
 * monochrome: trusted nodes are dim outlines, the poisoned node is a bright
 * filled circle, and the tainted edges are brighter + dashed. Used in hero and
 * feature cards as an at-a-glance "graph evidence" motif.
 */
export function ContextGraphPreview({
  className,
  animated = true,
}: ContextGraphPreviewProps) {
  const nodes = [
    { id: "task", x: 40, y: 60, label: "task", taint: false, big: true },
    { id: "policy", x: 150, y: 28, label: "policy", taint: false },
    { id: "mem", x: 150, y: 110, label: "poison", taint: true, big: true },
    { id: "path", x: 260, y: 70, label: "path", taint: true },
    { id: "tool", x: 360, y: 110, label: "action", taint: true },
    { id: "fw", x: 360, y: 28, label: "firewall", taint: false },
  ];
  const edges = [
    { from: "task", to: "policy", taint: false },
    { from: "task", to: "mem", taint: true },
    { from: "mem", to: "path", taint: true },
    { from: "path", to: "tool", taint: true },
    { from: "path", to: "fw", taint: false },
  ];
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));

  return (
    <svg
      viewBox="0 0 400 140"
      className={cn("h-auto w-full", className)}
      fill="none"
    >
      <m.g
        variants={animated ? staggerContainer : undefined}
        initial={animated ? "hidden" : false}
        whileInView={animated ? "show" : undefined}
        viewport={{ once: true, margin: "-30px" }}
      >
        {edges.map((e, i) => {
          const a = byId[e.from];
          const b = byId[e.to];
          return (
            <m.line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="white"
              strokeOpacity={e.taint ? 0.85 : 0.18}
              strokeWidth={e.taint ? 1.8 : 1}
              strokeDasharray={e.taint ? "4 3" : undefined}
              variants={animated ? graphEdgeReveal : undefined}
            />
          );
        })}
        {nodes.map((n) => (
          <g key={n.id}>
            <circle
              cx={n.x}
              cy={n.y}
              r={n.big ? 7 : 5}
              fill={n.taint ? "white" : "rgba(255,255,255,0.04)"}
              stroke="white"
              strokeOpacity={n.taint ? 1 : 0.4}
              strokeWidth={1.4}
              style={
                n.taint
                  ? { filter: "drop-shadow(0 0 6px rgba(255,255,255,0.7))" }
                  : undefined
              }
            />
            <text
              x={n.x}
              y={n.y + (n.y > 80 ? 20 : -12)}
              textAnchor="middle"
              className="mono"
              fontSize="7.5"
              fill="rgba(255,255,255,0.55)"
              letterSpacing="0.5"
            >
              {n.label}
            </text>
          </g>
        ))}
      </m.g>
    </svg>
  );
}
