"""The ``current_identity`` request resolver (FastAPI dependency).

Resolution order and the fail-closed contract (operating rules #3, #5):

1. ``X-API-Key`` present  -> resolve to the key's user + tenant, or 401 if the
   key is unknown/revoked. A present API key is NEVER ignored.
2. ``Authorization: Bearer`` present -> verify the JWT via JWKS and resolve to
   the user's personal tenant, or 401 if the token is forged/expired/invalid.
3. Neither credential present -> fall back to the shared ``demo`` tenant
   (the public showcase). This is the ONLY path that reaches demo.

The crucial default-deny nuance: the ABSENCE of credentials falls to demo, but a
PRESENT-but-INVALID credential is a hard 401 -- never a silent demo downgrade.
That is what stops an attacker from sending a forged token to fish for behavior
while still letting the unauthenticated public demo work.

When the app DB is unreachable, an authenticated request that cannot be resolved
fails closed (503) rather than silently dropping to demo; an unauthenticated
request still returns the demo identity by slug so the public demo survives a
transient app-DB blip the same way the rest of the persistence path does.
"""
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from typing import Optional

from fastapi import Depends, Header, HTTPException, Request

from auth import api_keys
from auth.service import AuthError, ResolvedIdentity, resolve_api_key, resolve_jwt
from db.persistence import DEFAULT_TENANT_SLUG

logger = logging.getLogger("hydrasentry.auth.identity")


@dataclass(frozen=True)
class Identity:
    """The resolved caller. ``tenant_id`` is what every scoped read/write uses."""

    tenant_id: Optional[str]
    tenant_slug: Optional[str]
    user_id: Optional[str]
    email: Optional[str]
    auth_method: str  # "jwt" | "api_key" | "demo"
    api_key_id: Optional[str] = None

    @property
    def is_authenticated(self) -> bool:
        return self.auth_method in ("jwt", "api_key")


def _demo_identity() -> Identity:
    """Resolve the shared public ``demo`` tenant (unauthenticated showcase).

    Returns an identity with ``tenant_id`` set when the demo tenant is present,
    or just the slug when the app DB is briefly unreachable -- the persistence
    layer then resolves/creates it by slug on write, preserving the public demo.
    """
    try:
        from db.repo import TenantRepo

        tenant = TenantRepo.get_by_slug(DEFAULT_TENANT_SLUG)
        tenant_id = tenant.id if tenant is not None else None
    except Exception as exc:  # noqa: BLE001 -- DB blip must not break public demo
        logger.warning("demo tenant resolve failed: %s", type(exc).__name__)
        tenant_id = None
    return Identity(
        tenant_id=tenant_id,
        tenant_slug=DEFAULT_TENANT_SLUG,
        user_id=None,
        email=None,
        auth_method="demo",
    )


def _to_identity(resolved: ResolvedIdentity) -> Identity:
    return Identity(
        tenant_id=resolved.tenant.id,
        tenant_slug=resolved.tenant.slug,
        user_id=resolved.user.id if resolved.user is not None else None,
        email=resolved.user.email if resolved.user is not None else None,
        auth_method=resolved.auth_method,
        api_key_id=resolved.api_key_id,
    )


def _bearer_token(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    parts = authorization.split(" ", 1)
    if len(parts) == 2 and parts[0].lower() == "bearer" and parts[1].strip():
        return parts[1].strip()
    return None


def resolve_identity(
    *, api_key: Optional[str], authorization: Optional[str]
) -> Identity:
    """Pure resolver (testable without a Request). See module docstring."""
    # 1) API key takes precedence. Present-but-invalid -> 401, never demo.
    if api_keys.looks_like_api_key(api_key):
        try:
            return _to_identity(resolve_api_key(api_key))  # type: ignore[arg-type]
        except AuthError as exc:
            raise HTTPException(status_code=401, detail="invalid API key") from exc
    # A non-empty X-API-Key that is not even shaped like one is still a presented
    # credential -> reject, do not fall through to demo.
    if api_key and api_key.strip():
        raise HTTPException(status_code=401, detail="invalid API key")

    # 2) Bearer JWT. Present-but-invalid -> 401, never demo.
    token = _bearer_token(authorization)
    if token:
        try:
            return _to_identity(resolve_jwt(token))
        except AuthError as exc:
            raise HTTPException(status_code=401, detail="invalid token") from exc

    # 3) No credential at all -> public demo tenant.
    return _demo_identity()


async def current_identity(
    request: Request,
    x_api_key: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
) -> Identity:
    """FastAPI dependency. Resolves the caller to an :class:`Identity`.

    Reads ``X-API-Key`` and ``Authorization`` headers only; ``request`` is in the
    signature so the dependency can be reused by middleware/logging later without
    a signature change. ``resolve_identity`` does blocking DB I/O, so it runs off
    the event loop (the codebase convention for blocking repo calls) -- one slow
    auth round-trip then cannot stall other concurrent requests.
    """
    return await asyncio.to_thread(
        resolve_identity, api_key=x_api_key, authorization=authorization
    )


async def require_user(
    identity: Identity = Depends(current_identity),
) -> Identity:
    """Dependency guard for user-data management endpoints (default-deny).

    A real authenticated USER is required: the demo fallback is not a user, and
    an API key authenticates an agent (not the human who can mint/list/revoke
    keys), so both are rejected here even though they are allowed on the public
    showcase endpoints. As a FastAPI ``Depends`` this runs BEFORE the handler
    body, so the 401 cannot be suppressed by an in-handler try/except.
    """
    if identity.auth_method != "jwt" or not identity.user_id:
        raise HTTPException(status_code=401, detail="authentication required")
    return identity
