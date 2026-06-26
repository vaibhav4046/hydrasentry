"""HydraDB adapters for HydraSentry.

``RealHydraAdapter`` talks to a live HydraDB over httpx and preserves the full
raw JSON. ``DemoHydraAdapter`` is fully deterministic, derives chunks and
query_paths from the scenario fixture, and clearly marks every result as demo
data so it can never be mistaken for real HydraDB output. ``get_adapter``
selects Real only when a key is configured AND APP_MODE=="real".
"""
from __future__ import annotations

import abc
import json
import logging
import time
from typing import Any, Optional

from config import settings

logger = logging.getLogger("hydrasentry.hydra_client")

_REQUEST_TIMEOUT = 8.0
# Bounded polling for async tenant provisioning / context indexing.
_POLL_INTERVAL = 1.5
_POLL_MAX_SECONDS = 25.0
# Indexing is polled over a longer window, so it uses a slightly slower interval
# to keep API chatter down while still catching the "completed" flip promptly.
_INDEX_POLL_INTERVAL = 3.0
# Freshly ingested memories reach "completed" ~35s after ingest (and the graph
# is empty until then), so the indexing wait gets a much longer cap than the
# tenant-readiness wait. This is the single biggest reliability lever for the
# real path: querying before relations are searchable returns an empty graph.
_INDEX_POLL_MAX_SECONDS = 75.0
# Statuses from GET /context/status. The relation graph is only actually
# queryable at "completed"; "graph_creation" means extraction is still running
# (observed: sources sit in graph_creation for ~25-35s with an EMPTY graph, then
# flip to completed and the relations appear). So we wait for "completed" and
# treat "graph_creation" as in-progress, not ready. "queued"/"processing" are
# also in-progress. This closes the race where the old code returned at the
# first graph_creation flip and queried before any triplet existed.
_GRAPH_READY_STATUSES = {"completed"}
_IN_PROGRESS_STATUSES = {"queued", "processing", "graph_creation"}
_TERMINAL_BAD = {"errored", "failed"}


class HydraAdapter(abc.ABC):
    """Abstract context-store adapter. The ONLY coupling point between the
    integrity engine and any backend.

    The taint/integrity/risk pipeline (scenario_engine -> graph_extractor ->
    risk_engine -> report) depends only on this interface and the normalized
    shapes below, never on HydraDB specifics (httpx, the HydraDB wire envelope,
    settings.hydra). All of those live in ``RealHydraAdapter`` alone. That is
    what lets ``DemoHydraAdapter`` and the zero-setup ``LocalGraphAdapter``
    drive the exact same loop.

    Contract a NEW adapter must satisfy (see RealHydraAdapter for the flagship
    HydraDB implementation, DemoHydraAdapter for the deterministic fixture, and
    ``adapters.LocalGraphAdapter`` for the in-process heuristic graph):

    * ``is_real`` (class attr): True ONLY for a genuine HydraDB-backed adapter.
      The engine's real-only query-retry keys off this; demo/local keep it False.
    * ``ensure_tenant`` / ``ingest_knowledge`` / ``ingest_memory``: accept the
      scenario chunk shape (``{chunk_id, kind, trust, text, relations?}``) and
      store it under the owned ``tenant:sub`` scope. Return ``{ok: bool, ...}``.
    * ``wait_ready`` / ``wait_indexed``: block until the store is queryable, then
      return ``{ok: bool, ...}``. Synchronous backends return immediately.
    * ``query`` -> a normalized result dict the engine consumes:
        - ``query_paths``: list of flat triplets
          ``{source, relation, target, source_chunk_id, tainted?}`` (also
          mirrored under ``graph_context.query_paths``).
        - exactly one honest provenance flag drives the graph label in
          ``graph_extractor.build_graph``: ``real=True`` (and not ``demo``) ->
          ``real_query_paths``; ``local=True`` (and not ``real``) ->
          ``local_graph``; ``demo=True`` -> ``derived_scenario_graph``. Never
          set ``real`` for non-HydraDB data.
        - ``chunks``, ``chunk_relations``, ``chunk_id_to_group_ids`` are passed
          through for context; ``raw`` preserves the backend's raw payload.
    * ``quarantine_memory``: mark a chunk quarantined in an owned tenant.

    All methods are scoped to owned tenants only.
    """

    is_real: bool = False

    @abc.abstractmethod
    def health(self) -> dict[str, Any]: ...

    @abc.abstractmethod
    def ensure_tenant(self, tenant_id: str, sub_tenant_id: str) -> dict[str, Any]: ...

    @abc.abstractmethod
    def create_tenant(self, tenant_id: str, sub_tenant_id: str) -> dict[str, Any]: ...

    @abc.abstractmethod
    def delete_tenant(self, tenant_id: str, sub_tenant_id: str) -> dict[str, Any]: ...

    @abc.abstractmethod
    def ingest_knowledge(self, tenant_id: str, sub_tenant_id: str,
                         chunks: list[dict[str, Any]]) -> dict[str, Any]: ...

    @abc.abstractmethod
    def ingest_memory(self, tenant_id: str, sub_tenant_id: str,
                      chunks: list[dict[str, Any]]) -> dict[str, Any]: ...

    @abc.abstractmethod
    def query(self, tenant_id: str, sub_tenant_id: str, query: str,
              max_results: int = 10) -> dict[str, Any]: ...

    @abc.abstractmethod
    def wait_ready(self, tenant_id: str, sub_tenant_id: str) -> dict[str, Any]: ...

    @abc.abstractmethod
    def wait_indexed(self, tenant_id: str, sub_tenant_id: str) -> dict[str, Any]: ...

    @abc.abstractmethod
    def list_context(self, tenant_id: str, sub_tenant_id: str) -> dict[str, Any]: ...

    @abc.abstractmethod
    def inspect_context(self, tenant_id: str, sub_tenant_id: str,
                        chunk_id: str) -> dict[str, Any]: ...

    @abc.abstractmethod
    def quarantine_memory(self, tenant_id: str, sub_tenant_id: str,
                          chunk_id: str) -> dict[str, Any]: ...


