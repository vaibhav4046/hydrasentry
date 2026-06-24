"""In-app simulated scheduler for HydraSentry.

This is an IN-APP SIMULATED schedule for demo purposes. It does NOT register
real cron jobs or external timers; it persists agent rows in SQLite and lets
the UI toggle and trigger them. The six agents model a continuous
context-integrity monitoring posture.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import storage

logger = logging.getLogger("hydrasentry.scheduler")

# Fixed seed date keeps next_run deterministic for tests.
_SEED_NOW = datetime(2026, 6, 24, 2, 0, 0, tzinfo=timezone.utc)


def seed_agents() -> None:
    """Seed the six simulated agents (delegates to storage; idempotent)."""
    storage.seed_scheduled_agents()


def list_agents() -> list[dict[str, Any]]:
    return storage.get_scheduled_agents()


def toggle(agent_id: str) -> Optional[dict[str, Any]]:
    result = storage.toggle_agent(agent_id)
    if result is not None:
        logger.info("toggled agent %s -> enabled=%s", agent_id, result["enabled"])
    return result


def schedule_scan(name: str) -> dict[str, Any]:
    """Create a next_run entry for a named scan (simulated, deterministic)."""
    agents = storage.get_scheduled_agents()
    match = next((a for a in agents if a["name"].lower() == name.lower()), None)
    next_run = (_SEED_NOW + timedelta(days=1)).isoformat()
    if match:
        return {
            "scheduled": True,
            "id": match["id"],
            "name": match["name"],
            "schedule": match["schedule"],
            "next_run": match["next_run"] or next_run,
            "simulated": True,
        }
    # Unknown name -> create a synthetic one-off scheduled entry.
    synthetic_id = "agent_" + name.lower().replace(" ", "_")
    return {
        "scheduled": True,
        "id": synthetic_id,
        "name": name,
        "schedule": "0 2 * * *",
        "next_run": next_run,
        "simulated": True,
        "note": "in-app simulated schedule; no external cron registered",
    }
