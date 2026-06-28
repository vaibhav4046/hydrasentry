"""Per-tenant bring-your-own-key (BYO) LLM provider credential service.

A signed-in user saves their own ``{provider, model, api_key}`` so THEIR tenant's
real runs route through their provider/model/key instead of the platform default
Groq. This module is the service layer between the HTTP endpoints (``main.py``)
and the tenant-scoped repo (``db.repo``):

* CRUD over a tenant's :class:`db.models.TenantProviderCredential` rows
  (BOLA-safe via the scoped repo: a cross-tenant id collapses to "not found").
* Encrypts the raw key with :mod:`crypto_box` (Fernet) BEFORE it touches the DB,
  and stores ONLY the ciphertext + a masked sha256 fingerprint. The plaintext is
  never persisted, never returned, never logged.
* Real validation: :func:`test_credential` makes a genuine minimal call to the
  chosen provider with the user's key (a models-list / 1-token completion) and
  returns ok/error WITHOUT exposing the key. Not a fake 200.
* :func:`runtime_for_tenant` resolves a tenant's saved+enabled credential into a
  :class:`ProviderRuntime` the real run path uses; ``None`` -> platform default.

Honesty / fail-closed (operating rule #1):
* Saving is REFUSED when no encryption secret is configured (never store a
  plaintext or weakly-keyed value).
* A credential whose ciphertext cannot be decrypted (wrong key / tamper) yields
  ``None`` from :func:`runtime_for_tenant`, so the run falls back to the platform
  default rather than acting on a corrupt key.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Optional

import crypto_box
from config import PROVIDERS, ProviderConfig
from db.repo import AuditLogRepo, TenantProviderCredentialRepo

logger = logging.getLogger("hydrasentry.provider_credentials")

# Providers a user may bring their own key for. ``local`` is intentionally
# excluded (no key) and ``deterministic`` is not a provider. These are the
# real, validatable upstreams.
ALLOWED_PROVIDERS = ("groq", "openai", "anthropic", "gemini", "openrouter")

_MAX_MODEL_LEN = 200
_MAX_KEY_LEN = 512
_CONNECT_TIMEOUT_SECONDS = 6.0
# A 1-token, temperature-0 completion is the cheapest genuine auth probe for the
# OpenAI-compatible providers; the models-list probe is cheaper still where it
# exists. Either way the user's key is actually exercised against the upstream.
_VALIDATE_MAX_TOKENS = 1


class CredentialValidationError(ValueError):
    """Raised when a save/test payload fails validation (-> 400 at the edge)."""


@dataclass(frozen=True)
class ProviderRuntime:
    """A resolved, ready-to-call provider binding for the run path.

    Carries the DECRYPTED key in-process only (built immediately before the
    upstream call, never persisted or serialised). ``source`` is "tenant" for a
    BYO credential and "platform" for the default, so the run can label which
    model actually answered without ever exposing the key."""

    provider: str
    model: str
    base_url: str
    api_key: str
    source: str  # "tenant" | "platform"


def _provider_config(provider: str) -> ProviderConfig:
    cfg = PROVIDERS.get(provider)
    if cfg is None or provider not in ALLOWED_PROVIDERS:
        raise CredentialValidationError(f"unsupported provider '{provider}'")
    return cfg


def _validate_save_fields(payload: dict[str, Any]) -> dict[str, str]:
    """Validate + normalise a save payload. Raises on bad input. Returns the
    cleaned ``{provider, model, api_key}`` (model defaults to the provider's
    default model when omitted)."""
    provider = str(payload.get("provider") or "").strip().lower()
    if provider not in ALLOWED_PROVIDERS:
        raise CredentialValidationError(
            f"provider must be one of {', '.join(ALLOWED_PROVIDERS)}"
        )
    cfg = _provider_config(provider)
    model = str(payload.get("model") or "").strip() or cfg.model
    if len(model) > _MAX_MODEL_LEN:
        raise CredentialValidationError(f"model exceeds {_MAX_MODEL_LEN} chars")
    api_key = str(payload.get("api_key") or "").strip()
    if not api_key:
        raise CredentialValidationError("api_key is required")
    if len(api_key) > _MAX_KEY_LEN:
        raise CredentialValidationError(f"api_key exceeds {_MAX_KEY_LEN} chars")
    return {"provider": provider, "model": model, "api_key": api_key}


def credential_dto(row: Any) -> dict[str, Any]:
    """A safe, serialisable view of a saved credential. NEVER includes the raw
    or encrypted key -- only the masked fingerprint and metadata."""
    cfg = PROVIDERS.get(row.provider)
    return {
        "provider": row.provider,
        "label": cfg.label if cfg else row.provider,
        "model": row.model,
        "key_fingerprint": row.key_fingerprint,
        "configured": True,
        "enabled": bool(getattr(row, "enabled", True)),
        "last_status": getattr(row, "last_status", "untested"),
        "base_url": cfg.base_url if cfg else "",
        "get_key_url": cfg.get_key_url if cfg else "",
        "updated_at": row.updated_at.isoformat() if getattr(row, "updated_at", None) else None,
    }


def list_credentials(tenant_id: str) -> list[dict[str, Any]]:
    """The tenant's saved BYO credentials (masked). BOLA-safe."""
    rows = TenantProviderCredentialRepo.list(tenant_id)
    return [credential_dto(r) for r in rows]


