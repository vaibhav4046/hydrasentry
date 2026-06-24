"use client";

import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";
import type { FlowEdgeData } from "@/lib/graph";

/**
 * Custom edge: a bezier path that inherits the tainted/blocked stroke styling
 * from reactflow-noir.css (the canvas tags the edge with those classes). The
 * relation label rides the path midpoint in mono caps on a dark chip.
 */
export function HydraEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  label,
  data,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
  const edgeData = data as FlowEdgeData | undefined;
  const tainted = Boolean(edgeData?.tainted);

  return (
    <>
      <BaseEdge id={id} path={edgePath} />
      {label && (
        <EdgeLabelRenderer>
          <div
            className="mono pointer-events-none absolute rounded border border-hairline bg-base/85 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.06em]"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              color: tainted ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.5)",
            }}
          >
            {label as string}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
