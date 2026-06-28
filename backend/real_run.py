"""Genuinely-real run pipeline for HydraSentry: ``POST /runs/real``.

This is the real product, not the deterministic demo. Within a hard ~9s
wall-clock budget (so it fits the Vercel 10s function limit) it:

1. Queries TWO pre-warmed, owned HydraDB sub-tenants in parallel for the
   refund task: a CLEAN one (policy context, no poison) and the existing
   POISONED one (policy context + the injected ``mem_poison_047`` memory).
   Both return genuine HydraDB ``query_paths``/``chunk_relations`` triplets.
2. Runs the REAL Groq agent on each context IN PARALLEL: a baseline answer
   from the clean context and a poisoned answer from the poisoned context.
   Both answers are LLM-generated, never scenario strings.
3. Scores with the REAL risk engine: deterministic rules over the actual
   answers PLUS a real Groq judge score (computed, never ``HARD_FAIL_SCORES``).
   The graph is the real ``query_paths`` from the poisoned query.
4. Returns ``{ok, real:true, mode:"real", baseline_answer, poisoned_answer,
   risk:{score, band, confidence, computed:true}, graph, llm_provider,
   timings}``.

Fail-closed contract: if any step (HydraDB / Groq / total wall-clock > ~9s)
fails or overruns, the deterministic result is returned, clearly labelled
``mode:"deterministic_fallback"``, as HTTP 200 — never a 500, never a hang.
A hard ``ThreadPoolExecutor`` timeout caps the whole operation. This module
forces the real path itself via ``RealHydraAdapter`` and never flips the global
``APP_MODE``, so the canonical demo and ``/graph/real-query`` are untouched.

Owned tenants only.
"""
from __future__ import annotations

import logging
import time
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeout
from typing import Any, Optional

import agent_runner
import graph_extractor
import real_agent
import risk_engine
import scenario_loader
from config import settings

logger = logging.getLogger("hydrasentry.real_run")

# Stable, owned, PRE-WARMED sub-tenants (provisioned + ingested + indexed out of
# band). CLEAN holds only the policy/customer context; POISONED additionally
# holds the injected mem_poison_047 memory. Same tenant, distinct sub-tenants,
# so baseline and poisoned runs use genuinely different real HydraDB context.
STABLE_TENANT = "hydrasentry-owned-test"
CLEAN_SUB = "live_demo_clean_agent"
POISONED_SUB = "live_demo_support_agent"

_SCENARIO_ID = "memory_poisoning_refund"

# Hard wall-clock cap for the whole real run. Set below the Vercel 10s limit
# with margin for serialisation/cold-start. If the real work does not complete
# inside this, the orchestrator abandons it and serves the deterministic result.
_HARD_TIMEOUT_SECONDS = 9.0

# Inner cap for the two parallel HydraDB queries. The query itself is ~3-5s; this
# bounds the slower of the two so a stalled query cannot eat the whole budget.
_HYDRA_TIMEOUT_SECONDS = 6.5
LLM_PROVIDER = "groq"


def _query(adapter: Any, sub: str, task: str) -> dict[str, Any]:
    """Single real HydraDB query (runs in a worker thread)."""
    return adapter.query(STABLE_TENANT, sub, task)


def _resolve_binding(tenant_id: Optional[str]) -> Optional[Any]:
    """Resolve which provider/model/key this run's agent+judge calls use.

    If the authenticated tenant has saved a valid BYO credential for the run's
    LLM provider, route THEIR runs through their provider/model/key; otherwise
    return the platform default binding. The PUBLIC unauthenticated demo passes
    no tenant_id, so it always gets the platform default and NEVER a user key.

    Returns a ``ChatBinding`` (tenant or platform), or ``None`` only when even
    the platform Groq key is unconfigured (the caller then fails closed)."""
    if tenant_id:
        try:
            import provider_credentials

            runtime = provider_credentials.runtime_for_tenant(tenant_id, LLM_PROVIDER)
        except Exception as exc:  # noqa: BLE001 -- never break the run on a store blip
            logger.warning("byo binding resolve failed (%s); platform default",
                           type(exc).__name__)
            runtime = None
        if runtime is not None:
            return real_agent.ChatBinding(
                provider=runtime.provider,
                model=runtime.model,
                base_url=runtime.base_url,
                api_key=runtime.api_key,
                source="tenant",
            )
    return real_agent.platform_binding()


