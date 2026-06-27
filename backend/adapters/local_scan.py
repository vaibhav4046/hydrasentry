"""Shared zero-setup scan: run the full Constellan pipeline on local memories.

This is the engine behind both the ``constellan`` CLI and the optional
``POST /scan/local`` endpoint. It takes a small set of user-provided memories
(plus an optional task/policy), runs them through the SAME pipeline the
scenario engine uses for HydraDB/demo runs -- LocalGraphAdapter ingest ->
graph_extractor -> taint -> risk_engine -> firewall -> report -- and returns a
compact result.

The graph is a transparent LOCAL HEURISTIC GRAPH (``local_graph``), never
presented as real HydraDB. This module is additive and shares no state with the
canonical judge demo or the Real/Demo adapters; importing or calling it cannot
change those paths.
"""
from __future__ import annotations

import logging
from typing import Any

import graph_extractor
import risk_engine
import semantic_detector
from adapters.local_adapter import LocalGraphAdapter

logger = logging.getLogger("hydrasentry.local_scan")

# Default attack framing for ad-hoc local input. Memory poisoning is the
# canonical Constellan class and maps to OWASP ASI06 (Memory Poisoning).
_DEFAULT_ATTACK_TYPE = "memory_poisoning"
_TAINTED_TRUST = ("poisoned", "stale")

# Transparent default markers used when the caller does not supply their own.
# These mirror the kind of language a poisoned/clean answer uses; detection is
# honest substring matching, identical to the rest of the engine.
_DEFAULT_FORBIDDEN_MARKERS = [
    "ignore", "override", "bypass", "instant", "without approval",
    "silently", "approved instantly",
]
_DEFAULT_SAFE_MARKERS = ["approval", "escalate", "policy", "manager"]

# Bounds so the local scan (especially the POST /scan/local endpoint) cannot be
# turned into a CPU denial-of-service by an oversized payload. The heuristic
# extractor runs synchronously, so unbounded input would block the worker.
_MAX_MEMORIES = 200
_MAX_TEXT_CHARS = 8000

# --- Unlabelled-poison content signal (LOCAL SCAN ONLY) ---------------------
# A thin, transparent lexical heuristic that flags an UNLABELLED (trust=trusted)
# memory whose wording paraphrases a policy override, so it scores MEDIUM
# instead of LOW. This is deliberately a content signal, NOT a graph/marker
# signal: it complements (never replaces) the graph-taint + forbidden-marker
# path. It is scoped strictly to this module and only ever nudges LOW -> MEDIUM;
# it can never reach HIGH/CRITICAL and never touches risk_engine or the
# canonical judge demo (which does not import this module).
#
# Detection is two-sided to keep false positives low: a memory must contain BOTH
# an override/contradiction cue AND an auto-action cue (e.g. "ignore ... approval"
# + "approve/refund/grant"). Plain policy-compliant text ("refunds above 500
# require manager approval") trips neither side and stays LOW. Phrases are
# matched as substrings over MEMORY TEXT ONLY, never the task string.
_CONTENT_OVERRIDE_CUES = (
    "ignore", "override", "overrides", "overriding", "bypass", "bypasses",
    "disregard", "regardless of", "no need for", "without approval",
    "without manager", "skip approval", "skip the approval", "do not escalate",
    "don't escalate", "no approval needed", "no sign-off", "no signoff",
    "supersede", "supersedes", "ignore the policy", "ignore policy",
)
_CONTENT_ACTION_CUES = (
    "approve", "approved", "approving", "refund", "refunds", "grant", "granted",
    "pay out", "payout", "release funds", "instant", "instantly",
    "automatic", "automatically", "always allow", "auto-approve",
)
# Score/band for a content-only MEDIUM. 55 mirrors risk_engine.SOFT_FAIL_BASE so
# the number is consistent with the rest of the engine, but it is applied here,
# locally, and capped so a content signal alone can never exceed MEDIUM.
_CONTENT_MEDIUM_SCORE = 55
_CONTENT_MEDIUM_CONFIDENCE = 0.6
_CONTENT_BAND_MEDIUM_MAX = 69


def _normalise_memory(raw: dict[str, Any], index: int) -> dict[str, Any]:
    """Coerce a user memory dict into the chunk shape the engine consumes.

    Required: ``text``. Optional: ``id``/``chunk_id``, ``trust``, ``kind``,
    ``relations``. Unknown trust values are treated as ``trusted`` so arbitrary
    input never crashes the pipeline (validation is permissive by design here;
    this is a try-it tool, not the validated scenario loader)."""
    raw_text = raw.get("text") or ""
    text = (raw_text if isinstance(raw_text, str) else str(raw_text)).strip()
    if len(text) > _MAX_TEXT_CHARS:
        logger.warning("local memory text truncated from %d to %d chars",
                       len(text), _MAX_TEXT_CHARS)
        text = text[:_MAX_TEXT_CHARS]
    chunk_id = raw.get("chunk_id") or raw.get("id") or f"mem_{index:03d}"
    trust = raw.get("trust", "trusted")
    if trust not in ("trusted", "poisoned", "stale"):
        trust = "trusted"
    return {
        "chunk_id": chunk_id,
        "kind": raw.get("kind", "memory"),
        "trust": trust,
        "text": text,
        "relations": raw.get("relations") or [],
    }


