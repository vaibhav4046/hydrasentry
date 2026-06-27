"""Auth service: resolve credentials to an owning (user, tenant).

This is the bridge between the raw auth primitives (``api_keys``,
``jwt_verifier``) and the DB. It performs the keyed hash lookup + constant-time
compare for API keys, and the verified-JWT get-or-create for users. Both return
a :class:`ResolvedIdentity` or raise :class:`AuthError` (a 401 upstream).

Nothing here logs a raw key or a token. The API-key path updates
``last_used_at`` as a side effect of a successful auth.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from auth import api_keys
from auth.jwt_verifier import JWTVerificationError, verify_token
from db.models import Tenant, User
from db.repo import ApiKeyRepo, UserRepo


class AuthError(Exception):
    """A present-but-invalid credential. Always a 401 upstream (fail-closed)."""


@dataclass(frozen=True)
class ResolvedIdentity:
    user: Optional[User]
    tenant: Tenant
    auth_method: str  # "jwt" | "api_key" | "demo"
    api_key_id: Optional[str] = None


def resolve_api_key(raw_key: str) -> ResolvedIdentity:
    """Resolve a presented API key to its owning user + tenant.

    Raises :class:`AuthError` if the key is unknown or revoked. A revoked key is
    excluded at the query level (``get_active_by_hash``), so it never resolves --
    the constant-time compare is a defense-in-depth second gate.
    """
    presented_hash = api_keys.hash_key(raw_key)
    row = ApiKeyRepo.get_active_by_hash(presented_hash)
    if row is None:
        # Unknown or revoked. Run a constant-time compare against a dummy so the
        # not-found path costs the same as the found-but-mismatch path.
        api_keys.constant_time_match(presented_hash, "0" * 64)
        raise AuthError("invalid or revoked API key")
    if not api_keys.constant_time_match(presented_hash, row.key_hash):
        # Should be unreachable (the query already matched the hash), but the
        # explicit constant-time gate is the contract for key verification.
        raise AuthError("invalid API key")

    from db.engine import get_session

    with get_session() as s:
        owner = s.get(User, row.user_id)
        tenant = s.get(Tenant, row.tenant_id)
        if tenant is None:
            raise AuthError("API key tenant missing")
        ApiKeyRepo.touch_last_used(row.id, session=s)
        s.commit()
    return ResolvedIdentity(
        user=owner, tenant=tenant, auth_method="api_key", api_key_id=row.id
    )


def resolve_jwt(token: str) -> ResolvedIdentity:
    """Verify a Supabase JWT and resolve it to the user's personal tenant.

    Verification (signature, expiry, audience) happens first; only then is the
    trusted ``sub``/``email`` used to get-or-create the user + tenant. A forged
    or expired token raises before any DB write.
    """
    try:
        claims = verify_token(token)
    except JWTVerificationError as exc:
        raise AuthError(str(exc)) from exc
    user, tenant = UserRepo.get_or_create_with_tenant(claims.sub, claims.email)
    return ResolvedIdentity(user=user, tenant=tenant, auth_method="jwt")
