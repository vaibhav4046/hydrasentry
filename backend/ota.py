"""OTA pack loader and version bumper for HydraSentry.

Packs are versioned JSON sets of detection patterns. ``bump_pack`` performs a
deterministic in-memory patch bump and persists the change. JSON is read with
utf-8-sig to tolerate a UTF-8 BOM on Windows.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger("hydrasentry.ota")

OTA_DIR = Path(__file__).resolve().parent / "ota_packs"

# Fixed seed date keeps last_update deterministic in tests.
_SEED_DATE = "2026-06-24T00:00:00+00:00"


def _read(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def list_packs() -> list[dict[str, Any]]:
    if not OTA_DIR.exists():
        return []
    return [_read(p) for p in sorted(OTA_DIR.glob("*.json"))]


def get_pack(name: str) -> dict[str, Any] | None:
    path = OTA_DIR / f"{name}.json"
    if not path.exists():
        return None
    return _read(path)


def _bump_patch(version: str) -> str:
    parts = version.split(".")
    while len(parts) < 3:
        parts.append("0")
    try:
        major, minor, patch = int(parts[0]), int(parts[1]), int(parts[2])
    except ValueError:
        return "1.0.1"
    return f"{major}.{minor}.{patch + 1}"


def bump_pack(name: str, pattern: str) -> dict[str, Any]:
    """Add a pattern and bump the pack patch version. Persists to disk.

    If the pack does not exist, a new one is created deterministically.
    """
    pack = get_pack(name) or {
        "name": name,
        "version": "1.0.0",
        "last_update": _SEED_DATE,
        "patterns_added": [],
        "active_checks": 0,
        "status": "active",
    }
    pattern_key = pattern[:80]
    if pattern_key not in pack["patterns_added"]:
        pack["patterns_added"].append(pattern_key)
        pack["active_checks"] = int(pack.get("active_checks", 0)) + 1
    pack["version"] = _bump_patch(pack.get("version", "1.0.0"))
    pack["last_update"] = _SEED_DATE

    path = OTA_DIR / f"{name}.json"
    OTA_DIR.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(pack, indent=2), encoding="utf-8")
    logger.info("bumped OTA pack %s -> v%s", name, pack["version"])
    return pack