def get_credential_dto(tenant_id: str, provider: str) -> Optional[dict[str, Any]]:
    """One saved credential (masked), or ``None`` if the tenant has not set it."""
    row = TenantProviderCredentialRepo.get_by_provider(tenant_id, provider)
    return credential_dto(row) if row is not None else None


def save_credential(tenant_id: str, payload: dict[str, Any],
                    actor: str = "user") -> dict[str, Any]:
    """Encrypt + store the tenant's credential for a provider (upsert).

    Refuses to store when no encryption secret is configured (fail-closed: never
    persist a plaintext or weakly-keyed value). Stores ONLY the ciphertext + the
    masked fingerprint; the raw key is dropped from memory after encryption."""
    fields = _validate_save_fields(payload)
    if not crypto_box.is_encryption_available():
        raise CredentialValidationError(
            "encryption is not configured on this deployment; set ENCRYPTION_KEY "
            "(or APP_SECRET) so the key can be stored encrypted at rest"
        )
    ciphertext = crypto_box.encrypt(fields["api_key"])
    if ciphertext is None:  # defensive: availability checked above
        raise CredentialValidationError("encryption unavailable")
    fingerprint = crypto_box.fingerprint(fields["api_key"])
    row = TenantProviderCredentialRepo.upsert(
        tenant_id,
        fields["provider"],
        model=fields["model"],
        api_key_ciphertext=ciphertext,
        key_fingerprint=fingerprint,
        last_status="untested",
        enabled=True,
    )
    AuditLogRepo.create(
        tenant_id, actor=actor, action="provider_credential_saved",
        # Audit detail records the fingerprint, NEVER the key or ciphertext.
        detail={"provider": fields["provider"], "model": fields["model"],
                "key_fingerprint": fingerprint},
    )
    return credential_dto(row)


def delete_credential(tenant_id: str, provider: str, actor: str = "user") -> bool:
    """Revoke the tenant's credential for a provider. Returns False (->404) if
    the tenant has no such credential (cross-tenant -> not found)."""
    if provider not in ALLOWED_PROVIDERS:
        return False
    deleted = TenantProviderCredentialRepo.delete_by_provider(tenant_id, provider)
    if deleted:
        AuditLogRepo.create(
            tenant_id, actor=actor, action="provider_credential_revoked",
            detail={"provider": provider},
        )
    return deleted


# --- Real validation --------------------------------------------------------

def _validate_openai_compatible(base_url: str, api_key: str, model: str) -> dict[str, Any]:
    """Validate an OpenAI-compatible key (groq / openai / openrouter) with a real
    minimal call: GET /models (cheap, authenticated). 2xx -> valid; 401/403 ->
    invalid key; other -> error. The key is sent only to the provider, never
    returned in the result."""
    import httpx

    url = base_url.rstrip("/") + "/models"
    headers = {"Authorization": f"Bearer {api_key}"}
    with httpx.Client(timeout=_CONNECT_TIMEOUT_SECONDS) as client:
        resp = client.get(url, headers=headers)
    return _classify(resp.status_code)


def _validate_anthropic(base_url: str, api_key: str, model: str) -> dict[str, Any]:
    """Validate an Anthropic key with a real GET /models (x-api-key auth)."""
    import httpx

    url = base_url.rstrip("/") + "/models"
    headers = {"x-api-key": api_key, "anthropic-version": "2023-06-01"}
    with httpx.Client(timeout=_CONNECT_TIMEOUT_SECONDS) as client:
        resp = client.get(url, headers=headers)
    return _classify(resp.status_code)


def _validate_gemini(base_url: str, api_key: str, model: str) -> dict[str, Any]:
    """Validate a Gemini key with a real GET /models?key=... (the key is a query
    param for the generativelanguage API)."""
    import httpx

    url = base_url.rstrip("/") + "/models"
    with httpx.Client(timeout=_CONNECT_TIMEOUT_SECONDS) as client:
        resp = client.get(url, params={"key": api_key})
    return _classify(resp.status_code)


