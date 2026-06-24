"""SQLite persistence for HydraSentry runs, findings, skills, and agents.

Uses only the stdlib ``sqlite3``. The DB path is parsed from DATABASE_URL.
Run artifacts are written as JSON to the repo-root ``runs/`` directory.
All initialisation is idempotent.
"""
from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from config import RUNS_DIR, settings

_SCHEMA = """
CREATE TABLE IF NOT EXISTS runs (
    run_id TEXT PRIMARY KEY,
    scenario_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    mode TEXT NOT NULL,
    risk_score INTEGER NOT NULL,
    band TEXT NOT NULL,
    attack_type TEXT NOT NULL,
    decision TEXT NOT NULL,
    json_path TEXT NOT NULL,
    summary_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS findings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL,
    title TEXT NOT NULL,
    severity TEXT NOT NULL,
    risk INTEGER NOT NULL,
    attack_type TEXT NOT NULL,
    created_at TEXT NOT NULL,
    status TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS skills (
    hash TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    risk INTEGER NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS scheduled_agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    enabled INTEGER NOT NULL,
    schedule TEXT NOT NULL,
    last_run TEXT,
    next_run TEXT,
    latest_result TEXT,
    action_taken TEXT,
    status TEXT NOT NULL
);
"""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _connect() -> sqlite3.Connection:
    db_path = settings.db_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    return conn


def init_db() -> None:
    """Create all tables if they do not exist. Idempotent."""
    RUNS_DIR.mkdir(parents=True, exist_ok=True)
    conn = _connect()
    try:
        conn.executescript(_SCHEMA)
        conn.commit()
    finally:
        conn.close()


def _artifact_path(run_id: str) -> Path:
    RUNS_DIR.mkdir(parents=True, exist_ok=True)
    return RUNS_DIR / f"{run_id}.json"


def save_run(artifact: dict[str, Any]) -> dict[str, Any]:
    """Persist a run artifact: writes runs/<run_id>.json, a runs row,
    and a derived findings row. Returns the artifact unchanged."""
    run_id = artifact["run_id"]
    path = _artifact_path(run_id)
    path.write_text(json.dumps(artifact, indent=2), encoding="utf-8")

    risk = artifact.get("risk", {})
    firewall = artifact.get("firewall", {})
    summary = {
        "run_id": run_id,
        "scenario_id": artifact.get("scenario_id"),
        "title": artifact.get("mission", {}).get("title", artifact.get("scenario_id")),
        "score": risk.get("score", 0),
        "band": risk.get("band", "LOW"),
        "attack_type": risk.get("attack_type", "unknown"),
        "decision": firewall.get("decision", "allow"),
        "graph_source": artifact.get("graph_source"),
        "created_at": artifact.get("created_at", _now()),
    }

    conn = _connect()
    try:
        conn.execute(
            """INSERT OR REPLACE INTO runs
               (run_id, scenario_id, created_at, mode, risk_score, band,
                attack_type, decision, json_path, summary_json)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                run_id,
                artifact.get("scenario_id", ""),
                summary["created_at"],
                artifact.get("mode", "demo"),
                int(summary["score"]),
                summary["band"],
                summary["attack_type"],
                summary["decision"],
                str(path),
                json.dumps(summary),
            ),
        )
        conn.execute(
            """INSERT INTO findings
               (run_id, title, severity, risk, attack_type, created_at, status)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                run_id,
                summary["title"],
                summary["band"],
                int(summary["score"]),
                summary["attack_type"],
                summary["created_at"],
                "open",
            ),
        )
        conn.commit()
    finally:
        conn.close()
    return artifact


def load_run(run_id: str) -> Optional[dict[str, Any]]:
    """Load a full run artifact from disk; falls back to the stored summary."""
    path = _artifact_path(run_id)
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    conn = _connect()
    try:
        row = conn.execute("SELECT * FROM runs WHERE run_id = ?", (run_id,)).fetchone()
    finally:
        conn.close()
    if row is None:
        return None
    return json.loads(row["summary_json"])


def list_runs() -> list[dict[str, Any]]:
    conn = _connect()
    try:
        rows = conn.execute(
            "SELECT summary_json FROM runs ORDER BY created_at DESC"
        ).fetchall()
    finally:
        conn.close()
    return [json.loads(r["summary_json"]) for r in rows]


def list_findings() -> list[dict[str, Any]]:
    conn = _connect()
    try:
        rows = conn.execute(
            "SELECT * FROM findings ORDER BY created_at DESC"
        ).fetchall()
    finally:
        conn.close()
    return [dict(r) for r in rows]


def update_finding_status(finding_id: int, status: str) -> bool:
    conn = _connect()
    try:
        cur = conn.execute(
            "UPDATE findings SET status = ? WHERE id = ?", (status, finding_id)
        )
        conn.commit()
        return cur.rowcount > 0
    finally:
        conn.close()


