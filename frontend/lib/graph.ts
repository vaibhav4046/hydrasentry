/**
 * Graph layout + classification for the Context Graph hero.
 *
 * The live HydraSentry engine emits generic nodes (type "entity") plus tainted
 * query_paths. This module maps each node to one of the visual roles the UI
 * renders (user_task, clean_policy, poisoned_memory, query_path, policy_conflict,
 * unsafe_tool_action, mcp_firewall, report), computes a deterministic left to
 * right layered layout (the backend graph carries no x/y), synthesizes stable
 * edge ids, and, when the firewall blocked, injects a firewall + report node
 * so the hero tells the full "blocked the unsafe action" story. Whether the
 * underlying graph is real or derived is surfaced verbatim via graph_source; the
 * injected firewall/report nodes are clearly part of the derived narrative.
 */
import type { Graph, GraphEdge, GraphNode, Firewall } from "./types";

/** The visual role a node plays in the hero, independent of backend `type`. */
export type GraphRole =
  | "user_task"
  | "clean_policy"
  | "poisoned_memory"
  | "query_path"
  | "policy_conflict"
  | "unsafe_tool_action"
  | "mcp_firewall"
  | "report";

export interface FlowNodeData {
  node: GraphNode;
  role: GraphRole;
  tainted: boolean;
  blocked: boolean;
  [key: string]: unknown;
}

interface NodeHandle {
  id: null;
  type: "source" | "target";
  position: "left" | "right";
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PositionedNode {
  id: string;
  type: "hydra";
  position: { x: number; y: number };
  data: FlowNodeData;
  // Explicit dimensions + pre-declared handle bounds so React Flow treats nodes
  // as initialized immediately and positions edges deterministically, without
  // depending on DOM measurement (which is unreliable under the Next 16 / React
  // 19 dev runtime). Edges fail to render if handleBounds never populate.
  width: number;
  height: number;
  sourcePosition: string;
  targetPosition: string;
  handles: NodeHandle[];
}

export const NODE_WIDTH = 208;
export const NODE_HEIGHT = 92;

// Pre-computed left (target) and right (source) handle bounds for a node of the
// fixed size, so toHandleBounds() can resolve edge endpoints without measuring.
function nodeHandles(): NodeHandle[] {
  const midY = NODE_HEIGHT / 2;
  return [
    {
      id: null,
      type: "target",
      position: "left",
      x: 0,
      y: midY,
      width: 1,
      height: 1,
    },
    {
      id: null,
      type: "source",
      position: "right",
      x: NODE_WIDTH,
      y: midY,
      width: 1,
      height: 1,
    },
  ];
}

export interface FlowEdgeData {
  tainted: boolean;
  blocked: boolean;
  [key: string]: unknown;
}

export interface PositionedEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  type: "hydra";
  data: FlowEdgeData;
}

const COLUMN_WIDTH = 260;
const ROW_HEIGHT = 130;
const ORIGIN_X = 40;
const ORIGIN_Y = 40;

/** Which layout column each role occupies, left to right. */
const ROLE_COLUMN: Record<GraphRole, number> = {
  user_task: 0,
  clean_policy: 0,
  poisoned_memory: 1,
  query_path: 1,
  policy_conflict: 1,
  unsafe_tool_action: 2,
  mcp_firewall: 3,
  report: 4,
};

/**
 * Classify a backend node into a visual role using status/trust/id heuristics,
 * because the derived graph reports every node as type "entity". A node whose
 * own `type` already matches a known role is respected.
 */
export function classifyRole(node: GraphNode): GraphRole {
  const known: GraphRole[] = [
    "user_task",
    "clean_policy",
    "poisoned_memory",
    "query_path",
    "policy_conflict",
    "unsafe_tool_action",
    "mcp_firewall",
    "report",
  ];
  if (known.includes(node.type as GraphRole)) return node.type as GraphRole;

  const id = node.id.toLowerCase();
  const tainted = node.status === "tainted" || node.trust === "poisoned";

  if (id.includes("firewall")) return "mcp_firewall";
  if (id.includes("report")) return "report";
  if (id.includes("action") || id.includes("tool")) {
    return tainted ? "unsafe_tool_action" : "query_path";
  }
  if (id.includes("poison") || (tainted && id.includes("mem"))) {
    return "poisoned_memory";
  }
  if (id.includes("policy")) {
    return tainted ? "policy_conflict" : "clean_policy";
  }
  if (id.includes("request") || id.includes("task") || id.includes("query")) {
    return "user_task";
  }
  if (tainted) return "poisoned_memory";
  return "clean_policy";
}

