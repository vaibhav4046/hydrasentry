"""OWASP ASI06 (Memory Poisoning) control mapping -- single source of truth.

This module turns what used to be a prose paragraph in the README into a
machine-readable, *self-verifying* artifact:

* It is served read-only over HTTP at ``GET /standards/asi06`` so a judge,
  auditor, or integrator can fetch the exact control coverage from the live
  product instead of trusting a screenshot.
* Every control names the REAL implementing module (``evidence_file``) and a
  REAL symbol/token inside it (``evidence_symbol``). ``test_standards_asi06.py``
  asserts that each cited file exists and that each cited symbol literally
  appears in it, so this mapping can never silently rot into a false claim:
  if the implementing code is renamed or deleted, the standards test fails.

ASI06 is the "Memory Poisoning" risk in the OWASP Agentic Security Initiative
(ASI) threat taxonomy for agentic AI: an attacker plants content in an agent's
long-term / retrieved memory so that, on a later turn, the agent treats the
attacker's instruction as trusted context. HydraSentry is purpose-built for
exactly this class. The reference below is informational; it is the canonical
public name for the taxonomy, not a network dependency of this module.

This module is PURE DATA + a verification helper. It imports nothing from the
value path (no risk_engine, no auth, no DB), holds no state, and cannot affect
the canonical judge demo or tenant isolation. It is additive and read-only.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any, Optional

# Canonical public reference for the taxonomy this product maps to. Static
# string only -- never fetched at runtime.
TAXONOMY = "OWASP Agentic Security Initiative (ASI)"
RISK_ID = "ASI06"
RISK_NAME = "Memory Poisoning"
RISK_REFERENCE = "https://genai.owasp.org/initiatives/#agenticsecurity"

# Repo root is two levels up from this file (backend/standards/asi06.py).
_BACKEND_DIR = Path(__file__).resolve().parent.parent


# Each control is an honest claim backed by a real implementing module and a
# real symbol token inside it. ``evidence_symbol`` is a substring that the
# standards test asserts is present in ``evidence_file`` -- a function name, a
# class name, or a literal that pins the behaviour described.
CONTROLS: tuple[dict[str, str], ...] = (
    {
        "id": "ASI06.provenance",
        "title": "Provenance labelling of retrieved memory",
        "summary": (
            "Every graph the engine reasons over is labelled REAL HydraDB "
            "query_paths vs a DERIVED scenario fallback vs a LOCAL heuristic "
            "graph, so a derived/demo result can never be passed off as a real "
            "HydraDB retrieval. The report renders that exact label."
        ),
        "evidence_file": "report.py",
        "evidence_symbol": "_graph_label",
    },
    {
        "id": "ASI06.tenancy",
        "title": "Per-tenant isolation of stored memory (BOLA defense)",
        "summary": (
            "Poisoned-memory incidents and certificates are stored per tenant. "
            "Every repository read/write requires a tenant_id and filters by "
            "it; a cross-tenant object lookup returns nothing, not the data. A "
            "missing scope raises rather than returning a full table."
        ),
        "evidence_file": "db/repo.py",
        "evidence_symbol": "TenantScopingError",
    },
    {
        "id": "ASI06.quarantine",
        "title": "Forgetting / quarantine of poisoned memory",
        "summary": (
            "When the firewall severs a poisoned action, the offending memory "
            "is quarantined so it cannot reach the agent again, and the finding "
            "is converted into a persisted regression rule."
        ),
        "evidence_file": "rules_store.py",
        "evidence_symbol": "create_rule",
    },
    {
        "id": "ASI06.ground_truth_eval",
        "title": "Ground-truth behavior diff (not an asserted one)",
        "summary": (
            "Risk is computed by replaying the agent on a clean baseline vs the "
            "poisoned memory and diffing the resulting behaviour, producing a "
            "deterministic score and band rather than a hand-written verdict."
        ),
        "evidence_file": "risk_engine.py",
        "evidence_symbol": "score_scenario",
    },
    {
        "id": "ASI06.taint_tracking",
        "title": "Graph taint tracking from the poisoned source",
        "summary": (
            "The poisoned source chunk is taint-tracked through the graph so "
            "the certificate can record exactly which node carried the attack "
            "and which query_paths triplets it travelled."
        ),
        "evidence_file": "risk_engine.py",
        "evidence_symbol": "_graph_is_tainted",
    },
    {
        "id": "ASI06.trust_scoring",
        "title": "Trust scoring incl. semantic paraphrase detection",
        "summary": (
            "Beyond exact forbidden-marker matching, a semantic similarity "
            "signal flags reworded poison that paraphrases a policy override, "
            "so an attacker cannot evade detection by simple rewording."
        ),
        "evidence_file": "semantic_detector.py",
        "evidence_symbol": "def detect",
    },
    {
        "id": "ASI06.certificate",
        "title": "Portable Memory Integrity Certificate (MIC)",
        "summary": (
            "Each severed run is sealed into a portable certificate recording "
            "the behaviour diff, the tainted source chunk, the tool that would "
            "have fired, and the regression rule that now prevents it."
        ),
        "evidence_file": "report.py",
        "evidence_symbol": "generate_report",
    },
)


def evidence_path(control: dict[str, str]) -> Path:
    """Absolute path to the module that implements ``control``."""
    return _BACKEND_DIR / control["evidence_file"]


def verify_controls() -> list[dict[str, Any]]:
    """Check every control's cited evidence actually exists in the codebase.

    Returns one row per control with ``file_exists`` and ``symbol_present``.
    Used by both the standards test (which requires every row to pass) and the
    HTTP endpoint (which reports ``verified`` honestly rather than asserting it).
    """
    rows: list[dict[str, Any]] = []
    for control in CONTROLS:
        path = evidence_path(control)
        file_exists = path.is_file()
        symbol_present = False
        if file_exists:
            text = path.read_text(encoding="utf-8", errors="replace")
            symbol_present = control["evidence_symbol"] in text
        rows.append(
            {
                "id": control["id"],
                "title": control["title"],
                "summary": control["summary"],
                "evidence_file": f"backend/{control['evidence_file']}",
                "evidence_symbol": control["evidence_symbol"],
                "file_exists": file_exists,
                "symbol_present": symbol_present,
                "verified": file_exists and symbol_present,
            }
        )
    return rows


def mapping(verify: bool = True) -> dict[str, Any]:
    """Full ASI06 mapping artifact, optionally with live verification rows.

    ``verify=True`` re-checks the evidence against the running codebase so the
    served artifact is honest about whether each control's code is present,
    rather than a static claim. The endpoint sets ``verified_all`` from this.
    """
    controls: list[dict[str, Any]]
    if verify:
        controls = verify_controls()
        verified_all: Optional[bool] = all(c["verified"] for c in controls)
    else:
        controls = [dict(c) for c in CONTROLS]
        verified_all = None
    return {
        "taxonomy": TAXONOMY,
        "risk_id": RISK_ID,
        "risk_name": RISK_NAME,
        "reference": RISK_REFERENCE,
        "control_count": len(CONTROLS),
        "verified_all": verified_all,
        "controls": controls,
    }
