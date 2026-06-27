"""MCP-inspired gateway for HydraSentry.

Exposes a manifest of tools and resources. Write actions require the
``X-MCP-Secret`` header to equal MCP_SHARED_SECRET. The secret check is
FAIL-CLOSED (operating rule #3): if MCP_SHARED_SECRET is UNSET, write tools are
refused (``unauthorized``), not silently allowed. The compare is constant-time
(``hmac.compare_digest``) so a timing side channel cannot leak the secret. A
bounded recent-calls log is kept for the UI.
"""
from __future__ import annotations

import hmac
import logging
from collections import deque
from datetime import datetime, timezone
from typing import Any, Optional

import scenario_engine
import scenario_loader
import scheduler
import skillmake_scanner
import storage
from config import settings
from hydra_client import get_adapter

logger = logging.getLogger("hydrasentry.mcp")

SERVER_NAME = "hydrasentry-mcp"
SERVER_VERSION = "1.0.0"

# Actions that mutate state or trigger work require the shared secret.
WRITE_TOOLS = {
    "replay_attack", "quarantine_memory", "generate_report",
    "schedule_scan", "verify_skill",
}

_RECENT_CALLS: deque[dict[str, Any]] = deque(maxlen=50)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _log_call(tool: str, allowed: bool, warning: Optional[str]) -> None:
    _RECENT_CALLS.appendleft({
        "tool": tool, "allowed": allowed, "warning": warning, "at": _now(),
    })


def recent_calls() -> list[dict[str, Any]]:
    return list(_RECENT_CALLS)


def manifest() -> dict[str, Any]:
    """Return the MCP server manifest (tools + resources)."""
    return {
        "name": SERVER_NAME,
        "version": SERVER_VERSION,
        "description": "HydraDB-native context-integrity harness for AI agents.",
        "tools": [
            {
                "name": "scan_context",
                "description": "Run a context-integrity scenario and return the risk result.",
                "inputSchema": {
                    "type": "object",
                    "properties": {"scenario_id": {"type": "string"}},
                    "required": ["scenario_id"],
                },
            },
            {
                "name": "replay_attack",
                "description": "Replay a poisoning attack scenario end to end (write).",
                "inputSchema": {
                    "type": "object",
                    "properties": {"scenario_id": {"type": "string"}},
                    "required": ["scenario_id"],
                },
            },
            {
                "name": "verify_skill",
                "description": "Statically scan SkillMake SKILL.md content for unsafe instructions (write).",
                "inputSchema": {
                    "type": "object",
                    "properties": {"content": {"type": "string"},
                                   "name": {"type": "string"}},
                    "required": ["content"],
                },
            },
            {
                "name": "quarantine_memory",
                "description": "Quarantine a poisoned memory chunk in an owned tenant (write).",
                "inputSchema": {
                    "type": "object",
                    "properties": {"tenant_id": {"type": "string"},
                                   "sub_tenant_id": {"type": "string"},
                                   "chunk_id": {"type": "string"}},
                    "required": ["chunk_id"],
                },
            },
            {
                "name": "generate_report",
                "description": "Generate a Markdown finding report for a run (write).",
                "inputSchema": {
                    "type": "object",
                    "properties": {"run_id": {"type": "string"}},
                    "required": ["run_id"],
                },
            },
            {
                "name": "schedule_scan",
                "description": "Schedule a simulated future scan by name (write).",
                "inputSchema": {
                    "type": "object",
                    "properties": {"name": {"type": "string"}},
                    "required": ["name"],
                },
            },
            {
                "name": "list_findings",
                "description": "List recorded findings.",
                "inputSchema": {"type": "object", "properties": {}},
            },
        ],
        "resources": [
            {"uri": "hydrasentry://project/current",
             "description": "Current project mode, tenant, and adapter status."},
            {"uri": "hydrasentry://findings/latest",
             "description": "Most recent findings."},
            {"uri": "hydrasentry://reports/latest",
             "description": "Most recent run report (markdown)."},
            {"uri": "hydrasentry://memory/risky",
             "description": "Skills and memories flagged as risky."},
            {"uri": "hydrasentry://policies/current",
             "description": "Current scenario policies."},
        ],
    }


