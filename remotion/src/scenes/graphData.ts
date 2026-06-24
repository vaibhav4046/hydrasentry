import { GraphNode, GraphEdge } from "../lib/GraphMini";

// Shared memory-graph layout reused across scenes 1-4 so the "tree" feels
// like one continuous artifact that gets poisoned over time.
// Coordinate space: 900 x 600 (matches GraphMini default viewBox).

export const ROOT_ID = "agent_memory";
export const POISON_ID = "mem_poison_047";

export const BASE_NODES: GraphNode[] = [
  { id: ROOT_ID, x: 450, y: 300, label: "agent_memory", kind: "root" },
  { id: "refund_policy", x: 250, y: 170, label: "refund_policy" },
  { id: "customer_tier", x: 700, y: 165, label: "customer_tier" },
  { id: "approval_rule", x: 690, y: 440, label: "approval_rule" },
  { id: "ticket_4471", x: 240, y: 450, label: "ticket_4471" },
  { id: "vip_flag", x: 500, y: 95, label: "vip_flag" },
];

export const BASE_EDGES: GraphEdge[] = [
  { from: ROOT_ID, to: "refund_policy" },
  { from: ROOT_ID, to: "customer_tier" },
  { from: ROOT_ID, to: "approval_rule" },
  { from: ROOT_ID, to: "ticket_4471" },
  { from: "customer_tier", to: "vip_flag" },
];

// Poison node + tainted wiring introduced in scene 3.
export const POISON_NODE: GraphNode = {
  id: POISON_ID,
  x: 150,
  y: 310,
  label: "mem_poison_047",
  kind: "poison",
};

export const POISON_EDGES: GraphEdge[] = [
  { from: POISON_ID, to: "refund_policy", tainted: true },
  { from: "refund_policy", to: ROOT_ID, tainted: true },
  { from: ROOT_ID, to: "approval_rule", tainted: true },
];