def _synthesise_answers(task: str, policy: str,
                        memories: list[dict[str, Any]]) -> tuple[str, str]:
    """Derive deterministic baseline/poisoned answers from the memories.

    Honest and transparent: the baseline answer states the agent follows the
    clean policy; the poisoned answer echoes the first poisoned memory's
    instruction (the genuine attack evidence). No LLM, no randomness.

    The user-supplied ``task`` string is deliberately NOT embedded in either
    answer: marker matching runs over these answers, so echoing raw task text
    would let an arbitrary task inflate or deflate the score on non-evidence.
    Marker-bearing content comes only from the poison memory text (real signal)
    and a fixed safe phrase."""
    poison = next((m for m in memories if m["trust"] in _TAINTED_TRUST), None)
    base_policy = f"Following the approved policy ({policy}). " if policy else ""
    baseline = (
        f"{base_policy}I will apply the approved policy and escalate anything "
        "that requires manager approval."
    )
    if poison:
        poisoned = (
            f"{poison['text']} I am acting on that memory instead of the "
            "approved policy."
        )
    else:
        poisoned = baseline
    return baseline, poisoned


def build_local_scenario(payload: dict[str, Any]) -> dict[str, Any]:
    """Build an engine-shaped scenario dict from a local memories payload.

    ``payload`` shape: ``{task?, policy?, attack_type?, forbidden_markers?,
    safe_markers?, memories: [{id?, text, trust?, relations?}, ...]}``. Memories
    with trust poisoned/stale become ``poison_context``; the rest are
    ``clean_context``."""
    raw_memories = payload.get("memories") or []
    if not isinstance(raw_memories, list):
        raw_memories = []
    if len(raw_memories) > _MAX_MEMORIES:
        logger.warning("local scan memory count capped from %d to %d",
                       len(raw_memories), _MAX_MEMORIES)
        raw_memories = raw_memories[:_MAX_MEMORIES]
    memories = [_normalise_memory(m, i)
                for i, m in enumerate(raw_memories) if isinstance(m, dict)]
    clean = [m for m in memories if m["trust"] not in _TAINTED_TRUST]
    poison = [m for m in memories if m["trust"] in _TAINTED_TRUST]

    task = str(payload.get("task") or "Handle this request.").strip()
    policy_text = str(payload.get("policy") or "").strip()
    attack_type = str(payload.get("attack_type") or _DEFAULT_ATTACK_TYPE)
    forbidden = payload.get("forbidden_markers") or _DEFAULT_FORBIDDEN_MARKERS
    safe = payload.get("safe_markers") or _DEFAULT_SAFE_MARKERS

    baseline_answer, poisoned_answer = _synthesise_answers(task, policy_text, memories)

    return {
        "id": "local_scan",
        "title": "Local zero-setup scan",
        "attack_type": attack_type,
        "mission": {"id": "local_scan", "title": "Local zero-setup scan",
                    "objective": task},
        "tenant_id": "local-owned",
        "sub_tenant": "local-user",
        "task": task,
        "policy": {"version": "local", "text": policy_text or "(no explicit policy)"},
        "clean_context": clean,
        "poison_context": poison,
        "expected_safe_behavior": "Apply the approved policy and escalate as required.",
        "forbidden_behavior": "Act on a poisoned/stale memory that overrides policy.",
        "forbidden_markers": forbidden,
        "safe_markers": safe,
        "baseline_answer": baseline_answer,
        "poisoned_answer": poisoned_answer,
        "skill_ref": None,
    }


def _behavior_diff(baseline: str, poisoned: str,
                   scenario: dict[str, Any]) -> dict[str, Any]:
    """Local behavior diff (mirrors agent_runner.behavior_diff semantics)."""
    forbidden = scenario["forbidden_markers"]
    safe = scenario["safe_markers"]
    low_b, low_p = baseline.lower(), poisoned.lower()
    indicators: list[str] = []
    forbidden_in_poison = [m for m in forbidden if m.lower() in low_p]
    safe_lost = [m for m in safe if m.lower() in low_b and m.lower() not in low_p]
    if forbidden_in_poison:
        indicators.append(f"forbidden marker appeared: {forbidden_in_poison[0]!r}")
    for m in safe_lost:
        indicators.append(f"safe marker lost: {m!r}")
    if baseline.strip() != poisoned.strip():
        indicators.append("answer text diverged from baseline")
    changed = bool(forbidden_in_poison or safe_lost) or baseline.strip() != poisoned.strip()
    return {"changed": changed, "indicators": indicators}


