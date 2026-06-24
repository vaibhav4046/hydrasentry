"""Build a context graph from a HydraDB query result or a scenario fallback.

If the query result carries non-empty real ``query_paths``, the graph is built
from those triplets and labelled source="real_query_paths". Otherwise a
canonical 8-node graph is derived from the scenario fixture and labelled
source="derived_scenario_graph" so the UI can never mistake derived data for
real HydraDB evidence.
"""
from __future__ import annotations

import logging
from typing import Any, Optional

logger = logging.getLogger("hydrasentry.graph_extractor")

REAL = "real_query_paths"
DERIVED = "derived_scenario_graph"

# The canonical derived graph node ids, in flow order.
CANONICAL_NODES = [
    "user_task", "clean_policy", "poisoned_memory", "query_path",
    "policy_conflict", "unsafe_tool_action", "mcp_firewall", "report",
]


def _trust_status(trust: str) -> str:
    return "tainted" if trust in ("poisoned", "stale") else "clean"


def _poison_chunk(scenario: dict[str, Any]) -> Optional[dict[str, Any]]:
    for chunk in scenario.get("poison_context", []):
        if chunk.get("trust") in ("poisoned", "stale"):
            return chunk
    poison = scenario.get("poison_context", [])
    return poison[0] if poison else None


def _clean_policy_chunk(scenario: dict[str, Any]) -> Optional[dict[str, Any]]:
    for chunk in scenario.get("clean_context", []):
        if chunk.get("kind") == "policy":
            return chunk
    clean = scenario.get("clean_context", [])
    return clean[0] if clean else None


def _build_from_triplets(
    query_result: dict[str, Any], scenario: dict[str, Any], source_label: str
) -> dict[str, Any]:
    """Build nodes/edges from query_paths triplets, labelled with source_label.

    Used both for genuine HydraDB paths (REAL) and demo-adapter-derived paths
    (DERIVED): the triplets are concrete either way, but the label is honest
    about provenance so demo data is never presented as real.
    """
    graph_ctx = query_result.get("graph_context") or {}
    raw_paths = graph_ctx.get("query_paths") or query_result.get("query_paths") or []

    poison_ids = {
        c["chunk_id"] for c in scenario.get("poison_context", [])
        if c.get("trust") in ("poisoned", "stale")
    }

    def _is_poison_chunk(chunk_id: Optional[str]) -> bool:
        """Match a triplet's source_chunk_id to a poison chunk. Demo ids match
        exactly; real HydraDB suffixes chunk ids (``mem_poison_047_chunk_0000``)
        so we also accept a prefix match on the scenario poison id."""
        if not chunk_id:
            return False
        if chunk_id in poison_ids:
            return True
        return any(chunk_id.startswith(f"{pid}_") for pid in poison_ids)

    nodes: dict[str, dict[str, Any]] = {}
    edges: list[dict[str, Any]] = []
    query_paths: list[dict[str, Any]] = []
    tainted_path: list[str] = []

    def ensure_node(node_id: str, tainted: bool) -> None:
        if node_id not in nodes:
            nodes[node_id] = {
                "id": node_id,
                "label": node_id.replace("_", " "),
                "type": "entity",
                "trust": "poisoned" if tainted else "trusted",
                "status": "tainted" if tainted else "clean",
                "source_chunk_id": None,
                "tenant_id": scenario.get("tenant_id"),
                "sub_tenant_id": scenario.get("sub_tenant"),
                "policy_version": scenario.get("policy", {}).get("version"),
                "risk_reason": "derived from poisoned source chunk" if tainted else None,
            }

    for triplet in raw_paths:
        source = triplet.get("source") or triplet.get("from") or triplet.get("subject")
        target = triplet.get("target") or triplet.get("to") or triplet.get("object")
        relation = triplet.get("relation") or triplet.get("predicate") or "related_to"
        chunk_id = triplet.get("source_chunk_id") or triplet.get("chunk_id")
        tainted = bool(triplet.get("tainted")) or _is_poison_chunk(chunk_id)
        if not source or not target:
            continue
        ensure_node(source, tainted)
        ensure_node(target, tainted)
        if tainted:
            nodes[source]["source_chunk_id"] = chunk_id
        edges.append({
            "source": source, "target": target, "relation": relation,
            "source_chunk_id": chunk_id, "tainted": tainted,
        })
        query_paths.append({
            "source": source, "relation": relation, "target": target,
            "source_chunk_id": chunk_id, "tainted": tainted,
        })
        if tainted:
            for n in (source, target):
                if n not in tainted_path:
                    tainted_path.append(n)

    logger.info("graph source=%s nodes=%d edges=%d", source_label, len(nodes), len(edges))
    return {
        "source": source_label,
        "nodes": list(nodes.values()),
        "edges": edges,
        "query_paths": query_paths,
        "tainted_path": tainted_path,
    }


