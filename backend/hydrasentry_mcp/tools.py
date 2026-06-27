"""HydraSentry MCP tool implementations.

Each function here calls the EXISTING real backend module and returns a plain
dict. Nothing is stubbed. Tools that depend on a key or a live service fail
closed with an honest message (``ok: false`` + ``error``); they never fabricate
a result. The MCP server layer (``server.py``) only handles JSON-RPC framing and
schema advertising -- all the real work lives here.

Import path: the backend dir (this package's parent) is added to ``sys.path`` by
``server.py`` before these are imported, so the engine modules
(``skillmake_scanner`` etc.) resolve regardless of the working directory the MCP
client launches us from.
"""
from __future__ import annotations

from typing import Any

from . import certificate

# Engine modules. Imported lazily-safe: server.py fixes sys.path first.
import skillmake_scanner
import skillmake_marketplace
from adapters.local_scan import run_local_scan


def scan_skill(skill_markdown: str, name: str | None = None) -> dict[str, Any]:
    """Real SKILL.md safety scan via skillmake_scanner.scan_skill."""
    if not isinstance(skill_markdown, str) or not skill_markdown.strip():
        return {"ok": False, "error": "skill_markdown must be a non-empty string"}
    scan = skillmake_scanner.scan_skill(skill_markdown, name=name)
    return {"ok": True, **scan}


def scan_skill_url(slug: str) -> dict[str, Any]:
    """Pull a SKILL.md from skillmake.xyz then run the real scan.

    Fails closed: if the marketplace is unreachable and nothing is cached, returns
    the marketplace error untouched (never a fabricated scan).
    """
    if not isinstance(slug, str) or not slug.strip():
        return {"ok": False, "error": "slug must be a non-empty string"}
    fetched = skillmake_marketplace.fetch_skill(slug)
    if not fetched.get("ok"):
        return {
            "ok": False,
            "error": fetched.get("error", "could not fetch skill"),
            "slug": fetched.get("slug"),
            "url": fetched.get("url"),
            "source": fetched.get("source"),
        }
    scan = skillmake_scanner.scan_skill(fetched["content"], name=slug)
    return {
        "ok": True,
        "slug": fetched["slug"],
        "url": fetched["url"],
        "source": fetched["source"],  # "live" | "cache"
        **scan,
    }


def scan_context(memories: list[dict[str, Any]],
                 task: str | None = None,
                 policy: str | None = None) -> dict[str, Any]:
    """Real local poison/integrity scan via the LocalGraphAdapter pipeline.

    ``memories`` is a list of ``{id?, text, trust?, relations?}`` dicts. Runs the
    same ingest -> graph -> taint -> risk pipeline the scenario engine uses,
    returning the risk band, the tainted path, and the flagged findings. The
    graph is a transparent local heuristic graph (honestly labelled), not real
    HydraDB -- use ``query_memory_graph`` for the live HydraDB path.
    """
    if not isinstance(memories, list) or not memories:
        return {"ok": False, "error": "memories must be a non-empty list of objects"}
    payload: dict[str, Any] = {"memories": memories}
    if task:
        payload["task"] = task
    if policy:
        payload["policy"] = policy
    return run_local_scan(payload)


def query_memory_graph() -> dict[str, Any]:
    """Real live HydraDB query_paths against the pre-warmed owned tenant.

    Requires a HydraDB key in env. If absent (or HydraDB is unreachable / returns
    no triplets), returns an honest ``ok: false`` with ``fallback: "captured"`` --
    never a fabricated graph. Imported lazily so the rest of the server (and the
    key-free tools) load even if hydra_client's heavier deps are unavailable.
    """
    try:
        import real_graph
    except Exception as exc:  # noqa: BLE001 -- honest import failure
        return {"ok": False, "error": f"real_graph unavailable: {type(exc).__name__}"}
    return real_graph.real_query_graph()


def run_memory_attack() -> dict[str, Any]:
    """Real Groq-agent memory-poisoning attack run via real_run.run_real.

    Queries the clean and poisoned owned sub-tenants, runs the real Groq agent on
    each, and scores baseline vs poisoned with the real risk engine + judge.
    Requires HydraDB AND Groq keys. Without them (or on any overrun) the backend
    returns its labelled ``mode: "deterministic_fallback"`` result -- which we
    surface honestly (``real: false``), never dressed up as a live run.
    """
    try:
        import real_run
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": f"real_run unavailable: {type(exc).__name__}"}
    return real_run.run_real()


def generate_certificate(scan: dict[str, Any]) -> dict[str, Any]:
    """Issue a Memory Integrity Certificate over a real scan result.

    Pass the result of ``scan_skill`` or ``scan_context``. Returns a tamper-
    evident (and, when HYDRASENTRY_CERT_SECRET is set, HMAC-signed) record.
    """
    if not isinstance(scan, dict) or not scan:
        return {"ok": False, "error": "scan must be a scan_skill/scan_context result object"}
    cert = certificate.generate_certificate(scan)
    return {"ok": True, "certificate": cert}


def verify_certificate(cert: dict[str, Any]) -> dict[str, Any]:
    """Verify a Memory Integrity Certificate. Honest, fail-closed."""
    if not isinstance(cert, dict) or not cert:
        return {"ok": False, "error": "cert must be a certificate object"}
    result = certificate.verify_certificate(cert)
    return {"ok": True, **result}
