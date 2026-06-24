"use client";

import { useEffect, useMemo } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./reactflow-noir.css";
import { HydraNode } from "./HydraNode";
import { HydraEdge } from "./HydraEdge";
import { buildFlowGraph } from "@/lib/graph";
import type { Graph, GraphNode, Firewall } from "@/lib/types";
import { cn } from "@/lib/cn";

interface GraphCanvasProps {
  graph: Graph;
  firewall: Firewall;
  onNodeSelect: (node: GraphNode) => void;
  className?: string;
}

const NODE_TYPES = { hydra: HydraNode };
const EDGE_TYPES = { hydra: HydraEdge };

// The Context Graph hero canvas. Builds a deterministic layered layout from the
// backend graph, renders monochrome custom nodes/edges, and dims the field when
// any tainted path is active so the poison route reads first. Read-only: drag
// and zoom are allowed, but nodes/edges are not editable. Clicking a node
// surfaces it to the parent for the inspector. Uses React Flow's managed node
// and edge state so handle bounds are measured and edges position correctly.
export function GraphCanvas({
  graph,
  firewall,
  onNodeSelect,
  className,
}: GraphCanvasProps) {
  const built = useMemo(() => {
    const result = buildFlowGraph(graph, firewall);
    // PositionedNode carries pre-declared handle bounds (an internal React Flow
    // field), so it is cast to Node at this boundary.
    const flowNodes = result.nodes as unknown as Node[];
    const flowEdges: Edge[] = result.edges.map((e) => ({
      ...e,
      className: e.data.blocked
        ? "blocked"
        : e.data.tainted
          ? "tainted"
          : undefined,
    }));
    const hasTaint = result.edges.some((e) => e.data.tainted);
    return { flowNodes, flowEdges, hasTaint };
  }, [graph, firewall]);

  const [nodes, setNodes, onNodesChange] = useNodesState(built.flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(built.flowEdges);

  // Re-seed managed state when the source run changes.
  useEffect(() => {
    setNodes(built.flowNodes);
    setEdges(built.flowEdges);
  }, [built.flowNodes, built.flowEdges, setNodes, setEdges]);

  return (
    <div
      className={cn(
        "hydra-flow relative h-full w-full overflow-hidden rounded-xl2 border border-hairline bg-deep/50",
        className,
      )}
    >
      {built.hasTaint && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[1] bg-black/35"
        />
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        onNodeClick={(_, node) => {
          const data = node.data as { node?: GraphNode };
          if (data.node) onNodeSelect(data.node);
        }}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        minZoom={0.4}
        maxZoom={1.6}
        proOptions={{ hideAttribution: false }}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
        edgesFocusable={false}
        className="relative z-[2]"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={26}
          size={1}
          color="rgba(255,255,255,0.08)"
        />
        <Controls
          showInteractive={false}
          position="bottom-right"
          className="!bg-transparent"
        />
      </ReactFlow>
    </div>
  );
}