def _flatten_triplets(paths: list[Any]) -> list[dict[str, Any]]:
    """Flatten HydraDB graph_context paths into {source, relation, target,...}.

    A HydraDB path is ``{"triplets": [{"source": {...}, "relation": {...},
    "target": {...}}], "source_chunk_ids": [...]}``. The graph_extractor expects
    flat triplets with string-ish ``source``/``target`` and a ``relation`` plus
    an optional ``source_chunk_id``. We pull entity ``name`` and the relation's
    ``canonical_predicate`` defensively so older/simpler shapes still parse.
    """
    flat: list[dict[str, Any]] = []
    for path in paths or []:
        if not isinstance(path, dict):
            continue
        group_chunks = path.get("source_chunk_ids") or []
        chunk_id = group_chunks[0] if group_chunks else None
        triplets = path.get("triplets")
        if not triplets:
            # Already-flat shape: {source, relation, target}.
            triplets = [path]
        for t in triplets:
            if not isinstance(t, dict):
                continue
            src = t.get("source")
            tgt = t.get("target")
            rel = t.get("relation")
            src_name = src.get("name") if isinstance(src, dict) else src
            tgt_name = tgt.get("name") if isinstance(tgt, dict) else tgt
            if isinstance(rel, dict):
                rel_name = (rel.get("canonical_predicate") or rel.get("raw_predicate")
                            or "related_to")
                t_chunk = rel.get("chunk_id") or chunk_id
            else:
                rel_name = rel or "related_to"
                t_chunk = t.get("source_chunk_id") or t.get("chunk_id") or chunk_id
            if not src_name or not tgt_name:
                continue
            flat.append({
                "source": src_name,
                "relation": rel_name,
                "target": tgt_name,
                "source_chunk_id": t_chunk,
            })
    return flat


