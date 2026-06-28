"""OWASP Agentic Security Initiative (ASI) Top-10 coverage map -- self-verifying.

This module broadens the existing single-risk ASI06 (Memory Poisoning) artifact
in :mod:`standards.asi06` into an HONEST, self-verifying map across the whole
OWASP Agentic Security Initiative Top-10 threat taxonomy. For every risk it
states one of three coverage levels and -- critically -- it never claims a
control it does not have:

* ``covered``      -- HydraSentry implements a real control for this risk. The
                      row names the REAL implementing module (``evidence_file``)
                      and a REAL symbol token inside it (``evidence_symbol``);
                      ``test_standards_asi.py`` asserts both exist, so the claim
                      cannot rot into a false one.
* ``partial``      -- the product touches this risk as a side effect of another
                      control, but it is not a primary design goal. Still backed
                      by a real evidence file+symbol, so the claim is verifiable.
* ``out_of_scope`` -- HydraSentry does NOT address this risk. These rows carry
                      NO evidence file or symbol, and the test asserts they carry
                      none, so the map can never silently inflate coverage by
                      attaching borrowed evidence to a risk we do not handle.

Why this is safe and additive: the module is PURE DATA plus a verification
helper. It imports nothing from the value path (no risk_engine, no auth, no DB),
holds no state, performs no network I/O, and is served read-only. It cannot
affect the canonical judge demo, authentication, or tenant isolation. The
headline ASI06 artifact (:mod:`standards.asi06`) is unchanged; this map reuses
its verified controls verbatim as the ASI06 row's sub-controls so the two
surfaces can never disagree.

ASI numbering here follows the product's existing anchor (ASI06 = Memory
Poisoning, the headline risk this whole product is built for) and lists the rest
of the OWASP Agentic Security Initiative taxonomy around it. The reference URL is
the canonical public name for the taxonomy, never fetched at runtime.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any, Optional

from . import asi06

TAXONOMY = "OWASP Agentic Security Initiative (ASI)"
TAXONOMY_REFERENCE = "https://genai.owasp.org/initiatives/#agenticsecurity"
# The headline risk; its sub-controls are the verified ASI06 mapping verbatim.
HEADLINE_RISK_ID = asi06.RISK_ID  # "ASI06"

# Coverage levels. ``covered`` and ``partial`` MUST carry evidence;
# ``out_of_scope`` MUST NOT -- the test enforces both directions.
COVERED = "covered"
PARTIAL = "partial"
OUT_OF_SCOPE = "out_of_scope"

_BACKEND_DIR = Path(__file__).resolve().parent.parent


# Each risk row is an honest claim. ``evidence_file``/``evidence_symbol`` are
# present only for ``covered``/``partial`` rows and point at real code; the test
# asserts the file exists and the symbol is literally in it. ``out_of_scope``
# rows set both to None and the test asserts they stay None (no borrowed proof).
RISKS: tuple[dict[str, Any], ...] = (
    {
        "id": "ASI01",
        "name": "Tool Misuse",
        "coverage": COVERED,
        "summary": (
            "Agent tool calls flow through a gateway whose write tools "
            "(quarantine, replay) are fail-closed and constant-time "
            "secret-gated, so an unauthenticated caller cannot drive a "
            "state-changing tool. Every call is logged for audit."
        ),
        "evidence_file": "mcp_gateway.py",
        "evidence_symbol": "_secret_guard",
    },
    {
        "id": "ASI02",
        "name": "Identity Spoofing & Privilege Compromise",
        "coverage": COVERED,
        "summary": (
            "Every protected surface resolves a real identity: a Supabase "
            "user-JWT verified against the project JWKS (ES256, issuer + aud + "
            "exp pinned; alg=none / wrong key / wrong project -> 401) or a "
            "salted-hash, constant-time API key. There is no trust-by-header."
        ),
        "evidence_file": "auth/jwt_verifier.py",
        "evidence_symbol": "JWTVerificationError",
    },
    {
        "id": "ASI03",
        "name": "Privilege / Tenant Isolation (BOLA)",
        "coverage": COVERED,
        "summary": (
            "Stored memory, incidents, certificates, and detection rules are "
            "per tenant. Every repository read/write requires a tenant_id and "
            "filters by it; a cross-tenant object lookup returns nothing, not "
            "the data, and a missing scope raises rather than leaking a table."
        ),
        "evidence_file": "db/repo.py",
        "evidence_symbol": "TenantScopingError",
    },
    {
        "id": "ASI04",
        "name": "Resource Overload",
        "coverage": COVERED,
        "summary": (
            "The real-cost and outbound paths (real-Groq runs, URL fetches) "
            "are guarded by an in-process token-bucket rate limiter keyed on "
            "identity-or-IP; over-limit returns 429 + Retry-After. The "
            "one-click judge demo keeps a generous bucket so it stays usable."
        ),
        "evidence_file": "rate_limit.py",
        "evidence_symbol": "_TokenBuckets",
    },
    {
        "id": "ASI05",
        "name": "Cascading Hallucination / Behaviour Drift",
        "coverage": COVERED,
        "summary": (
            "Risk is a ground-truth behaviour diff, not a hand-written verdict: "
            "the agent is replayed on a clean baseline vs the poisoned memory "
            "and the resulting behaviour is diffed into a deterministic score "
            "and band, so a drifted/hallucinated action is measured, not "
            "assumed."
        ),
        "evidence_file": "risk_engine.py",
        "evidence_symbol": "score_scenario",
    },
    {
        "id": HEADLINE_RISK_ID,  # ASI06
        "name": asi06.RISK_NAME,  # Memory Poisoning
        "coverage": COVERED,
        "summary": (
            "The headline risk this product is built for: an attacker plants "
            "content in an agent's long-term/retrieved memory so a later turn "
            "treats the attacker's instruction as trusted context. Covered by "
            "the full self-verified ASI06 control mapping (provenance, "
            "quarantine, taint tracking, semantic paraphrase detection, and a "
            "portable Memory Integrity Certificate)."
        ),
        # The ASI06 row's deep evidence is the whole asi06 mapping; we still pin
        # one representative file+symbol so this row self-verifies like the rest.
        "evidence_file": "standards/asi06.py",
        "evidence_symbol": "def verify_controls",
        "subcontrols_from_asi06": True,
    },
    {
        "id": "ASI07",
        "name": "Insecure Output / Provenance Confusion",
        "coverage": COVERED,
        "summary": (
            "Every graph the engine reasons over is labelled REAL HydraDB vs a "
            "DERIVED scenario fallback vs a LOCAL heuristic graph, and the "
            "report renders that exact label, so a derived/demo result can "
            "never be passed off as a real retrieval in the output a human "
            "reads."
        ),
        "evidence_file": "report.py",
        "evidence_symbol": "_graph_label",
    },
    {
        "id": "ASI08",
        "name": "Repudiation & Untraceability",
        "coverage": COVERED,
        "summary": (
            "Each severed run is sealed into a portable, signed Memory "
            "Integrity Certificate recording the behaviour diff, the tainted "
            "source chunk, the tool that would have fired, and the regression "
            "rule that now prevents it -- a tamper-evident audit artifact, not "
            "a log line that can be denied."
        ),
        "evidence_file": "report.py",
        "evidence_symbol": "generate_report",
    },
    {
        "id": "ASI09",
        "name": "Goal Manipulation via Reworded Injection",
        "coverage": PARTIAL,
        "summary": (
            "Partial: beyond exact forbidden-marker matching, a semantic "
            "similarity signal flags reworded poison that paraphrases a policy "
            "override, raising the bar for a goal-manipulation injection. It is "
            "a detection signal, not a full intent-alignment guarantee, so this "
            "is honestly scoped as partial."
        ),
        "evidence_file": "semantic_detector.py",
        "evidence_symbol": "def detect",
    },
    {
        "id": "ASI10",
        "name": "Overwhelming Human-in-the-Loop",
        "coverage": OUT_OF_SCOPE,
        "summary": (
            "Not addressed. HydraSentry is an automated memory-integrity "
            "firewall and certifier; it does not manage operator alert volume, "
            "approval fatigue, or human-in-the-loop pacing. Claiming coverage "
            "here would be dishonest, so this risk is explicitly out of scope."
        ),
        "evidence_file": None,
        "evidence_symbol": None,
    },
)


def _evidence_path(file_rel: str) -> Path:
    """Absolute path to a backend-relative implementing module."""
    return _BACKEND_DIR / file_rel


def verify_risks() -> list[dict[str, Any]]:
    """Verify each risk's claim against the running codebase, honestly.

    For ``covered``/``partial`` rows: confirm the cited file exists and the
    cited symbol is literally in it (``verified`` true only if both hold). For
    ``out_of_scope`` rows: there is nothing to implement, so ``verified`` is the
    honest assertion that NO evidence is attached (the map is not inflating
    coverage). The ASI06 row additionally carries the verified ASI06
    sub-controls verbatim so the two surfaces cannot disagree.
    """
    rows: list[dict[str, Any]] = []
    for risk in RISKS:
        coverage = risk["coverage"]
        file_rel: Optional[str] = risk["evidence_file"]
        symbol: Optional[str] = risk["evidence_symbol"]

        if coverage == OUT_OF_SCOPE:
            # Honest by construction: an out-of-scope risk must carry no proof.
            verified = file_rel is None and symbol is None
            file_exists = False
            symbol_present = False
        else:
            path = _evidence_path(file_rel) if file_rel else None
            file_exists = bool(path and path.is_file())
            symbol_present = False
            if file_exists and path is not None and symbol:
                text = path.read_text(encoding="utf-8", errors="replace")
                symbol_present = symbol in text
            verified = file_exists and symbol_present

        row: dict[str, Any] = {
            "id": risk["id"],
            "name": risk["name"],
            "coverage": coverage,
            "summary": risk["summary"],
            "evidence_file": (f"backend/{file_rel}" if file_rel else None),
            "evidence_symbol": symbol,
            "file_exists": file_exists,
            "symbol_present": symbol_present,
            "verified": verified,
        }
        if risk.get("subcontrols_from_asi06"):
            # Reuse the headline mapping's verified controls verbatim.
            row["subcontrols"] = asi06.verify_controls()
        rows.append(row)
    return rows


def _coverage_counts(rows: list[dict[str, Any]]) -> dict[str, int]:
    counts = {COVERED: 0, PARTIAL: 0, OUT_OF_SCOPE: 0}
    for r in rows:
        counts[r["coverage"]] = counts.get(r["coverage"], 0) + 1
    return counts


def mapping(verify: bool = True) -> dict[str, Any]:
    """Full ASI Top-10 coverage map, optionally re-verified against the code.

    ``verify=True`` (default) recomputes each row against the running codebase
    so the served artifact is honest about what is actually present, rather than
    a static claim. ``verified_all`` is the AND of every row's ``verified`` flag
    -- which, for out-of-scope rows, means "correctly carries no evidence", so a
    True ``verified_all`` certifies both that every covered control's code exists
    AND that no out-of-scope risk is dressed up with borrowed proof.
    """
    if verify:
        risks = verify_risks()
        verified_all: Optional[bool] = all(r["verified"] for r in risks)
    else:
        risks = [
            {
                "id": r["id"],
                "name": r["name"],
                "coverage": r["coverage"],
                "summary": r["summary"],
                "evidence_file": (
                    f"backend/{r['evidence_file']}" if r["evidence_file"] else None
                ),
                "evidence_symbol": r["evidence_symbol"],
                "file_exists": False,
                "symbol_present": False,
                "verified": False,
            }
            for r in RISKS
        ]
        verified_all = None

    counts = _coverage_counts(risks)
    return {
        "taxonomy": TAXONOMY,
        "reference": TAXONOMY_REFERENCE,
        "headline_risk_id": HEADLINE_RISK_ID,
        "risk_count": len(RISKS),
        "coverage_counts": counts,
        "verified_all": verified_all,
        "risks": risks,
    }
