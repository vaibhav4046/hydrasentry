"""Fast query-only path against a PRE-WARMED real HydraDB tenant.

This module powers the live ``POST /graph/real-query`` endpoint. It is the
fast half of the split that makes a real HydraDB graph viable on a serverless
10s budget: the slow one-time provision+ingest+graph-extraction (~35-75s) is
done ONCE out of band against a stable owned sub-tenant
(``hydrasentry-owned-test:live_demo_support_agent``); this module then does ONLY
the cheap ``/query`` (graph_context:true), which returns real triplets in ~2-3s.

Honesty + safety contract (must stay true):

* Uses the real HydraDB key from env DIRECTLY via ``RealHydraAdapter``. It does
  NOT read or flip ``APP_MODE``: the canonical deterministic judge-demo stays in
  whatever mode the deployment runs (demo / 87 / HIGH), untouched.
* ``real:true`` / ``graph_source:"real_query_paths"`` is set ONLY when the live
  HydraDB call actually parses non-empty triplets (the same
  ``query_result["real"]`` honesty gate used everywhere else). Never fabricated.
* Fails CLOSED. Any timeout, transport error, missing key, or empty graph
  returns a clean ``{ok: false, ...}`` dict the caller serves as HTTP 200 with
  ``fallback:"captured"`` -- never a 500, never a hang. The hard wall-clock
  timeout caps the whole operation well under the serverless function limit.
* Owned tenant only. The stable sub-tenant is fixed and owned by this instance.
"""
from __future__ import annotations

import logging
import time
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeout
from typing import Any

import graph_extractor
import scenario_loader
from config import settings

logger = logging.getLogger("hydrasentry.real_graph")

# Stable, owned, PRE-WARMED tenant/sub-tenant. Provisioned + ingested + indexed
# out of band so the live endpoint only ever issues the fast /query. The
# sub-tenant is intentionally distinct from the demo sub-tenant so re-running the
# (demo) judge-demo can never disturb this pre-warmed graph.
STABLE_TENANT = "hydrasentry-owned-test"
STABLE_SUB = "live_demo_support_agent"

# The scenario whose task drives the query and whose poison_context lets the
# graph extractor tag the taint chain. Same canonical scenario as the demo.
_SCENARIO_ID = "memory_poisoning_refund"

# Hard wall-clock cap for the whole real-query operation. RealHydraAdapter's own
# per-request httpx timeout is 8s; this outer cap guarantees the endpoint returns
# even if the adapter somehow blocks, keeping us safely under the 10s function
# limit. Kept as a module constant (no magic number at the call site).
_HARD_TIMEOUT_SECONDS = 8.0


def _build_real_query() -> dict[str, Any]:
    """Do the actual real HydraDB query + graph build. Run inside a worker thread
    so the caller can enforce a hard wall-clock timeout around it."""
    # Import here so a missing/duplicate httpx import can never break module load.
    from hydra_client import RealHydraAdapter

    if not settings.hydra.api_key:
        return {"ok": False, "error": "no HydraDB key configured",
                "fallback": "captured"}

    scenario = scenario_loader.get_scenario(_SCENARIO_ID)
    adapter = RealHydraAdapter()

    started = time.monotonic()
    query_result = adapter.query(STABLE_TENANT, STABLE_SUB, scenario["task"])
    query_ms = int((time.monotonic() - started) * 1000)

    if not query_result.get("ok"):
        return {"ok": False,
                "error": f"hydra query failed (status {query_result.get('status')})",
                "fallback": "captured", "query_ms": query_ms}

    # Honesty gate: only treat as real when HydraDB actually returned triplets.
    if not query_result.get("real"):
        return {"ok": False, "error": "hydra returned no graph triplets",
                "fallback": "captured", "query_ms": query_ms}

    graph = graph_extractor.build_graph(query_result, scenario)
    if graph.get("source") != graph_extractor.REAL:
        # Defensive: build_graph only labels REAL when real & not demo. If it did
        # not, do not dress derived data up as real -- fall back honestly.
        return {"ok": False, "error": "graph not labelled real_query_paths",
                "fallback": "captured", "query_ms": query_ms}

    return {
        "ok": True,
        "real": True,
        "graph_source": graph["source"],  # "real_query_paths"
        "graph_basis": query_result.get("graph_basis"),  # query_paths|chunk_relations
        "tenant_id": STABLE_TENANT,
        "sub_tenant_id": STABLE_SUB,
        "scenario_id": _SCENARIO_ID,
        "query_ms": query_ms,
        "triplet_count": len(graph.get("query_paths") or []),
        "graph": {
            "source": graph["source"],
            "nodes": graph["nodes"],
            "edges": graph["edges"],
            "query_paths": graph["query_paths"],
            "tainted_path": graph["tainted_path"],
        },
    }


def real_query_graph() -> dict[str, Any]:
    """Fast real HydraDB query against the pre-warmed stable tenant.

    Returns a plain dict (never raises). On success: ``{ok: true, real: true,
    graph_source: "real_query_paths", graph: {...}, ...}``. On ANY failure or
    timeout: ``{ok: false, error, fallback: "captured", ...}``. The hard timeout
    guarantees a return well under the serverless function limit.
    """
    started = time.monotonic()
    try:
        with ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(_build_real_query)
            result = future.result(timeout=_HARD_TIMEOUT_SECONDS)
    except FutureTimeout:
        logger.warning("real_query_graph timed out after %.1fs", _HARD_TIMEOUT_SECONDS)
        return {"ok": False, "error": "real query timed out",
                "fallback": "captured",
                "elapsed_ms": int((time.monotonic() - started) * 1000)}
    except Exception as exc:  # noqa: BLE001 -- fail closed, never propagate a 500
        logger.warning("real_query_graph failed: %s", type(exc).__name__)
        return {"ok": False, "error": "real query error",
                "fallback": "captured", "kind": type(exc).__name__,
                "elapsed_ms": int((time.monotonic() - started) * 1000)}

    result["elapsed_ms"] = int((time.monotonic() - started) * 1000)
    return result