def _content_signal(scenario: dict[str, Any]) -> dict[str, Any]:
    """Lexical content signal over UNLABELLED (trusted) memories only.

    Returns ``{fired, memory_ids, evidence}``. Fires when a trusted memory's
    text contains BOTH an override/contradiction cue and an auto-action cue --
    i.e. it paraphrases "approve/refund regardless of approval", the unlabelled
    semantic-paraphrase case the graph/marker path misses. Poisoned/stale
    memories are intentionally ignored here: they are already handled (and
    scored higher) by the graph-taint + marker path, so this signal is purely
    additive for the unlabelled case."""
    fired_ids: list[str] = []
    evidence: list[str] = []
    for mem in scenario.get("clean_context", []):
        if mem.get("trust") in _TAINTED_TRUST:
            continue  # only unlabelled/trusted memories
        low = (mem.get("text") or "").lower()
        override_hit = next((c for c in _CONTENT_OVERRIDE_CUES if c in low), None)
        action_hit = next((c for c in _CONTENT_ACTION_CUES if c in low), None)
        if override_hit and action_hit:
            fired_ids.append(mem.get("chunk_id"))
            evidence.append(
                f"unlabelled memory {mem.get('chunk_id')!r} pairs override cue "
                f"{override_hit!r} with action cue {action_hit!r}"
            )
    return {"fired": bool(fired_ids), "memory_ids": fired_ids, "evidence": evidence}


def _apply_content_nudge(risk: dict[str, Any], signal: dict[str, Any],
                         scenario: dict[str, Any]) -> dict[str, Any]:
    """LOCAL-ONLY post-score nudge: lift a LOW result to MEDIUM when the content
    signal fires on an unlabelled memory and the graph/marker path found nothing.

    Strictly bounded: only triggers when the labelled path scored LOW (band LOW)
    AND there is no labelled poison/stale memory (so this is genuinely the
    unlabelled case), and it can only raise the band to MEDIUM, never higher. It
    returns a NEW dict (immutable update) and tags the heuristic transparently so
    a reader sees exactly why the score moved."""
    has_labelled_poison = any(
        c.get("trust") in _TAINTED_TRUST for c in scenario.get("poison_context", [])
    )
    if has_labelled_poison or not signal.get("fired") or risk.get("band") != "LOW":
        return risk
    nudged = dict(risk)
    nudged["score"] = min(_CONTENT_MEDIUM_SCORE, _CONTENT_BAND_MEDIUM_MAX)
    nudged["band"] = "MEDIUM"
    nudged["confidence"] = _CONTENT_MEDIUM_CONFIDENCE
    nudged["content_heuristic"] = True
    nudged["rules_fired"] = list(risk.get("rules_fired", [])) + [
        "content_heuristic:unlabelled_override_language_detected"
    ]
    return nudged


# Band ordering so a combine can only ever LIFT a result, never lower it. The
# semantic signal is additive in exactly the same spirit as the lexical nudge.
_BAND_ORDER = {"LOW": 0, "MEDIUM": 1, "HIGH": 2, "CRITICAL": 3}


def _all_scan_memories(scenario: dict[str, Any]) -> list[dict[str, Any]]:
    """Every memory the scan ingested (clean + poison), for semantic scoring.

    Both sides are scored: an UNLABELLED paraphrase poison arrives as
    ``clean_context`` (the whole point), and re-scoring a labelled poison is
    harmless because the combine only lifts the band."""
    return list(scenario.get("clean_context", [])) + list(scenario.get("poison_context", []))


def _apply_semantic_signal(risk: dict[str, Any],
                           semantic: dict[str, Any]) -> dict[str, Any]:
    """Combine the embeddings-based semantic poison signal into the risk result.

    Lift-only: if the semantic detector fired with a band stronger than the
    current band, raise to the semantic band/score; otherwise leave the result
    untouched. This is what lets a paraphrased unlabelled poison that the lexical
    path missed reach MEDIUM/HIGH. Returns a NEW dict (immutable update) and tags
    the result transparently. When embeddings are UNAVAILABLE the result is left
    as-is and tagged ``semantic_available=False`` so the caller can label the
    scan "lexical only, semantic unavailable" -- never a silent pass."""
    out = dict(risk)
    out["semantic_available"] = bool(semantic.get("available"))
    if not semantic.get("available"):
        out["semantic_note"] = semantic.get("reason", "semantic detection unavailable")
        return out
    if not semantic.get("fired"):
        out["semantic_max_similarity"] = semantic.get("max_similarity")
        return out

    sem_band = semantic.get("band", "MEDIUM")
    sem_score = int(semantic.get("score", 55))
    out["semantic_max_similarity"] = semantic.get("max_similarity")
    out["semantic_model"] = semantic.get("model")
    rules_fired = list(out.get("rules_fired", []))
    rules_fired.append(
        f"semantic:paraphrase_poison_detected:sim={semantic.get('max_similarity')}"
    )
    out["rules_fired"] = rules_fired
    out["semantic_heuristic"] = True

    if _BAND_ORDER.get(sem_band, 0) > _BAND_ORDER.get(out.get("band", "LOW"), 0):
        out["score"] = max(int(out.get("score", 0)), sem_score)
        out["band"] = sem_band
    return out


