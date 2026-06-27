"""MCP tool schemas for the HydraSentry server.

Each entry follows the MCP ``tools/list`` shape: ``name``, ``description``, and a
JSON-Schema ``inputSchema``. The ``handler`` maps each tool name to the real
implementation in ``tools.py``. Kept separate from the JSON-RPC framing so the
tool surface is easy to read and test.
"""
from __future__ import annotations

from typing import Any, Callable

from . import tools

# Each tool: name -> (description, inputSchema, handler). Handlers receive the
# parsed ``arguments`` dict and return a plain dict.
TOOLS: dict[str, dict[str, Any]] = {
    "scan_skill": {
        "description": (
            "Statically scan a SKILL.md (agent skill) markdown string for unsafe "
            "instructions (hidden prompt injection, secret/.env access, dangerous "
            "shell, exfiltration, silent refund approval, user deception, "
            "description/body mismatch). Returns a risk band (LOW/MEDIUM/HIGH/"
            "CRITICAL), a 0-100 score, per-line findings, and a recommended fix."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "skill_markdown": {
                    "type": "string",
                    "description": "The full SKILL.md markdown to scan.",
                },
                "name": {
                    "type": "string",
                    "description": "Optional skill name override for the report.",
                },
            },
            "required": ["skill_markdown"],
        },
        "handler": lambda a: tools.scan_skill(a.get("skill_markdown", ""), a.get("name")),
    },
    "scan_skill_url": {
        "description": (
            "Fetch a SKILL.md from the skillmake.xyz marketplace by slug, then run "
            "the same safety scan as scan_skill. Public unauthenticated GET; falls "
            "back to a shipped offline copy when present. Fails closed with an "
            "honest error if the skill cannot be fetched."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "slug": {
                    "type": "string",
                    "description": "skillmake.xyz slug, e.g. 'firecrawl-mcp'.",
                },
            },
            "required": ["slug"],
        },
        "handler": lambda a: tools.scan_skill_url(a.get("slug", "")),
    },
    "scan_context": {
        "description": (
            "Run HydraSentry's poison/integrity scan on a list of agent memories. "
            "Ingests them into a transparent local heuristic graph, detects "
            "poisoned/stale memories, traces the taint path to the unsafe action, "
            "and scores the risk. Returns risk band, tainted path, firewall "
            "decision, and findings. No HydraDB key required."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "memories": {
                    "type": "array",
                    "description": "List of memory objects.",
                    "items": {
                        "type": "object",
                        "properties": {
                            "id": {"type": "string"},
                            "text": {"type": "string"},
                            "trust": {
                                "type": "string",
                                "enum": ["trusted", "poisoned", "stale"],
                            },
                            "relations": {"type": "array"},
                        },
                        "required": ["text"],
                    },
                },
                "task": {"type": "string", "description": "Optional task the agent is performing."},
                "policy": {"type": "string", "description": "Optional approved policy text."},
            },
            "required": ["memories"],
        },
        "handler": lambda a: tools.scan_context(a.get("memories", []), a.get("task"), a.get("policy")),
    },
    "query_memory_graph": {
        "description": (
            "Run a real live HydraDB query against the pre-warmed owned tenant and "
            "return the graph (nodes, edges, query_paths) with the tainted path. "
            "Requires a HydraDB key in the server environment; without it, returns "
            "an honest 'no HydraDB key' / fail-closed message (never a fake graph)."
        ),
        "inputSchema": {"type": "object", "properties": {}},
        "handler": lambda a: tools.query_memory_graph(),
    },
    "run_memory_attack": {
        "description": (
            "Run HydraSentry's real memory-poisoning attack: query clean vs "
            "poisoned owned sub-tenants in HydraDB, run the real Groq agent on "
            "each, and score baseline vs poisoned answers with the risk engine and "
            "LLM judge. Requires HydraDB and Groq keys; without them the backend "
            "returns its honestly-labelled deterministic fallback (real:false)."
        ),
        "inputSchema": {"type": "object", "properties": {}},
        "handler": lambda a: tools.run_memory_attack(),
    },
    "generate_certificate": {
        "description": (
            "Issue a Memory Integrity Certificate over a scan result (from "
            "scan_skill or scan_context). The certificate binds the verdict with a "
            "SHA-256 digest and, when HYDRASENTRY_CERT_SECRET is set, an HMAC-"
            "SHA256 signature. Tamper-evident and offline-verifiable."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "scan": {
                    "type": "object",
                    "description": "A scan_skill or scan_context result object.",
                },
            },
            "required": ["scan"],
        },
        "handler": lambda a: tools.generate_certificate(a.get("scan", {})),
    },
    "verify_certificate": {
        "description": (
            "Verify a Memory Integrity Certificate. Recomputes the digest over the "
            "embedded payload and (when signed) the HMAC, constant-time comparing "
            "both. Returns valid/invalid with a concrete reason. Fail-closed: any "
            "tampering or wrong secret yields valid:false."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "certificate": {
                    "type": "object",
                    "description": "A certificate object from generate_certificate.",
                },
            },
            "required": ["certificate"],
        },
        "handler": lambda a: tools.verify_certificate(a.get("certificate", {})),
    },
}


def tool_list() -> list[dict[str, Any]]:
    """The MCP tools/list payload: name, description, inputSchema (no handler)."""
    return [
        {"name": name, "description": spec["description"], "inputSchema": spec["inputSchema"]}
        for name, spec in TOOLS.items()
    ]


def get_handler(name: str) -> Callable[[dict[str, Any]], dict[str, Any]] | None:
    spec = TOOLS.get(name)
    return spec["handler"] if spec else None
