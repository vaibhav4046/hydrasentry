/**
 * Adapter from a backend `GraphNode` (React Flow / raw graph) to the
 * `InspectorNode` shape the shared NodeInspectorPreview consumes. Keeps the
 * artifact-tree inspector and the React Flow inspector on ONE design language:
 * both feed NodeInspectorPreview the same fields, so a click in either view
 * opens the identical slide-in panel.
 */
import type { GraphNode } from "./types";
import type { InspectorNode } from "@/components/noir/NodeInspectorPreview";

/** Convert a raw run-graph node into the inspector preview's node shape. */
export function toInspectorNode(node: GraphNode): InspectorNode {
  return {
    id: node.id,
    title: node.label.toUpperCase(),
    type: node.type,
    sourceChunkId: node.source_chunk_id,
    tenant: node.tenant_id,
    subTenant: node.sub_tenant_id,
    // Raw graph nodes carry no relevancy score; the artifact tree supplies it.
    relevancy: null,
    status: node.status,
    riskReason: node.risk_reason,
    tainted: node.trust === "poisoned",
  };
}