def results_summary() -> dict[str, Any]:
    """Aggregate counts for the dashboard."""
    conn = _connect()
    try:
        runs = conn.execute("SELECT band, attack_type, decision, risk_score FROM runs").fetchall()
        findings = conn.execute("SELECT status FROM findings").fetchall()
    finally:
        conn.close()

    by_band: dict[str, int] = {}
    by_attack: dict[str, int] = {}
    by_decision: dict[str, int] = {}
    scores: list[int] = []
    for r in runs:
        by_band[r["band"]] = by_band.get(r["band"], 0) + 1
        by_attack[r["attack_type"]] = by_attack.get(r["attack_type"], 0) + 1
        by_decision[r["decision"]] = by_decision.get(r["decision"], 0) + 1
        scores.append(int(r["risk_score"]))

    open_findings = sum(1 for f in findings if f["status"] == "open")
    return {
        "total_runs": len(runs),
        "total_findings": len(findings),
        "open_findings": open_findings,
        "by_band": by_band,
        "by_attack_type": by_attack,
        "by_decision": by_decision,
        "max_score": max(scores) if scores else 0,
        "avg_score": round(sum(scores) / len(scores), 1) if scores else 0,
    }


def save_skill_scan(scan: dict[str, Any]) -> dict[str, Any]:
    """Persist a SkillMake scan result (idempotent on skill hash)."""
    conn = _connect()
    try:
        conn.execute(
            """INSERT OR REPLACE INTO skills (hash, name, risk, status, created_at)
               VALUES (?, ?, ?, ?, ?)""",
            (
                scan.get("skill_hash", ""),
                scan.get("name", "unknown"),
                int(scan.get("risk_score", 0)),
                scan.get("status", "scanned"),
                _now(),
            ),
        )
        conn.commit()
    finally:
        conn.close()
    return scan


def list_skills() -> list[dict[str, Any]]:
    conn = _connect()
    try:
        rows = conn.execute("SELECT * FROM skills ORDER BY created_at DESC").fetchall()
    finally:
        conn.close()
    return [dict(r) for r in rows]


# --- Scheduled agents -------------------------------------------------------

_SEED_AGENTS = [
    ("agent_nightly_memory", "Nightly Memory Scan", "0 2 * * *",
     "12 memories scanned, 1 poisoned quarantined", "quarantine"),
    ("agent_skillmake", "SkillMake Scanner", "0 */6 * * *",
     "3 skills scanned, 1 CRITICAL blocked", "block"),
    ("agent_policy_drift", "Policy Drift Checker", "0 3 * * *",
     "policy v2 active, 1 stale override flagged", "warn"),
    ("agent_regression_replay", "Regression Replay", "0 4 * * *",
     "5 regression scenarios replayed, all passed", "none"),
    ("agent_model_health", "Model Health Checker", "*/30 * * * *",
     "providers reachable; deterministic fallback ready", "none"),
    ("agent_weekly_report", "Weekly Security Report", "0 6 * * 1",
     "weekly finding report generated", "report"),
]


def seed_scheduled_agents() -> None:
    """Seed the six in-app simulated scheduled agents. Idempotent."""
    conn = _connect()
    try:
        existing = {
            r["id"] for r in conn.execute("SELECT id FROM scheduled_agents").fetchall()
        }
        for agent_id, name, schedule, result, action in _SEED_AGENTS:
            if agent_id in existing:
                continue
            conn.execute(
                """INSERT INTO scheduled_agents
                   (id, name, enabled, schedule, last_run, next_run,
                    latest_result, action_taken, status)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    agent_id, name, 1, schedule,
                    "2026-06-24T02:00:00+00:00",
                    "2026-06-25T02:00:00+00:00",
                    result, action, "idle",
                ),
            )
        conn.commit()
    finally:
        conn.close()


def get_scheduled_agents() -> list[dict[str, Any]]:
    conn = _connect()
    try:
        rows = conn.execute(
            "SELECT * FROM scheduled_agents ORDER BY name ASC"
        ).fetchall()
    finally:
        conn.close()
    out = []
    for r in rows:
        d = dict(r)
        d["enabled"] = bool(d["enabled"])
        out.append(d)
    return out


def toggle_agent(agent_id: str) -> Optional[dict[str, Any]]:
    conn = _connect()
    try:
        row = conn.execute(
            "SELECT enabled FROM scheduled_agents WHERE id = ?", (agent_id,)
        ).fetchone()
        if row is None:
            return None
        new_state = 0 if row["enabled"] else 1
        conn.execute(
            "UPDATE scheduled_agents SET enabled = ? WHERE id = ?",
            (new_state, agent_id),
        )
        conn.commit()
        updated = conn.execute(
            "SELECT * FROM scheduled_agents WHERE id = ?", (agent_id,)
        ).fetchone()
    finally:
        conn.close()
    d = dict(updated)
    d["enabled"] = bool(d["enabled"])
    return d