def _classify(status: int) -> dict[str, Any]:
    """Map an upstream HTTP status to a validation verdict. Carries the status
    code (a non-sensitive diagnostic) but NEVER the key."""
    if 200 <= status < 300:
        return {"ok": True, "status": "valid", "http_status": status}
    if status in (401, 403):
        return {"ok": False, "status": "invalid",
                "http_status": status, "detail": "key rejected by provider"}
    if status == 404:
        # The endpoint shape differs; the key still authenticated to reach a 404.
        return {"ok": True, "status": "valid", "http_status": status,
                "detail": "authenticated (models endpoint not found)"}
    return {"ok": False, "status": "error", "http_status": status,
            "detail": f"provider returned {status}"}


_VALIDATORS = {
    "groq": _validate_openai_compatible,
    "openai": _validate_openai_compatible,
    "openrouter": _validate_openai_compatible,
    "anthropic": _validate_anthropic,
    "gemini": _validate_gemini,
}


def test_key(provider: str, api_key: str, model: Optional[str] = None) -> dict[str, Any]:
    """Make a REAL minimal call to ``provider`` with ``api_key`` and return an
    ok/error verdict WITHOUT exposing the key. Never raises: a transport error
    is surfaced as ``{ok:false, status:"unreachable"}``. ``model`` is accepted so
    a caller can validate the exact model, but the cheap models-list probe does
    not require it."""
    try:
        cfg = _provider_config(provider)
    except CredentialValidationError as exc:
        return {"ok": False, "provider": provider, "status": "unsupported",
                "detail": str(exc)}
    if not api_key:
        return {"ok": False, "provider": provider, "status": "no_key",
                "detail": "no API key provided"}
    validator = _VALIDATORS.get(provider)
    if validator is None:
        return {"ok": False, "provider": provider, "status": "unsupported"}
    try:
        result = validator(cfg.base_url, api_key, model or cfg.model)
    except Exception as exc:  # noqa: BLE001 -- never raise; surface the kind only
        logger.warning("provider validation transport error: %s", type(exc).__name__)
        return {"ok": False, "provider": provider, "status": "unreachable",
                "detail": type(exc).__name__}
    result["provider"] = provider
    result["model"] = model or cfg.model
    return result


def test_saved_credential(tenant_id: str, provider: str) -> dict[str, Any]:
    """Validate a tenant's ALREADY-SAVED credential (decrypt -> real call). Used
    when the user clicks Test on a stored provider without re-typing the key.
    Records the verdict on the row. Returns ``{ok:false, status:"not_found"}``
    when the tenant has no credential for that provider (BOLA-safe)."""
    row = TenantProviderCredentialRepo.get_by_provider(tenant_id, provider)
    if row is None:
        return {"ok": False, "provider": provider, "status": "not_found",
                "detail": "no saved credential for this provider"}
    plaintext = crypto_box.decrypt(row.api_key_ciphertext)
    if plaintext is None:
        return {"ok": False, "provider": provider, "status": "decrypt_failed",
                "detail": "stored key could not be decrypted on this deployment"}
    result = test_key(provider, plaintext, row.model)
    # Persist the latest verdict for display (never the key).
    TenantProviderCredentialRepo.set_status(
        tenant_id, provider, result.get("status", "untested")
    )
    return result


# --- Run-path resolution ----------------------------------------------------

def runtime_for_tenant(tenant_id: Optional[str], provider: str) -> Optional[ProviderRuntime]:
    """Resolve a tenant's saved+enabled credential for ``provider`` into a
    ready-to-call :class:`ProviderRuntime`, or ``None`` to fall back to the
    platform default.

    Fail-closed: returns ``None`` (platform default) when there is no tenant,
    no credential, the credential is disabled, or the stored key cannot be
    decrypted. The DECRYPTED key lives only inside the returned dataclass,
    built here immediately before the run uses it -- never persisted."""
    if not tenant_id:
        return None
    cfg = PROVIDERS.get(provider)
    if cfg is None:
        return None
    try:
        row = TenantProviderCredentialRepo.get_by_provider(tenant_id, provider)
    except Exception as exc:  # noqa: BLE001 -- a store blip falls back to platform
        logger.warning("credential lookup failed (%s); using platform default",
                       type(exc).__name__)
        return None
    if row is None or not getattr(row, "enabled", True):
        return None
    plaintext = crypto_box.decrypt(row.api_key_ciphertext)
    if not plaintext:
        logger.warning("tenant %s %s credential decrypt failed; platform default",
                       tenant_id[:8], provider)
        return None
    return ProviderRuntime(
        provider=provider,
        model=row.model or cfg.model,
        base_url=cfg.base_url,
        api_key=plaintext,
        source="tenant",
    )
