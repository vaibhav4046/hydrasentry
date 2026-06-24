"""Provider selection and health for HydraSentry.

The router never raises on missing keys: if a provider is unconfigured it is
simply skipped, and the deterministic demo path is always available. Secret
values are exposed only as masked fingerprints via ``provider_status``.
"""
from __future__ import annotations

import logging
from typing import Any, Optional

from config import PROVIDERS, ROLE_PREFERENCE, ProviderConfig, settings

logger = logging.getLogger("hydrasentry.model_router")

_CONNECT_TIMEOUT_SECONDS = 4.0


def provider_status() -> list[dict[str, Any]]:
    """Masked status for every provider (safe to send to the frontend)."""
    return [p.masked() for p in PROVIDERS.values()]


def _is_configured(provider: ProviderConfig) -> bool:
    # Local provider needs no API key; everything else needs one.
    if provider.name == "local":
        return True
    return bool(provider.api_key)


def pick(role: str) -> dict[str, Any]:
    """Pick a provider for a role by preference order and availability.

    Falls back to deterministic mode when no configured provider exists.
    """
    preference = ROLE_PREFERENCE.get(role, [])
    for name in preference:
        provider = PROVIDERS.get(name)
        if provider and _is_configured(provider) and settings.is_real_mode:
            logger.info("role=%s -> provider=%s model=%s", role, provider.name, provider.model)
            return {
                "role": role,
                "provider": provider.name,
                "model": provider.model,
                "mode": "real",
            }
    logger.info("role=%s -> deterministic demo (no configured provider / demo mode)", role)
    return {
        "role": role,
        "provider": "deterministic",
        "model": "hydrasentry-deterministic",
        "mode": "demo",
    }


def test_connection(provider_name: str) -> dict[str, Any]:
    """Ping a provider with a short timeout. Never raises.

    Returns a status dict; if no key is set, returns 'not_configured' without
    any network call.
    """
    provider = PROVIDERS.get(provider_name)
    if provider is None:
        return {"provider": provider_name, "status": "unknown_provider", "reachable": False}

    if provider.name != "local" and not provider.api_key:
        return {
            "provider": provider.name,
            "status": "not_configured",
            "reachable": False,
            "detail": "No API key set in environment.",
        }

    url = provider.base_url.rstrip("/") + "/models"
    headers: dict[str, str] = {}
    if provider.api_key:
        headers["Authorization"] = f"Bearer {provider.api_key}"

    try:
        import httpx

        with httpx.Client(timeout=_CONNECT_TIMEOUT_SECONDS) as client:
            resp = client.get(url, headers=headers)
        reachable = resp.status_code < 500
        return {
            "provider": provider.name,
            "status": "reachable" if reachable else "error",
            "reachable": reachable,
            "http_status": resp.status_code,
            "model": provider.model,
        }
    except Exception as exc:  # network blocked, DNS, timeout, etc.
        return {
            "provider": provider.name,
            "status": "unreachable",
            "reachable": False,
            "detail": type(exc).__name__,
            "model": provider.model,
        }


def role_for_provider(provider_name: str) -> Optional[str]:
    p = PROVIDERS.get(provider_name)
    return p.role if p else None