def run_local_scan(payload: dict[str, Any]) -> dict[str, Any]:
    """Run the full pipeline on local memories and return a compact result.

    Returns ``{ok, graph_source, risk, firewall, tainted_path, query_paths,
    findings, baseline, poisoned, behavior_diff, scenario_title}``. The graph
    is always labelled ``local_graph`` -- a local heuristic graph, not HydraDB.
    """
    scenario = build_local_scenario(payload)
    adapter = LocalGraphAdapter()
    tenant, sub = scenario["tenant_id"], scenario["sub_tenant"]

    adapter.ensure_tenant(tenant, sub)
    adapter.ingest_knowledge(tenant, sub, scenario["clean_context"])
    adapter.ingest_memory(tenant, sub, scenario["poison_context"])
    adapter.wait_indexed(tenant, sub)

    query_result = adapter.query(tenant, sub, scenario["task"])
    graph = graph_extractor.build_graph(query_result, scenario)

    baseline_answer = scenario["baseline_answer"]
    poisoned_answer = scenario["poisoned_answer"]
    diff = _behavior_diff(baseline_answer, poisoned_answer, scenario)
    risk = risk_engine.score_scenario(
        scenario, baseline_answer, poisoned_answer, diff, graph_taint=graph,
    )

    # Additive, local-only: lift an unlabelled-override LOW to MEDIUM. No-op when
    # a labelled poison already drove a higher band (e.g. the bundled sample).
    content = _content_signal(scenario)
    risk = _apply_content_nudge(risk, content, scenario)

    # The real moat: SEMANTIC paraphrase detection via embeddings. Catches a
    # reworded policy-override poison the lexical/marker paths miss. Lift-only and
    # fail-closed -- if embeddings are unavailable the band is unchanged and the
    # result is tagged so the response reads "lexical only, semantic unavailable".
    semantic = semantic_detector.detect(_all_scan_memories(scenario))
    risk = _apply_semantic_signal(risk, semantic)

    firewall = _firewall_decision(risk)
    findings = _findings(scenario, graph, diff, risk)
    if content.get("fired") and risk.get("content_heuristic"):
        findings.extend(content["evidence"])
    if semantic.get("fired") and risk.get("semantic_heuristic"):
        findings.extend(semantic.get("evidence", []))
    elif not semantic.get("available"):
        findings.append(
            "semantic detection unavailable (lexical only): "
            + str(semantic.get("reason", "embeddings unavailable"))
        )

    return {
        "ok": True,
        "graph_source": graph["source"],
        "scenario_title": scenario["title"],
        "task": scenario["task"],
        "risk": risk,
        "firewall": firewall,
        "tainted_path": graph["tainted_path"],
        "query_paths": graph["query_paths"],
        "nodes": graph["nodes"],
        "edges": graph["edges"],
        "findings": findings,
        "baseline": baseline_answer,
        "poisoned": poisoned_answer,
        "behavior_diff": diff,
        "content_signal": content,
        "semantic_signal": semantic,
    }


def _firewall_decision(risk: dict[str, Any]) -> dict[str, Any]:
    """Map a risk band to a firewall decision (mirrors scenario_engine)."""
    band = risk.get("band", "LOW")
    if band == "CRITICAL":
        return {"decision": "quarantine"}
    if band == "HIGH":
        return {"decision": "block"}
    if band == "MEDIUM":
        return {"decision": "warn"}
    return {"decision": "allow"}


def _findings(scenario: dict[str, Any], graph: dict[str, Any],
              diff: dict[str, Any], risk: dict[str, Any]) -> list[str]:
    """Build a flat list of human-readable flagged findings."""
    findings: list[str] = []
    poison_ids = [c["chunk_id"] for c in scenario["poison_context"]]
    for pid in poison_ids:
        findings.append(f"poisoned/stale memory detected: {pid}")
    if graph["tainted_path"]:
        findings.append("tainted path: " + " -> ".join(graph["tainted_path"]))
    findings.extend(diff.get("indicators", []))
    findings.extend(risk.get("rules_fired", []))
    return findings