function isTaintedNode(node: GraphNode): boolean {
  return node.status === "tainted" || node.trust === "poisoned";
}

/**
 * Read an edge's display label. The documented contract exposes `label`; the
 * live engine emits `relation` instead, so we accept either.
 */
function edgeLabel(edge: GraphEdge): string {
  if (edge.label) return edge.label;
  const relation = (edge as { relation?: string }).relation;
  return relation ?? "";
}

/** Synthetic firewall node injected when the run was blocked. */
function firewallNode(): GraphNode {
  return {
    id: "mcp_firewall",
    label: "MCP Firewall",
    type: "mcp_firewall",
    trust: "trusted",
    status: "blocked",
    source_chunk_id: null,
    tenant_id: null,
    sub_tenant_id: null,
    policy_version: null,
    risk_reason: "Blocked unsafe action before it reached the agent.",
  };
}

/** Synthetic evidence-report node injected for the blocked story. */
function reportNode(): GraphNode {
  return {
    id: "evidence_report",
    label: "Evidence Report",
    type: "report",
    trust: "trusted",
    status: "generated",
    source_chunk_id: null,
    tenant_id: null,
    sub_tenant_id: null,
    policy_version: null,
    risk_reason: null,
  };
}

interface LayoutResult {
  nodes: PositionedNode[];
  edges: PositionedEdge[];
  injected: boolean;
}

/**
 * Build positioned React Flow nodes + edges from a backend graph. Lays out by
 * role column (left to right), stacking nodes that share a column. When the
 * firewall blocked, a firewall node and report node are appended on the right
 * and wired from the unsafe action(s) so the hero shows interception.
 */
export function buildFlowGraph(graph: Graph, firewall: Firewall): LayoutResult {
  const blocked = firewall.decision === "block" ||
    firewall.decision === "quarantine" ||
    firewall.decision === "require_human_review";

  const baseNodes = [...graph.nodes];
  const unsafeIds = baseNodes
    .filter((n) => classifyRole(n) === "unsafe_tool_action")
    .map((n) => n.id);

  const injected = blocked && unsafeIds.length > 0;
  const allNodes = injected
    ? [...baseNodes, firewallNode(), reportNode()]
    : baseNodes;

  // Group nodes by column, then assign stacked rows within each column.
  const columns = new Map<number, GraphNode[]>();
  for (const node of allNodes) {
    const col = ROLE_COLUMN[classifyRole(node)];
    const bucket = columns.get(col) ?? [];
    bucket.push(node);
    columns.set(col, bucket);
  }

  const positioned: PositionedNode[] = [];
  for (const [col, bucket] of [...columns.entries()].sort((a, b) => a[0] - b[0])) {
    const colHeight = (bucket.length - 1) * ROW_HEIGHT;
    bucket.forEach((node, row) => {
      const role = classifyRole(node);
      positioned.push({
        id: node.id,
        type: "hydra",
        position: {
          x: ORIGIN_X + col * COLUMN_WIDTH,
          y: ORIGIN_Y + row * ROW_HEIGHT - colHeight / 2 + 220,
        },
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        sourcePosition: "right",
        targetPosition: "left",
        handles: nodeHandles(),
        data: {
          node,
          role,
          tainted: isTaintedNode(node),
          blocked: role === "mcp_firewall" && blocked,
        },
      });
    });
  }

  const edges: PositionedEdge[] = graph.edges.map((edge: GraphEdge, i) => ({
    id: `e_${edge.source}__${edge.target}__${i}`,
    source: edge.source,
    target: edge.target,
    label: edgeLabel(edge),
    type: "hydra",
    data: { tainted: Boolean(edge.tainted), blocked: false },
  }));

  if (injected) {
    for (const unsafeId of unsafeIds) {
      edges.push({
        id: `e_${unsafeId}__mcp_firewall`,
        source: unsafeId,
        target: "mcp_firewall",
        label: "intercepted",
        type: "hydra",
        data: { tainted: true, blocked: true },
      });
    }
    edges.push({
      id: "e_mcp_firewall__report",
      source: "mcp_firewall",
      target: "evidence_report",
      label: "emits",
      type: "hydra",
      data: { tainted: false, blocked: false },
    });
  }

  return { nodes: positioned, edges, injected };
}