def _build_real_run(tenant_id: Optional[str] = None) -> dict[str, Any]:
    """Do the real run. Runs inside a worker thread so the caller can enforce a
    hard wall-clock timeout. Returns a result dict; on any internal failure
    returns ``{ok: False, reason: ...}`` so the caller falls back cleanly.

    ``tenant_id`` (the authenticated caller's tenant) selects a BYO provider
    binding when one is saved; the public demo passes ``None`` and uses the
    platform default."""
    from hydra_client import RealHydraAdapter

    if not settings.hydra.api_key:
        return {"ok": False, "reason": "no HydraDB key configured"}
    binding = _resolve_binding(tenant_id)
    if binding is None or not binding.api_key:
        return {"ok": False, "reason": "no LLM provider key configured"}

    scenario = scenario_loader.get_scenario(_SCENARIO_ID)
    task = scenario["task"]
    adapter = RealHydraAdapter()
    timings: dict[str, int] = {}

    # --- Step 1: query both sub-tenants in parallel. ---
    t0 = time.monotonic()
    with ThreadPoolExecutor(max_workers=2) as pool:
        fut_clean = pool.submit(_query, adapter, CLEAN_SUB, task)
        fut_poison = pool.submit(_query, adapter, POISONED_SUB, task)
        try:
            clean_q = fut_clean.result(timeout=_HYDRA_TIMEOUT_SECONDS)
            poison_q = fut_poison.result(timeout=_HYDRA_TIMEOUT_SECONDS)
        except FutureTimeout:
            return {"ok": False, "reason": "hydra query timed out"}
    timings["hydra_query_ms"] = int((time.monotonic() - t0) * 1000)

    if not clean_q.get("ok") or not poison_q.get("ok"):
        return {"ok": False, "reason": "hydra query failed",
                "clean_status": clean_q.get("status"),
                "poison_status": poison_q.get("status")}
    # The poisoned query must return REAL triplets — that graph is the evidence.
    if not poison_q.get("real"):
        return {"ok": False, "reason": "hydra returned no real graph triplets"}

    # --- Step 2: run the real Groq agent on each context IN PARALLEL. ---
    # Clear any stale Groq failure detail so a fallback reason reflects THIS run.
    real_agent.reset_failure_reason()
    t1 = time.monotonic()
    with ThreadPoolExecutor(max_workers=2) as pool:
        fut_base = pool.submit(real_agent.run_agent_answer, scenario, clean_q, binding)
        fut_pois = pool.submit(real_agent.run_agent_answer, scenario, poison_q, binding)
        baseline_answer = fut_base.result()
        poisoned_answer = fut_pois.result()
    timings["agent_ms"] = int((time.monotonic() - t1) * 1000)

    if not baseline_answer or not poisoned_answer:
        # Surface the upstream cause (e.g. "groq 429 rate_limited") so a degraded
        # demo is diagnosable from the response, not a guess. Falls back to the
        # generic phrasing only when no specific Groq detail was captured.
        detail = real_agent.last_failure_reason()
        reason = (f"groq agent produced no answer ({detail})"
                  if detail else "groq agent produced no answer")
        return {"ok": False, "reason": reason}

    # --- Step 3: real judge + deterministic rules over the ACTUAL answers. ---
    # The two agent answers above are real LLM output and are the marquee value of
    # this run. The judge is a refinement on top: if Groq is contended and the
    # judge call alone is rate-limited, the run MUST still return as real (real
    # baseline vs poisoned text) with the score computed from the deterministic
    # rules over those real answers, rather than collapsing to the demo. So we
    # clear the agent-success state first, then treat a missing judge as an
    # honest "rules_fallback" judge mode instead of a hard failure.
    real_agent.reset_failure_reason()
    t2 = time.monotonic()
    judge = real_agent.judge_answers(scenario, baseline_answer, poisoned_answer, binding)
    timings["judge_ms"] = int((time.monotonic() - t2) * 1000)
    # If the judge fell back, record WHY (e.g. "groq 429 rate_limited") so the
    # degraded-but-real run stays diagnosable. None means the judge ran cleanly.
    judge_note = None if judge else real_agent.last_failure_reason()
    judge_mode = "real" if judge else "rules_fallback"

    diff = agent_runner.behavior_diff(baseline_answer, poisoned_answer, scenario)
    graph = graph_extractor.build_graph(poison_q, scenario)

    judge_score = judge["score"] if judge else None
    risk = risk_engine.score_scenario(
        scenario, baseline_answer, poisoned_answer, diff,
        graph_taint=graph, judge_score=judge_score,
    )
    # Confidence: prefer the judge's own confidence when it ran, else the rules
    # confidence. Either way it is COMPUTED from this run, not a constant.
    confidence = (judge["confidence"] if judge else risk["confidence"])

    return {
        "ok": True,
        "real": True,
        "mode": "real",
        "scenario_id": _SCENARIO_ID,
        "task": task,
        "baseline_answer": baseline_answer,
        "poisoned_answer": poisoned_answer,
        "behavior_diff": diff,
        "risk": {
            "score": risk["score"],
            "band": risk["band"],
            "confidence": confidence,
            "computed": True,
            # "real" when the Groq judge scored this run; "rules_fallback" when
            # the judge was rate-limited and the score came from the rules over
            # the real agent answers. The run is real either way.
            "judge_mode": judge_mode,
            "judge_note": judge_note,
            "attack_type": risk["attack_type"],
            "components": risk["components"],
            "rules_fired": risk["rules_fired"],
            "judge": judge,  # {score, confidence, rationale} or None
        },
        "graph": {
            "source": graph["source"],
            "graph_basis": poison_q.get("graph_basis"),
            "nodes": graph["nodes"],
            "edges": graph["edges"],
            "query_paths": graph["query_paths"],
            "tainted_path": graph["tainted_path"],
        },
        "clean_sub_tenant": CLEAN_SUB,
        "poisoned_sub_tenant": POISONED_SUB,
        "tenant_id": STABLE_TENANT,
        # Report the provider/model that ACTUALLY answered. For a BYO tenant this
        # is their provider/model; otherwise the platform Groq + pinned model.
        # ``llm_source`` is "tenant" or "platform" -- the key itself is never here.
        "llm_provider": binding.provider,
        "llm_model": binding.model,
        "llm_source": binding.source,
        "timings": timings,
    }


