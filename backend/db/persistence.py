"""Persistence service: bridges real run results into the tenant-scoped store.

This is the wiring between the real value path (``/runs/real``, and real
findings from ``/scan/local``) and the Postgres app DB. When a run produces a
result it is persisted as an ``Incident``; when the run is blocked/high-risk a
Memory Integrity ``Certificate`` is bound to it. Every action also writes an
``AuditLog`` row. All writes are tenant-scoped through ``db.repo`` (BOLA-safe).

Fail-closed, honestly (operating rules #1, #3): if the database is unreachable
the run STILL returns to the caller, but the persistence outcome is surfaced as
``{persisted: false, error, kind}`` and logged. We never silently swallow the
error and never fabricate a persisted record. The certificate signature reuses
the existing real MIC HMAC signer; nothing here is mocked.
"""
from __future__ import annotations

import logging
from typing import Any, Optional

from db.repo import (
    AuditLogRepo,
    CertificateRepo,
    IncidentRepo,
    TenantRepo,
)

logger = logging.getLogger("hydrasentry.persistence")

DEFAULT_TENANT_SLUG = "demo"

# Decisions that warrant a bound integrity certificate.
_CERTIFIED_DECISIONS = {"block", "quarantine"}
_CERTIFIED_BANDS = {"HIGH", "CRITICAL"}


def resolve_tenant_slug(header_value: Optional[str]) -> str:
    """Map an ``X-Tenant-Slug`` header to a slug, defaulting to ``demo``.

    Phase 2 replaces this with the authenticated user's tenant. The value is
    sanitised to a conservative slug charset so it can never be used to smuggle
    SQL or odd characters into the lookup.
    """
    if not header_value:
        return DEFAULT_TENANT_SLUG
    slug = "".join(
        ch for ch in header_value.strip().lower() if ch.isalnum() or ch in "-_"
    )
    return slug or DEFAULT_TENANT_SLUG


def _decision_from_result(result: dict[str, Any], risk: dict[str, Any]) -> str:
    """Derive a firewall decision from the result/risk if not explicit."""
    explicit = result.get("firewall", {}).get("decision")
    if explicit:
        return explicit
    band = (risk.get("band") or "LOW").upper()
    if band in {"CRITICAL", "HIGH"}:
        return "block"
    if band == "MEDIUM":
        return "warn"
    return "allow"


def _incident_fields(result: dict[str, Any]) -> dict[str, Any]:
    """Map a real-run / scan result dict to Incident column values."""
    risk = result.get("risk", {}) or {}
    graph = result.get("graph", {}) or {}
    decision = _decision_from_result(result, risk)
    return {
        "scenario": result.get("scenario_id") or result.get("task") or "unknown",
        "baseline_answer": result.get("baseline_answer", "") or "",
        "poisoned_answer": result.get("poisoned_answer", "") or "",
        "risk_score": int(risk.get("score", 0) or 0),
        "band": (risk.get("band") or "LOW"),
        "decision": decision,
        "attack_type": risk.get("attack_type", "unknown") or "unknown",
        "graph_source": graph.get("source", "derived_scenario_graph")
        or "derived_scenario_graph",
        "confidence": float(risk.get("confidence", 0.0) or 0.0),
        "llm_provider": result.get("llm_provider", "deterministic")
        or "deterministic",
        "mode": result.get("mode", "demo") or "demo",
    }


def _should_certify(decision: str, band: str) -> bool:
    return decision in _CERTIFIED_DECISIONS or band.upper() in _CERTIFIED_BANDS


def _build_certificate(incident_fields: dict[str, Any]) -> dict[str, Any]:
    """Issue a real MIC for the incident using the existing HMAC signer."""
    from hydrasentry_mcp.certificate import generate_certificate

    scan_shape = {
        "name": incident_fields["scenario"],
        "band": incident_fields["band"],
        "risk_score": incident_fields["risk_score"],
        "status": incident_fields["decision"],
        "findings": [],
    }
    return generate_certificate(scan_shape)


def persist_run(
    result: dict[str, Any],
    tenant_slug: str = DEFAULT_TENANT_SLUG,
    actor: str = "system",
) -> dict[str, Any]:
    """Persist a run result as an Incident (+ Certificate when blocked) and an
    AuditLog row, all under ``tenant_slug``.

    Returns ``{persisted: bool, incident_id?, certificate_id?, tenant_id?,
    error?, kind?}``. On any DB error it returns ``persisted: false`` with the
    error surfaced -- never raises into the request path, never fabricates.
    """
    try:
        tenant = TenantRepo.ensure(tenant_slug, f"{tenant_slug} tenant")
        fields = _incident_fields(result)
        incident = IncidentRepo.create(tenant.id, **fields)

        cert_id: Optional[str] = None
        if _should_certify(fields["decision"], fields["band"]):
            cert = _build_certificate(fields)
            payload = cert.get("payload", {})
            mic_id = cert.get("digest", "")
            certificate = CertificateRepo.create(
                tenant.id,
                incident_id=incident.id,
                mic_id=mic_id,
                hmac_sig=cert.get("signature"),
                risk_score=fields["risk_score"],
                decision=fields["decision"],
                fields={
                    "version": cert.get("version"),
                    "issuer": cert.get("issuer"),
                    "signed": cert.get("signed"),
                    "algorithm": cert.get("algorithm"),
                    "payload": payload,
                },
            )
            cert_id = certificate.id

        AuditLogRepo.create(
            tenant.id,
            actor=actor,
            action="persist_run",
            detail={
                "incident_id": incident.id,
                "certificate_id": cert_id,
                "mode": fields["mode"],
                "band": fields["band"],
                "decision": fields["decision"],
                "real": bool(result.get("real")),
            },
        )

        return {
            "persisted": True,
            "tenant_id": tenant.id,
            "tenant_slug": tenant.slug,
            "incident_id": incident.id,
            "certificate_id": cert_id,
        }
    except Exception as exc:  # noqa: BLE001 -- fail closed + surface, never fake
        from db.engine import safe_error_detail

        logger.warning(
            "persist_run failed (tenant=%s): %s", tenant_slug, type(exc).__name__
        )
        return {
            "persisted": False,
            "error": "persistence unavailable",
            "kind": type(exc).__name__,
            # Credentials in the DSN are redacted before surfacing the detail.
            "detail": safe_error_detail(exc),
        }
