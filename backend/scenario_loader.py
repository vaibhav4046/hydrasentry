"""Load and validate HydraSentry scenario fixtures.

Scenario JSON is read with utf-8-sig so a UTF-8 BOM (common on Windows) does
not break parsing. Every scenario is validated for required fields and chunk
shape at load time, failing fast with a clear error.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

SCENARIOS_DIR = Path(__file__).resolve().parent / "scenarios"

REQUIRED_FIELDS = [
    "id", "title", "attack_type", "mission", "tenant_id", "sub_tenant",
    "task", "policy", "clean_context", "poison_context",
    "expected_safe_behavior", "forbidden_behavior",
    "forbidden_markers", "safe_markers",
    "baseline_answer", "poisoned_answer",
]

CHUNK_FIELDS = ["chunk_id", "kind", "trust", "text"]
VALID_TRUST = {"trusted", "poisoned", "stale"}
VALID_KIND = {"memory", "knowledge", "policy"}


def read_json(path: Path) -> dict[str, Any]:
    """Read a JSON file tolerating a UTF-8 BOM."""
    return json.loads(path.read_text(encoding="utf-8-sig"))


def _validate_chunk(scenario_id: str, where: str, chunk: dict[str, Any]) -> None:
    for f in CHUNK_FIELDS:
        if f not in chunk:
            raise ValueError(
                f"scenario '{scenario_id}' {where} chunk missing field '{f}'"
            )
    if chunk["trust"] not in VALID_TRUST:
        raise ValueError(
            f"scenario '{scenario_id}' {where} chunk '{chunk['chunk_id']}' "
            f"has invalid trust '{chunk['trust']}'"
        )
    if chunk["kind"] not in VALID_KIND:
        raise ValueError(
            f"scenario '{scenario_id}' {where} chunk '{chunk['chunk_id']}' "
            f"has invalid kind '{chunk['kind']}'"
        )


def _validate(scenario: dict[str, Any], source: str) -> None:
    for f in REQUIRED_FIELDS:
        if f not in scenario:
            raise ValueError(f"{source}: scenario missing required field '{f}'")
    sid = scenario["id"]
    for chunk in scenario["clean_context"]:
        _validate_chunk(sid, "clean_context", chunk)
    for chunk in scenario["poison_context"]:
        _validate_chunk(sid, "poison_context", chunk)
    if not scenario["forbidden_markers"]:
        raise ValueError(f"scenario '{sid}' has empty forbidden_markers")


def load_all_scenarios() -> dict[str, dict[str, Any]]:
    """Load and validate every scenario fixture, keyed by id."""
    if not SCENARIOS_DIR.exists():
        raise FileNotFoundError(f"scenarios dir not found: {SCENARIOS_DIR}")
    out: dict[str, dict[str, Any]] = {}
    for path in sorted(SCENARIOS_DIR.glob("*.json")):
        data = read_json(path)
        _validate(data, path.name)
        if data["id"] in out:
            raise ValueError(f"duplicate scenario id '{data['id']}'")
        out[data["id"]] = data
    if not out:
        raise ValueError("no scenarios found")
    return out


# Load once at import; downstream modules reuse this cache.
_CACHE: dict[str, dict[str, Any]] | None = None


def _scenarios() -> dict[str, dict[str, Any]]:
    global _CACHE
    if _CACHE is None:
        _CACHE = load_all_scenarios()
    return _CACHE


def get_scenario(scenario_id: str) -> dict[str, Any]:
    scenarios = _scenarios()
    if scenario_id not in scenarios:
        raise KeyError(f"unknown scenario '{scenario_id}'")
    return scenarios[scenario_id]


def list_scenarios() -> list[dict[str, Any]]:
    """Return a lightweight summary of each scenario for the UI."""
    out = []
    for sc in _scenarios().values():
        out.append({
            "id": sc["id"],
            "title": sc["title"],
            "attack_type": sc["attack_type"],
            "objective": sc["mission"]["objective"],
            "task": sc["task"],
            "tenant_id": sc["tenant_id"],
            "sub_tenant": sc["sub_tenant"],
            "policy_version": sc["policy"]["version"],
        })
    return out