def _build_derived_graph(scenario: dict[str, Any]) -> dict[str, Any]:
    """Build the canonical 8-node derived graph from the scenario fixture."""
    poison = _poison_chunk(scenario)
    policy = _clean_policy_chunk(scenario)
    poison_id = poison["chunk_id"] if poison else "poison"
    policy_id = policy["chunk_id"] if policy else "policy"
    tenant = scenario.get("tenant_id")
    sub = scenario.get("sub_tenant")
    pver = scenario.get("policy", {}).get("version")
    attack = scenario.get("attack_type", "unknown")

    def node(node_id: str, label: str, ntype: str, tainted: bool,
             chunk_id: Optional[str], reason: Optional[str]) -> dict[str, Any]:
        return {
            "id": node_id, "label": label, "type": ntype,
            "trust": "poisoned" if tainted else "trusted",
            "status": "tainted" if tainted else "clean",
            "source_chunk_id": chunk_id,
            "tenant_id": tenant, "sub_tenant_id": sub,
            "policy_version": pver,
            "risk_reason": reason,
        }

    nodes = [
        node("user_task", scenario.get("task", "user task"), "task", False, None, None),
        node("clean_policy", policy["text"] if policy else "clean policy", "policy",
             False, policy_id, None),
        node("poisoned_memory", poison["text"] if poison else "poisoned source", "memory",
             True, poison_id, f"untrusted {poison['trust'] if poison else 'poison'} source chunk"),
        node("query_path", "HydraDB retrieval path", "query", True, poison_id,
             "retrieval traversed the poisoned chunk"),
        node("policy_conflict", "poison vs current policy", "conflict", True, poison_id,
             "poisoned source contradicts the approved policy"),
        node("unsafe_tool_action", scenario.get("forbidden_behavior", "unsafe action"),
             "action", True, poison_id, "action driven by poisoned context"),
        node("mcp_firewall", "HydraSentry context firewall", "control", False, None,
             "evaluates and blocks the tainted path"),
        node("report", "HydraSentry finding report", "artifact", False, None, None),
    ]

    edges_spec = [
        ("user_task", "retrieves", "query_path", False, None),
        ("clean_policy", "should_govern", "user_task", False, policy_id),
        ("poisoned_memory", "injected_into", "query_path", True, poison_id),
        ("query_path", "surfaces", "policy_conflict", True, poison_id),
        ("policy_conflict", "drives", "unsafe_tool_action", True, poison_id),
        ("poisoned_memory", "overrides", "clean_policy", True, poison_id),
        ("unsafe_tool_action", "intercepted_by", "mcp_firewall", False, None),
        ("mcp_firewall", "emits", "report", False, None),
    ]
    edges = [
        {"source": s, "relation": rel, "target": t, "tainted": tainted, "source_chunk_id": cid}
        for (s, rel, t, tainted, cid) in edges_spec
    ]

    # query_paths triplets reflect the tainted retrieval chain.
    query_paths = [
        {"source": "poisoned_memory", "relation": "injected_into", "target": "query_path",
         "source_chunk_id": poison_id, "tainted": True},
        {"source": "query_path", "relation": "surfaces", "target": "policy_conflict",
         "source_chunk_id": poison_id, "tainted": True},
        {"source": "policy_conflict", "relation": "drives", "target": "unsafe_tool_action",
         "source_chunk_id": poison_id, "tainted": True},
    ]

    tainted_path = [
        "poisoned_memory", "query_path", "policy_conflict", "unsafe_tool_action",
    ]

    logger.info("graph source=%s attack=%s nodes=%d", DERIVED, attack, len(nodes))
    return {
        "source": DERIVED,
        "nodes": nodes,
        "edges": edges,
        "query_paths": query_paths,
        "tainted_path": tainted_path,
    }


def build_graph(query_result: Optional[dict[str, Any]], scenario: dict[str, Any]) -> dict[str, Any]:
    """Build a graph from query_paths when present, labelled by provenance.

    - Genuine HydraDB result with paths -> source="real_query_paths".
    - Demo-adapter result with derived paths -> source="derived_scenario_graph"
      (rich triplet graph, but honestly labelled as derived).
    - No paths at all -> canonical 8-node derived fallback.
    """
    if query_result:
        graph_ctx = query_result.get("graph_context") or {}
        raw_paths = graph_ctx.get("query_paths") or query_result.get("query_paths") or []
        if raw_paths:
            is_real = bool(query_result.get("real")) and not query_result.get("demo")
            source_label = REAL if is_real else DERIVED
            return _build_from_triplets(query_result, scenario, source_label)
    return _build_derived_graph(scenario)