def resources() -> dict[str, Any]:
    """Materialise resource contents for the UI / MCP clients."""
    runs = storage.list_runs()
    latest = runs[0] if runs else None
    report_md = ""
    if latest:
        full = storage.load_run(latest["run_id"])
        report_md = (full or {}).get("report_markdown", "")
    adapter = get_adapter()
    return {
        "hydrasentry://project/current": {
            "mode": settings.app_mode,
            "tenant_id": settings.hydra.tenant_id,
            "adapter": "real" if adapter.is_real else "demo",
            "providers_configured": settings.is_real_mode,
        },
        "hydrasentry://findings/latest": storage.list_findings()[:10],
        "hydrasentry://reports/latest": {"run_id": latest["run_id"] if latest else None,
                                          "markdown": report_md},
        "hydrasentry://memory/risky": storage.list_skills(),
        "hydrasentry://policies/current": [
            {"scenario": s["id"], "policy_version": s["policy_version"]}
            for s in scenario_loader.list_scenarios()
        ],
    }


def _shared_secret() -> str:
    """Indirection seam so the configured secret can be overridden in tests."""
    return settings.mcp_shared_secret


def _secret_guard(tool: str, provided_secret: Optional[str]) -> dict[str, Any]:
    """Authorise a write tool. Returns {allowed, warning}.

    Fail-closed (operating rule #3): an UNSET MCP_SHARED_SECRET refuses every
    write tool rather than allowing it, so a misconfigured deploy cannot silently
    accept anonymous writes. The compare is constant-time to avoid leaking the
    secret through response timing.
    """
    if tool not in WRITE_TOOLS:
        return {"allowed": True, "warning": None}
    expected = _shared_secret()
    if not expected:
        # No secret configured -> deny write tools (was previously allowed).
        return {"allowed": False,
                "warning": "MCP_SHARED_SECRET not configured; write tools refused"}
    if provided_secret and hmac.compare_digest(provided_secret, expected):
        return {"allowed": True, "warning": None}
    return {"allowed": False, "warning": "invalid or missing X-MCP-Secret"}


def call_tool(tool: str, args: dict[str, Any],
              provided_secret: Optional[str] = None) -> dict[str, Any]:
    """Dispatch an MCP tool call with secret enforcement on write actions."""
    guard = _secret_guard(tool, provided_secret)
    _log_call(tool, guard["allowed"], guard["warning"])
    if not guard["allowed"]:
        return {"ok": False, "error": "unauthorized", "warning": guard["warning"]}

    args = args or {}
    try:
        result = _dispatch(tool, args)
    except KeyError as exc:
        return {"ok": False, "error": f"not_found: {exc}"}
    except Exception as exc:
        logger.warning("mcp tool %s failed: %s", tool, type(exc).__name__)
        return {"ok": False, "error": type(exc).__name__}

    envelope = {"ok": True, "tool": tool, "result": result}
    if guard["warning"]:
        envelope["warning"] = guard["warning"]
    return envelope


def _dispatch(tool: str, args: dict[str, Any]) -> Any:
    if tool == "scan_context":
        return scenario_engine.run_scenario(args["scenario_id"], attach_skill_scan=False,
                                            attach_self_refine=False)
    if tool == "replay_attack":
        return scenario_engine.run_scenario(args["scenario_id"], attach_skill_scan=True,
                                            attach_self_refine=True)
    if tool == "verify_skill":
        scan = skillmake_scanner.scan_skill(args.get("content", ""), name=args.get("name"))
        storage.save_skill_scan(scan)
        return scan
    if tool == "quarantine_memory":
        adapter = get_adapter()
        return adapter.quarantine_memory(
            args.get("tenant_id", settings.hydra.tenant_id),
            args.get("sub_tenant_id", settings.hydra.sub_tenant_id),
            args["chunk_id"],
        )
    if tool == "generate_report":
        run = storage.load_run(args["run_id"])
        if run is None:
            raise KeyError(args["run_id"])
        return {"run_id": args["run_id"], "markdown": run.get("report_markdown", "")}
    if tool == "schedule_scan":
        return scheduler.schedule_scan(args["name"])
    if tool == "list_findings":
        return storage.list_findings()
    raise KeyError(f"unknown tool {tool}")
