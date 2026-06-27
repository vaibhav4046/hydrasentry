"""Per-tenant detection-rule store service (Phase 5).

A signed-in user manages their own regression / poison signatures, which feed
THEIR tenant's semantic detection path. This module is the service layer between
the HTTP endpoints (in ``main.py``) and the tenant-scoped repo (``db.repo``):

* CRUD over a tenant's ``RegressionRule`` rows (BOLA-safe via the scoped repo).
* Embedding a new rule's ``signature_text`` through the real semantic detector
  so it ACTUALLY affects that tenant's detection. If embeddings are unavailable
  the rule is stored but labelled ``pending`` (``embedded=false``) -- fail-closed
  and honest (operating rule #1), never a fabricated "active" rule.
* Export / import of a tenant's ruleset as JSON (schema-validated, dedup by
  signature on import).
* ``enabled_signature_texts(tenant_id)`` -- the enabled+embedded signature texts
  for a tenant, consumed by the scan path so a tenant's rules are consulted.

Every operation is tenant-scoped: a cross-tenant id collapses to "not found",
never another tenant's row.
"""
from __future__ import annotations

import logging
from typing import Any, Optional

import semantic_detector
from db.repo import AuditLogRepo, RegressionRuleRepo

logger = logging.getLogger("hydrasentry.rules_store")

# Validation bounds + allowed enums. Kept conservative so an import or a create
# cannot smuggle oversized / odd values into the store.
_MAX_NAME = 200
_MAX_SIGNATURE = 2000
_MAX_IMPORT_RULES = 500
_VALID_SEVERITY = {"LOW", "MEDIUM", "HIGH", "CRITICAL"}
_DEFAULT_SEVERITY = "MEDIUM"
_DEFAULT_ATTACK_TYPE = "memory_poisoning"


class RuleValidationError(ValueError):
    """Raised when a rule payload fails schema validation (-> 400 at the edge)."""


