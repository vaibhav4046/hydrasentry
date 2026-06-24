"""Self-refinement loop for HydraSentry.

When a finding is accepted, extract a reusable pattern, draft a deterministic
detection rule, register a regression scenario id, schedule a future replay,
bump the relevant OTA pack version, and append to a timeline. Fully
deterministic so the judge demo is reproducible.
"""
from __future__ import annotations

import hashlib
import logging
from typing import Any

import scheduler

logger = logging.getLogger("hydrasentry.self_refiner")

# Map attack types to the OTA pack they refine.
_ATTACK_TO_PACK = {
    "memory_poisoning": "attack-pack",
    "indirect_prompt_injection": "attack-pack",
    "cross_subtenant_leak": "policy-pack",
    "unsafe_skill": "skill-risk-pack",
    "stale_context": "policy-pack",
}


def _rule_id(attack_type: str, pattern: str) -> str:
    digest = hashlib.sha256(f"{attack_type}:{pattern}".encode("utf-8")).hexdigest()[:8]
    return f"rule_{attack_type}_{digest}"


def refine_from_finding(artifact: dict[str, Any]) -> dict[str, Any]:
    """Produce a deterministic self-refinement result from a run artifact."""
    risk = artifact.get("risk", {})
    attack_type = risk.get("attack_type", "unknown")
    scenario_id = artifact.get("scenario_id", "unknown")
    rules_fired = risk.get("rules_fired", [])

    pattern = (
        f"When attack_type={attack_type}, a forbidden marker in the poisoned "
        f"answer combined with a tainted query_path indicates a context-integrity "
        f"breach (band {risk.get('band')})."
    )
    rule_id = _rule_id(attack_type, pattern)
    regression_scenario_id = f"regression_{scenario_id}"

    future_scan = scheduler.schedule_scan("Regression Replay")

    pack_name = _ATTACK_TO_PACK.get(attack_type, "attack-pack")
    from ota import bump_pack
    pack = bump_pack(pack_name, pattern)

    timeline = [
        {"step": "finding_accepted", "detail": f"finding for {scenario_id} accepted"},
        {"step": "pattern_extracted", "detail": pattern},
        {"step": "rule_drafted", "detail": rule_id},
        {"step": "regression_scenario_registered", "detail": regression_scenario_id},
        {"step": "future_replay_scheduled", "detail": future_scan["next_run"]},
        {"step": "ota_pack_bumped", "detail": f"{pack['name']} -> v{pack['version']}"},
    ]

    logger.info("self-refinement: rule=%s pack=%s v=%s", rule_id, pack["name"], pack["version"])
    return {
        "finding_accepted": True,
        "pattern": pattern,
        "rule_id": rule_id,
        "regression_scenario_id": regression_scenario_id,
        "future_scan": future_scan,
        "ota": {"pack": pack["name"], "version": pack["version"]},
        "timeline": timeline,
    }