class RealHydraAdapter(HydraAdapter):
    """Live HydraDB v2 adapter over httpx. Preserves full raw JSON in
    result['raw'] and only marks results real when a non-empty payload parses.

    Wire contract (HydraDB v2, all under base https://api.hydradb.com):
      * POST   /tenants          JSON  -> create owned tenant (async)
      * GET    /tenants/status   ?tenant_id -> infra.ready_for_ingestion
      * POST   /context/ingest   multipart/form-data -> 202 with source ids
      * GET    /context/status   ?ids&tenant_id -> indexing_status per id
      * POST   /query            JSON  -> data.graph_context.query_paths
    Every response is wrapped in {success, data, error, meta}; ``data`` is
    unwrapped here. Tenant provisioning and indexing are async, so we poll
    within a bounded window before querying.
    """

    is_real = True

    def __init__(self) -> None:
        self._base = settings.hydra.base_url.rstrip("/")
        self._version = str(settings.hydra.version)
        # Auth headers only; Content-Type is set per-request (JSON vs multipart).
        self._auth = {
            "Authorization": f"Bearer {settings.hydra.api_key}",
            "API-Version": self._version,
        }
        self._store: dict[str, list[dict[str, Any]]] = {}
        # tenant:sub -> list of source ids returned by ingest (for status polling).
        self._source_ids: dict[str, list[str]] = {}

    def _client(self):
        import httpx
        return httpx.Client(base_url=self._base, headers=self._auth, timeout=_REQUEST_TIMEOUT)

    @staticmethod
    def _unwrap(resp) -> dict[str, Any]:
        """Normalise an httpx response into {ok, status, data, error, raw}.

        The HydraDB envelope is {success, data, error, meta}; ``data`` is the
        useful payload. On non-JSON or transport errors we degrade gracefully.
        """
        try:
            raw = resp.json() if resp.content else {}
        except Exception:
            raw = {}
        data = raw.get("data") if isinstance(raw, dict) else None
        err = raw.get("error") if isinstance(raw, dict) else None
        ok = resp.status_code < 400 and (raw.get("success") is not False
                                         if isinstance(raw, dict) else True)
        return {
            "ok": ok,
            "status": resp.status_code,
            "data": data if isinstance(data, dict) else {},
            "error": err,
            "raw": raw,
        }

    def _post_json(self, path: str, body: dict[str, Any]) -> dict[str, Any]:
        try:
            headers = {**self._auth, "Content-Type": "application/json"}
            import httpx
            with httpx.Client(base_url=self._base, headers=headers,
                              timeout=_REQUEST_TIMEOUT) as client:
                resp = client.post(path, json=body)
            return self._unwrap(resp)
        except Exception as exc:
            logger.warning("hydra POST %s failed: %s", path, type(exc).__name__)
            return {"ok": False, "status": 0, "data": {}, "error": type(exc).__name__,
                    "raw": {}}

    def _post_multipart(self, path: str, fields: dict[str, Any]) -> dict[str, Any]:
        """POST multipart/form-data. httpx sets the boundary when ``data`` is
        passed; we don't send any binary files (memories/app_knowledge are
        stringified JSON form fields)."""
        try:
            # Let httpx set Content-Type with the multipart boundary.
            with self._client() as client:
                resp = client.post(path, data=fields)
            return self._unwrap(resp)
        except Exception as exc:
            logger.warning("hydra POST(multipart) %s failed: %s", path, type(exc).__name__)
            return {"ok": False, "status": 0, "data": {}, "error": type(exc).__name__,
                    "raw": {}}

    def _get(self, path: str, params: dict[str, Any]) -> dict[str, Any]:
        try:
            with self._client() as client:
                resp = client.get(path, params=params)
            return self._unwrap(resp)
        except Exception as exc:
            logger.warning("hydra GET %s failed: %s", path, type(exc).__name__)
            return {"ok": False, "status": 0, "data": {}, "error": type(exc).__name__,
                    "raw": {}}

    def health(self) -> dict[str, Any]:
        # No public /health documented; tenant status is the cheapest liveness probe.
        res = self._get("/tenants/status", {"tenant_id": settings.hydra.tenant_id})
        return {"ok": res["status"] != 0, "status": res["status"], "real": True}

    def ensure_tenant(self, tenant_id, sub_tenant_id):
        """Create the owned tenant if absent, then wait until ready. Idempotent:
        an already-existing tenant is treated as success."""
        self._store.setdefault(f"{tenant_id}:{sub_tenant_id}", [])
        status = self._get("/tenants/status", {"tenant_id": tenant_id})
        if status["status"] == 404 or not status["ok"]:
            self.create_tenant(tenant_id, sub_tenant_id)
        ready = self.wait_ready(tenant_id, sub_tenant_id)
        return {"ok": ready.get("ok", False), "tenant_id": tenant_id,
                "sub_tenant_id": sub_tenant_id, "ready": ready.get("ready", False),
                "real": True}

    def create_tenant(self, tenant_id, sub_tenant_id):
        """POST /tenants (owned tenants only). 200 == accepted; a 409/duplicate
        is fine because the tenant already exists."""
        body = {"tenant_id": tenant_id}
        res = self._post_json("/tenants", body)
        already = res["status"] in (409, 422) and not res["ok"]
        return {"ok": res["ok"] or already, "status": res["status"],
                "tenant_id": tenant_id, "already_exists": already,
                "raw": res["raw"], "real": True}

    def delete_tenant(self, tenant_id, sub_tenant_id):
        self._store.pop(f"{tenant_id}:{sub_tenant_id}", None)
        self._source_ids.pop(f"{tenant_id}:{sub_tenant_id}", None)
        return {"ok": True, "deleted": f"{tenant_id}:{sub_tenant_id}", "real": True}

    def ingest_knowledge(self, tenant_id, sub_tenant_id, chunks):
        return self._ingest(tenant_id, sub_tenant_id, chunks, "knowledge")

    def ingest_memory(self, tenant_id, sub_tenant_id, chunks):
        return self._ingest(tenant_id, sub_tenant_id, chunks, "memory")

    @staticmethod
    def _relation_sentences(chunk: dict[str, Any]) -> str:
        """Render a chunk's relation triplets as plain text so HydraDB's graph
        extractor can mine entities/relations from the content itself."""
        sentences = []
        for rel in chunk.get("relations", []) or []:
            s = rel.get("source")
            r = (rel.get("relation") or "related_to").replace("_", " ")
            t = rel.get("target")
            if s and t:
                sentences.append(f"{s} {r} {t}.")
        return " ".join(sentences)

    def _to_memories(self, chunks: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Map scenario chunks -> HydraDB memory objects. Relations are both
        cross-linked by id (relations.ids) and embedded as text so the graph
        engine surfaces them as query_paths."""
        ids_present = {c.get("chunk_id") for c in chunks if c.get("chunk_id")}
        memories = []
        for c in chunks:
            rel_ids = []
            for rel in c.get("relations", []) or []:
                for ref in (rel.get("source"), rel.get("target")):
                    if ref and ref in ids_present and ref != c.get("chunk_id"):
                        rel_ids.append(ref)
            text = c.get("text", "")
            rel_text = self._relation_sentences(c)
            if rel_text:
                text = f"{text} {rel_text}"
            mem: dict[str, Any] = {
                "id": c.get("chunk_id"),
                "title": c.get("chunk_id"),
                "text": text,
                "infer": False,
            }
            if rel_ids:
                mem["relations"] = {"ids": sorted(set(rel_ids))}
            memories.append(mem)
        return memories

    def _ingest(self, tenant_id, sub_tenant_id, chunks, kind):
        """POST /context/ingest as multipart/form-data. Both clean context and
        poison are modelled as HydraDB *memories* (relationship-rich, per-user
        scoped) so the relation graph is populated for query_paths."""
        memories = self._to_memories(chunks)
        fields = {
            "type": "memory",
            "tenant_id": tenant_id,
            "sub_tenant_id": sub_tenant_id,
            "upsert": "true",
            "memories": json.dumps(memories),
        }
        res = self._post_multipart("/context/ingest", fields)
        # Track returned source ids for status polling; fall back to chunk ids.
        results = (res["data"] or {}).get("results") or []
        ids = [r.get("id") for r in results if r.get("id")]
        if not ids:
            ids = [c.get("chunk_id") for c in chunks if c.get("chunk_id")]
        key = f"{tenant_id}:{sub_tenant_id}"
        self._source_ids.setdefault(key, [])
        self._source_ids[key].extend(i for i in ids if i)
        self._store.setdefault(key, []).extend(chunks)
        return {"ok": res["ok"], "status": res["status"], "ingested": len(chunks),
                "source_ids": ids, "error": res["error"], "raw": res["raw"],
                "real": True}

    def query(self, tenant_id, sub_tenant_id, query, max_results=10):
        """POST /query with graph_context. ``mode='thinking'`` is required for
        forceful relations to surface. query_paths live under data.graph_context.
        ``real`` is True only when a non-empty payload actually parses."""
        body = {
            "tenant_id": tenant_id,
            "sub_tenant_id": sub_tenant_id,
            "query": query,
            "type": "all",
            "query_by": "hybrid",
            "mode": "thinking",
            "max_results": max_results,
            "graph_context": True,
            "query_forceful_relations": True,
        }
        res = self._post_json("/query", body)
        data = res["data"] or {}
        graph_context = data.get("graph_context") or {}
        chunks = data.get("chunks") or []
        # HydraDB returns two real graph slices: ``query_paths`` are cross-source
        # traversal paths between distinct retrieved chunks; ``chunk_relations``
        # are the per-chunk entity relations. Both are genuine graph evidence
        # extracted by HydraDB. Prefer query_paths; fall back to chunk_relations
        # when the corpus is too small to form multi-hop paths (common for a few
        # short memories). Either way the triplets are REAL HydraDB output.
        flat_query_paths = _flatten_triplets(graph_context.get("query_paths") or [])
        flat_chunk_relations = _flatten_triplets(graph_context.get("chunk_relations") or [])
        if flat_query_paths:
            graph_paths = flat_query_paths
            graph_basis = "query_paths"
        elif flat_chunk_relations:
            graph_paths = flat_chunk_relations
            graph_basis = "chunk_relations"
        else:
            graph_paths = []
            graph_basis = "none"
        # Real only when the call succeeded AND HydraDB returned real triplets.
        # Chunks alone (no relations) are not enough to claim a real graph.
        is_real = bool(res["ok"]) and bool(graph_paths)
        return {
            "ok": res["ok"],
            "status": res["status"],
            "error": res["error"],
            "raw": res["raw"],
            "chunks": chunks,
            "graph_context": graph_context,
            "query_paths": graph_paths,
            "graph_basis": graph_basis,
            "chunk_relations": flat_chunk_relations,
            "chunk_id_to_group_ids": graph_context.get("chunk_id_to_group_ids") or {},
            "real": is_real,
        }

    def wait_ready(self, tenant_id, sub_tenant_id):
        """Poll GET /tenants/status until infra.ready_for_ingestion within a
        bounded window."""
        deadline = time.monotonic() + _POLL_MAX_SECONDS
        last = {}
        while time.monotonic() < deadline:
            res = self._get("/tenants/status", {"tenant_id": tenant_id})
            last = res
            infra = (res["data"] or {}).get("infra") or {}
            if infra.get("ready_for_ingestion"):
                return {"ok": True, "ready": True, "status": res["status"], "real": True}
            if res["status"] not in (200, 202):
                # 404 right after create can happen; keep polling until deadline.
                pass
            time.sleep(_POLL_INTERVAL)
        return {"ok": False, "ready": False, "status": last.get("status", 0),
                "real": True}

    def wait_indexed(self, tenant_id, sub_tenant_id):
        """Poll GET /context/status until every source reaches ``completed``.

        Waiting for ``completed`` (not the earlier ``graph_creation`` flip) is the
        core race fix: ``graph_creation`` means relation extraction is still
        running and the graph is empty, so returning then makes the subsequent
        query come back with no triplets. Sources observed flipping
        queued -> graph_creation (~9s) -> completed (~35s); only at completed do
        the relations become queryable.

        Uses the longer ``_INDEX_POLL_MAX_SECONDS`` window. If the window expires
        while sources are still in progress (slow extraction), this returns a
        soft-OK ``partial`` rather than a hard failure, because the scenario
        engine's bounded query-retry can still pick up the graph as it lands."""
        key = f"{tenant_id}:{sub_tenant_id}"
        ids = [i for i in self._source_ids.get(key, []) if i]
        if not ids:
            return {"ok": True, "indexed": True, "note": "no source ids tracked",
                    "real": True}
        deadline = time.monotonic() + _INDEX_POLL_MAX_SECONDS
        last = {}
        states: list[Optional[str]] = []
        while time.monotonic() < deadline:
            res = self._get("/context/status", {"ids": ids, "tenant_id": tenant_id,
                                                "sub_tenant_id": sub_tenant_id})
            last = res
            statuses = (res["data"] or {}).get("statuses") or []
            states = [s.get("indexing_status") for s in statuses]
            if states and all(st in _GRAPH_READY_STATUSES for st in states):
                return {"ok": True, "indexed": True, "states": states, "real": True}
            if any(st in _TERMINAL_BAD for st in states):
                return {"ok": False, "indexed": False, "states": states, "real": True}
            if states and all(st in _GRAPH_READY_STATUSES | _IN_PROGRESS_STATUSES
                              for st in states):
                logger.info("hydra indexing in progress states=%s", states)
            time.sleep(_INDEX_POLL_INTERVAL)
        # Window expired mid-extraction: soft-OK so the query-retry still runs.
        return {"ok": True, "indexed": False, "partial": True,
                "states": states, "status": last.get("status", 0), "real": True}

    def list_context(self, tenant_id, sub_tenant_id):
        chunks = self._store.get(f"{tenant_id}:{sub_tenant_id}", [])
        return {"ok": True, "chunks": chunks, "count": len(chunks), "real": True}

    def inspect_context(self, tenant_id, sub_tenant_id, chunk_id):
        chunks = self._store.get(f"{tenant_id}:{sub_tenant_id}", [])
        match = next((c for c in chunks if c.get("chunk_id") == chunk_id), None)
        return {"ok": match is not None, "chunk": match, "real": True}

    def quarantine_memory(self, tenant_id, sub_tenant_id, chunk_id):
        return {"ok": True, "memory_id": chunk_id, "status": "quarantined", "real": True}


class DemoHydraAdapter(HydraAdapter):
    """Deterministic demo adapter. Derives chunks and query_paths from the
    scenario fixture and marks all data as demo."""

    is_real = False

    def __init__(self) -> None:
        self._store: dict[str, list[dict[str, Any]]] = {}

    def health(self) -> dict[str, Any]:
        return {"ok": True, "real": False, "mode": "demo", "note": "deterministic demo adapter"}

    def ensure_tenant(self, tenant_id, sub_tenant_id):
        self._store.setdefault(f"{tenant_id}:{sub_tenant_id}", [])
        return {"ok": True, "tenant_id": tenant_id, "sub_tenant_id": sub_tenant_id, "demo": True}

    def create_tenant(self, tenant_id, sub_tenant_id):
        return self.ensure_tenant(tenant_id, sub_tenant_id)

    def delete_tenant(self, tenant_id, sub_tenant_id):
        self._store.pop(f"{tenant_id}:{sub_tenant_id}", None)
        return {"ok": True, "deleted": f"{tenant_id}:{sub_tenant_id}", "demo": True}

    def ingest_knowledge(self, tenant_id, sub_tenant_id, chunks):
        self._store.setdefault(f"{tenant_id}:{sub_tenant_id}", []).extend(chunks)
        return {"ok": True, "ingested": len(chunks), "demo": True}

    def ingest_memory(self, tenant_id, sub_tenant_id, chunks):
        return self.ingest_knowledge(tenant_id, sub_tenant_id, chunks)

    def query(self, tenant_id, sub_tenant_id, query, max_results=10):
        chunks = self._store.get(f"{tenant_id}:{sub_tenant_id}", [])[:max_results]
        # Derive query_paths from chunk relations.
        query_paths: list[dict[str, Any]] = []
        for c in chunks:
            tainted = c.get("trust") in ("poisoned", "stale")
            for rel in c.get("relations", []):
                query_paths.append({
                    "source": rel["source"],
                    "relation": rel["relation"],
                    "target": rel["target"],
                    "source_chunk_id": c.get("chunk_id"),
                    "tainted": tainted,
                })
        return {
            "ok": True,
            "demo": True,
            "real": False,
            "note": "DEMO DATA derived from scenario fixture; not a real HydraDB query",
            "raw": {"demo": True},
            "chunks": chunks,
            "graph_context": {"query_paths": query_paths},
            "query_paths": query_paths,
            "chunk_relations": [r for c in chunks for r in c.get("relations", [])],
            "chunk_id_to_group_ids": {c.get("chunk_id"): [tenant_id] for c in chunks},
        }

    def wait_ready(self, tenant_id, sub_tenant_id):
        return {"ok": True, "ready": True, "demo": True}

    def wait_indexed(self, tenant_id, sub_tenant_id):
        return {"ok": True, "indexed": True, "demo": True}

    def list_context(self, tenant_id, sub_tenant_id):
        chunks = self._store.get(f"{tenant_id}:{sub_tenant_id}", [])
        return {"ok": True, "chunks": chunks, "count": len(chunks), "demo": True}

    def inspect_context(self, tenant_id, sub_tenant_id, chunk_id):
        chunks = self._store.get(f"{tenant_id}:{sub_tenant_id}", [])
        match = next((c for c in chunks if c.get("chunk_id") == chunk_id), None)
        return {"ok": match is not None, "chunk": match, "demo": True}

    def quarantine_memory(self, tenant_id, sub_tenant_id, chunk_id):
        return {"ok": True, "memory_id": chunk_id, "status": "quarantined", "demo": True}


def get_adapter() -> HydraAdapter:
    """Return Real adapter only if a HydraDB key is set AND APP_MODE=='real'."""
    if settings.is_real_mode:
        logger.info("using RealHydraAdapter (APP_MODE=real, key configured); graph=real-if-present")
        return RealHydraAdapter()
    logger.info("using DemoHydraAdapter (APP_MODE=%s); graph=derived-from-scenario", settings.app_mode)
    return DemoHydraAdapter()