def rule_dto(row: Any) -> dict[str, Any]:
    """A safe, serialisable view of a rule row for the API."""
    return {
        "id": row.id,
        "tenant_id": row.tenant_id,
        "name": row.name,
        "signature_text": getattr(row, "signature_text", "") or "",
        "attack_type": getattr(row, "attack_type", _DEFAULT_ATTACK_TYPE) or _DEFAULT_ATTACK_TYPE,
        "severity": getattr(row, "severity", _DEFAULT_SEVERITY) or _DEFAULT_SEVERITY,
        "enabled": bool(getattr(row, "enabled", True)),
        "embedded": bool(getattr(row, "embedded", False)),
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


def _clean_severity(value: Optional[str]) -> str:
    sev = (value or _DEFAULT_SEVERITY).strip().upper()
    return sev if sev in _VALID_SEVERITY else _DEFAULT_SEVERITY


def _validate_create_fields(payload: dict[str, Any]) -> dict[str, Any]:
    """Validate + normalise a create/import rule payload. Raises on bad input."""
    name = str(payload.get("name") or "").strip()
    signature_text = str(payload.get("signature_text") or "").strip()
    if not name:
        raise RuleValidationError("rule name is required")
    if not signature_text:
        raise RuleValidationError("signature_text is required")
    if len(name) > _MAX_NAME:
        raise RuleValidationError(f"name exceeds {_MAX_NAME} chars")
    if len(signature_text) > _MAX_SIGNATURE:
        raise RuleValidationError(f"signature_text exceeds {_MAX_SIGNATURE} chars")
    attack_type = str(payload.get("attack_type") or _DEFAULT_ATTACK_TYPE).strip()[:_MAX_NAME]
    enabled = payload.get("enabled", True)
    return {
        "name": name,
        "signature_text": signature_text,
        "attack_type": attack_type or _DEFAULT_ATTACK_TYPE,
        "severity": _clean_severity(payload.get("severity")),
        "enabled": bool(enabled) if enabled is not None else True,
    }


def _try_embed(signature_text: str) -> bool:
    """Embed a rule's signature so it actually affects detection. Returns True if
    embedded, False if embeddings were unavailable (rule stored as pending).

    Reuses the detector's own embed path; on any unavailability it returns False
    rather than raising, so a create still succeeds but is honestly labelled
    pending (fail-closed, never a fake "active" rule)."""
    try:
        key = semantic_detector._provider_key()
        if not key:
            return False
        from config import PROVIDERS

        provider = PROVIDERS.get("gemini")
        if provider is None:
            return False
        if not semantic_detector.is_enabled():
            return False
        return semantic_detector._embed_one(signature_text, key, provider.base_url) is not None
    except Exception:  # noqa: BLE001 -- embedding is best-effort; pending on error
        logger.warning("rule embed check failed; storing as pending")
        return False


def list_rules(tenant_id: str) -> list[dict[str, Any]]:
    """The caller tenant's rules, newest first (BOLA-safe)."""
    rows = RegressionRuleRepo.list(tenant_id)
    return [rule_dto(r) for r in rows]


def create_rule(tenant_id: str, payload: dict[str, Any],
                actor: str = "user") -> dict[str, Any]:
    """Create a rule for the tenant. Embeds the signature so it affects detection;
    if embeddings are unavailable the rule is stored as ``pending``."""
    fields = _validate_create_fields(payload)
    embedded = _try_embed(fields["signature_text"]) if fields["enabled"] else False
    row = RegressionRuleRepo.create(
        tenant_id,
        name=fields["name"],
        signature=fields["signature_text"],  # mirror into the legacy column
        signature_text=fields["signature_text"],
        attack_type=fields["attack_type"],
        severity=fields["severity"],
        enabled=fields["enabled"],
        embedded=embedded,
    )
    AuditLogRepo.create(
        tenant_id, actor=actor, action="rule_created",
        detail={"rule_id": row.id, "embedded": embedded},
    )
    dto = rule_dto(row)
    if fields["enabled"] and not embedded:
        dto["pending_reason"] = (
            "embeddings unavailable; rule stored but not yet active in detection"
        )
    return dto


def update_rule(tenant_id: str, rule_id: str,
                payload: dict[str, Any], actor: str = "user") -> Optional[dict[str, Any]]:
    """Patch a rule the tenant owns (toggle enabled / edit fields). Returns the
    updated DTO, or None if the rule is not in this tenant (cross-tenant -> 404).

    Re-embeds when the signature text changes or a disabled+unembedded rule is
    enabled, so a freshly-enabled rule becomes active (or honestly pending)."""
    from db.engine import get_session

    session = get_session()
    try:
        row = RegressionRuleRepo.get(tenant_id, rule_id, session=session)
        if row is None:
            return None
        changed_signature = False
        if "name" in payload and payload["name"] is not None:
            name = str(payload["name"]).strip()
            if name:
                row.name = name[:_MAX_NAME]
        if "signature_text" in payload and payload["signature_text"] is not None:
            sig = str(payload["signature_text"]).strip()
            if sig:
                if len(sig) > _MAX_SIGNATURE:
                    raise RuleValidationError(f"signature_text exceeds {_MAX_SIGNATURE} chars")
                if sig != (row.signature_text or ""):
                    row.signature_text = sig
                    row.signature = sig
                    changed_signature = True
        if "attack_type" in payload and payload["attack_type"]:
            row.attack_type = str(payload["attack_type"]).strip()[:_MAX_NAME]
        if "severity" in payload and payload["severity"] is not None:
            row.severity = _clean_severity(payload["severity"])
        if "enabled" in payload and payload["enabled"] is not None:
            row.enabled = bool(payload["enabled"])

        # Re-embed if the signature changed, or if an enabled rule is not yet
        # embedded (e.g. it was created while embeddings were down, now back).
        if row.enabled and (changed_signature or not row.embedded):
            row.embedded = _try_embed(row.signature_text or "")
        if not row.enabled:
            # A disabled rule is not consulted; leave embedded flag as-is.
            pass

        session.add(row)
        session.flush()
        session.commit()
        # Build the DTO AFTER a successful commit (the session keeps attributes
        # live via expire_on_commit=False), so a commit failure surfaces as an
        # exception rather than returning a success DTO for a rolled-back write.
        dto = rule_dto(row)
    finally:
        session.close()

    AuditLogRepo.create(
        tenant_id, actor=actor, action="rule_updated",
        detail={"rule_id": rule_id},
    )
    return dto


def delete_rule(tenant_id: str, rule_id: str, actor: str = "user") -> bool:
    """Delete a rule the tenant owns. Returns True if deleted, False if the rule
    is not in this tenant (cross-tenant delete -> False -> 404 at the edge)."""
    from db.engine import get_session

    session = get_session()
    try:
        row = RegressionRuleRepo.get(tenant_id, rule_id, session=session)
        if row is None:
            return False
        session.delete(row)
        session.commit()
    finally:
        session.close()

    AuditLogRepo.create(
        tenant_id, actor=actor, action="rule_deleted",
        detail={"rule_id": rule_id},
    )
    return True


def export_rules(tenant_id: str) -> dict[str, Any]:
    """A JSON-serialisable ruleset for the tenant (export endpoint)."""
    rows = RegressionRuleRepo.list(tenant_id)
    return {
        "version": "hydrasentry-ruleset/1",
        "tenant_id": tenant_id,
        "count": len(rows),
        "rules": [
            {
                "name": r.name,
                "signature_text": getattr(r, "signature_text", "") or r.signature or "",
                "attack_type": getattr(r, "attack_type", _DEFAULT_ATTACK_TYPE),
                "severity": getattr(r, "severity", _DEFAULT_SEVERITY),
                "enabled": bool(getattr(r, "enabled", True)),
            }
            for r in rows
        ],
    }


def import_rules(tenant_id: str, payload: dict[str, Any],
                 actor: str = "user") -> dict[str, Any]:
    """Import a JSON ruleset into the tenant. Validates the schema, dedups by
    signature_text (case-insensitive) against existing rows AND within the batch,
    and is tenant-scoped. Returns ``{imported, skipped, errors}``."""
    if not isinstance(payload, dict):
        raise RuleValidationError("ruleset must be a JSON object")
    rules = payload.get("rules")
    if not isinstance(rules, list):
        raise RuleValidationError("ruleset.rules must be a list")
    if len(rules) > _MAX_IMPORT_RULES:
        raise RuleValidationError(f"too many rules (max {_MAX_IMPORT_RULES})")

    existing = {
        (getattr(r, "signature_text", "") or r.signature or "").strip().lower()
        for r in RegressionRuleRepo.list(tenant_id, limit=_MAX_IMPORT_RULES)
    }
    seen_in_batch: set[str] = set()
    imported = 0
    skipped = 0
    errors: list[str] = []

    # Atomic import: all rows are created in ONE shared session/transaction, so a
    # DB error part-way through rolls the WHOLE batch back rather than leaving a
    # partial ruleset (and an audit log that never gets written). The repo
    # accepts an injected session precisely for this batching.
    from db.engine import get_session

    session = get_session()
    try:
        for i, raw in enumerate(rules):
            if not isinstance(raw, dict):
                errors.append(f"rule[{i}] is not an object")
                continue
            try:
                fields = _validate_create_fields(raw)
            except RuleValidationError as exc:
                errors.append(f"rule[{i}]: {exc}")
                continue
            key = fields["signature_text"].lower()
            if key in existing or key in seen_in_batch:
                skipped += 1
                continue
            seen_in_batch.add(key)
            embedded = _try_embed(fields["signature_text"]) if fields["enabled"] else False
            RegressionRuleRepo.create(
                tenant_id,
                session=session,
                name=fields["name"],
                signature=fields["signature_text"],
                signature_text=fields["signature_text"],
                attack_type=fields["attack_type"],
                severity=fields["severity"],
                enabled=fields["enabled"],
                embedded=embedded,
            )
            imported += 1
        if imported:
            AuditLogRepo.create(
                tenant_id, session=session, actor=actor, action="rules_imported",
                detail={"imported": imported, "skipped": skipped},
            )
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()

    return {"imported": imported, "skipped": skipped, "errors": errors}


def enabled_signature_texts(tenant_id: str) -> list[str]:
    """The tenant's ENABLED + embedded rule signature texts.

    These are the signatures consulted by the tenant's semantic detection path.
    Only enabled AND embedded rules are returned: a pending (un-embedded) rule
    must not be presented as if it were affecting detection (fail-closed). The
    global/default signatures still apply on top of these for every tenant.
    """
    if not tenant_id:
        return []
    try:
        rows = RegressionRuleRepo.list(tenant_id)
    except Exception:  # noqa: BLE001 -- a store blip must not break the scan
        logger.warning("could not load tenant rules; scanning with defaults only")
        return []
    out: list[str] = []
    for r in rows:
        if not getattr(r, "enabled", True):
            continue
        if not getattr(r, "embedded", False):
            continue
        sig = (getattr(r, "signature_text", "") or "").strip()
        if sig:
            out.append(sig)
    return out

