"""LocalGraphAdapter: a zero-setup HydraAdapter implementation.

This adapter lets anyone run the full Constellan pipeline (ingest memories ->
build a relation graph -> detect a poisoned memory -> trace the taint path ->
score risk) on their OWN data WITHOUT a HydraDB account, key, or network call.
It builds a real relation graph IN-PROCESS from the user-provided memory texts
using the transparent heuristic in ``local_extractor`` and flows through the
exact same scenario engine -> graph_extractor -> risk path as the Real and Demo
adapters.

Honest labeling (non-negotiable): the graph this produces is a LOCAL HEURISTIC
GRAPH, not real HydraDB output. Its query results carry ``local: True`` and
never ``real: True`` or ``demo: True``, so ``graph_extractor`` labels the graph
``local_graph`` -- a third honest provenance alongside ``real_query_paths`` and
``derived_scenario_graph``. It is additive: it does not touch the Real or Demo
adapters or the canonical judge demo.
"""
from __future__ import annotations

import logging
from typing import Any

from hydra_client import HydraAdapter

from . import local_extractor

logger = logging.getLogger("hydrasentry.local_adapter")

# Honest provenance marker carried on every query result from this adapter.
LOCAL_GRAPH_SOURCE = "local_graph"


class LocalGraphAdapter(HydraAdapter):
    """In-process relation-graph adapter. No network, no keys, no accounts.

    Implements the full ``HydraAdapter`` contract so the scenario engine treats
    it like any other backend. Memories are stored per ``tenant:sub`` key and
    the relation graph is mined on ``query`` from the stored texts. Results are
    honestly labelled ``local`` (never ``real``/``demo``).
    """

    # Not real HydraDB. The engine's real-only query-retry must never trigger
    # for this adapter, so is_real stays False.
    is_real = False

    def __init__(self) -> None:
        self._store: dict[tuple[str, str], list[dict[str, Any]]] = {}

    def _key(self, tenant_id: str, sub_tenant_id: str) -> tuple[str, str]:
        # A tuple key cannot collide the way a ``f"{t}:{s}"`` string could
        # (e.g. ("a:b","c") vs ("a","b:c")), so distinct tenant/sub pairs always
        # map to distinct stores even if a colon appears in an id.
        return (tenant_id, sub_tenant_id)

    def health(self) -> dict[str, Any]:
        return {
            "ok": True,
            "real": False,
            "local": True,
            "mode": "local",
            "note": "in-process local heuristic graph adapter (no HydraDB)",
        }

    def ensure_tenant(self, tenant_id, sub_tenant_id):
        self._store.setdefault(self._key(tenant_id, sub_tenant_id), [])
        return {"ok": True, "tenant_id": tenant_id,
                "sub_tenant_id": sub_tenant_id, "local": True}

    def create_tenant(self, tenant_id, sub_tenant_id):
        return self.ensure_tenant(tenant_id, sub_tenant_id)

    def delete_tenant(self, tenant_id, sub_tenant_id):
        self._store.pop(self._key(tenant_id, sub_tenant_id), None)
        return {"ok": True, "deleted": f"{tenant_id}:{sub_tenant_id}",
                "local": True}

    def ingest_knowledge(self, tenant_id, sub_tenant_id, chunks):
        self._store.setdefault(self._key(tenant_id, sub_tenant_id), []).extend(chunks)
        return {"ok": True, "ingested": len(chunks), "local": True}

    def ingest_memory(self, tenant_id, sub_tenant_id, chunks):
        return self.ingest_knowledge(tenant_id, sub_tenant_id, chunks)

    def query(self, tenant_id, sub_tenant_id, query, max_results=10):
        """Mine a local relation graph from the stored memory texts.

        Returns the same envelope shape the Real/Demo adapters return, but
        honestly marked ``local`` (and pointedly NOT ``real``/``demo``).
        ``query_paths`` are the heuristic triplets; ``graph_source`` records
        the provenance so ``graph_extractor`` can label it ``local_graph``.
        """
        chunks = self._store.get(self._key(tenant_id, sub_tenant_id), [])[:max_results]
        query_paths = local_extractor.extract_paths(chunks)
        chunk_relations = [r for c in chunks for r in (c.get("relations") or [])]
        return {
            "ok": True,
            "local": True,
            "real": False,
            "note": ("LOCAL HEURISTIC GRAPH built in-process from memory texts; "
                     "NOT a real HydraDB query"),
            "raw": {"local": True, "source": LOCAL_GRAPH_SOURCE},
            "chunks": chunks,
            "graph_context": {"query_paths": query_paths},
            "query_paths": query_paths,
            "graph_basis": LOCAL_GRAPH_SOURCE,
            "graph_source": LOCAL_GRAPH_SOURCE,
            "chunk_relations": chunk_relations,
            "chunk_id_to_group_ids": {
                c.get("chunk_id"): [tenant_id] for c in chunks if c.get("chunk_id")
            },
        }

    def wait_ready(self, tenant_id, sub_tenant_id):
        return {"ok": True, "ready": True, "local": True}

    def wait_indexed(self, tenant_id, sub_tenant_id):
        # No async indexing: the in-process graph is queryable immediately.
        return {"ok": True, "indexed": True, "local": True}

    def list_context(self, tenant_id, sub_tenant_id):
        chunks = self._store.get(self._key(tenant_id, sub_tenant_id), [])
        return {"ok": True, "chunks": chunks, "count": len(chunks), "local": True}

    def inspect_context(self, tenant_id, sub_tenant_id, chunk_id):
        chunks = self._store.get(self._key(tenant_id, sub_tenant_id), [])
        match = next((c for c in chunks if c.get("chunk_id") == chunk_id), None)
        return {"ok": match is not None, "chunk": match, "local": True}

    def quarantine_memory(self, tenant_id, sub_tenant_id, chunk_id):
        return {"ok": True, "memory_id": chunk_id, "status": "quarantined",
                "local": True}
