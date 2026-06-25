"""OTA pack loader and version bumper for HydraSentry.

Packs are versioned JSON sets of detection patterns. ``bump_pack`` performs a
deterministic in-memory patch bump and persists the change. JSON is read with
utf-8-sig to tolerate a UTF-8 BOM on Windows.
"""
from __future__ import annotations

import json
import logging
import os
import shutil
from pathlib import Path
from typing import Any

logger = logging.getLogger("hydrasentry.ota")

# Packs ship next to this file (read-only on Vercel). On serverless we keep a
# writable working copy under /tmp seeded from the shipped packs, so bump_pack
# (which persists a version bump) does not hit the read-only deployment bundle.
# Locally (VERCEL unset) OTA_DIR is the shipped dir and behaviour is unchanged.
_BUNDLED_OTA_DIR = Path(__file__).resolve().parent / "ota_packs"
_IS_SERVERLESS = bool(os.getenv("VERCEL"))
OTA_DIR = Path("/tmp/ota_packs") if _IS_SERVERLESS else _BUNDLED_OTA_DIR

# Fixed seed date keeps last_update deterministic in tests.
_SEED_DATE = "2026-06-24T00:00:00+00:00"


def _read(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def _ensure_writable_dir() -> None:
    """On serverless, seed the /tmp working copy from the shipped packs once."""
    if not _IS_SERVERLESS:
        return
    OTA_DIR.mkdir(parents=True, exist_ok=True)
    if _BUNDLED_OTA_DIR.exists():
        for src in _BUNDLED_OTA_DIR.glob("*.json"):
            dst = OTA_DIR / src.name
            if not dst.exists():
                shutil.copyfile(src, dst)


def list_packs() -> list[dict[str, Any]]:
    _ensure_writable_dir()
    if not OTA_DIR.exists():
        return []
    return [_read(p) for p in sorted(OTA_DIR.glob("*.json"))]


def get_pack(name: str) -> dict[str, Any] | None:
    _ensure_writable_dir()
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