def _deterministic_fallback(reason: str, elapsed_ms: int) -> dict[str, Any]:
    """The fail-closed result: the deterministic canonical answers + score,
    clearly labelled so it can never be mistaken for the real path."""
    scenario = scenario_loader.get_scenario(_SCENARIO_ID)
    baseline = scenario["baseline_answer"]
    poisoned = scenario["poisoned_answer"]
    diff = agent_runner.behavior_diff(baseline, poisoned, scenario)
    graph = graph_extractor.build_graph(None, scenario)  # derived 8-node graph
    risk = risk_engine.score_scenario(
        scenario, baseline, poisoned, diff, graph_taint=graph,
    )
    return {
        "ok": True,
        "real": False,
        "mode": "deterministic_fallback",
        "fallback_reason": reason,
        "scenario_id": _SCENARIO_ID,
        "task": scenario["task"],
        "baseline_answer": baseline,
        "poisoned_answer": poisoned,
        "behavior_diff": diff,
        "risk": {
            "score": risk["score"],
            "band": risk["band"],
            "confidence": risk["confidence"],
            "computed": False,
            "judge_mode": "deterministic",
            "judge_note": reason,
            "attack_type": risk["attack_type"],
            "components": risk["components"],
            "rules_fired": risk["rules_fired"],
            "judge": None,
        },
        "graph": {
            "source": graph["source"],  # derived_scenario_graph
            "graph_basis": None,
            "nodes": graph["nodes"],
            "edges": graph["edges"],
            "query_paths": graph["query_paths"],
            "tainted_path": graph["tainted_path"],
        },
        "tenant_id": STABLE_TENANT,
        "llm_provider": "deterministic",
        "llm_model": "hydrasentry-deterministic",
        "timings": {"total_ms": elapsed_ms},
    }


def run_real(tenant_id: Optional[str] = None) -> dict[str, Any]:
    """Public entrypoint. Never raises. On success returns the real result; on
    any failure or wall-clock overrun returns the deterministic fallback. Both
    are HTTP-200-safe envelopes.

    ``tenant_id`` (the authenticated caller's tenant) routes the run through that
    tenant's BYO provider when one is saved+valid; the public unauthenticated
    demo passes ``None`` and always uses the platform default.
    """
    started = time.monotonic()
    try:
        with ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(_build_real_run, tenant_id)
            result = future.result(timeout=_HARD_TIMEOUT_SECONDS)
    except FutureTimeout:
        elapsed = int((time.monotonic() - started) * 1000)
        logger.warning("run_real timed out after %.1fs", _HARD_TIMEOUT_SECONDS)
        return _deterministic_fallback("real run exceeded wall-clock budget", elapsed)
    except Exception as exc:  # noqa: BLE001 -- fail closed, never propagate a 500
        elapsed = int((time.monotonic() - started) * 1000)
        logger.warning("run_real failed: %s", type(exc).__name__)
        return _deterministic_fallback(f"real run error: {type(exc).__name__}", elapsed)

    elapsed = int((time.monotonic() - started) * 1000)
    if not result.get("ok"):
        # An internal step failed cleanly (e.g. no triplets / no key). Fall back.
        return _deterministic_fallback(result.get("reason", "real run unavailable"), elapsed)

    result.setdefault("timings", {})["total_ms"] = elapsed
    logger.info("run_real ok score=%s band=%s %dms",
                result["risk"]["score"], result["risk"]["band"], elapsed)
    return result
