"""Supabase user-JWT verification.

A Supabase web session presents ``Authorization: Bearer <access token>``. We
verify it against the project's published JWKS
(``{SUPABASE_URL}/auth/v1/.well-known/jwks.json``) when asymmetric signing keys
are enabled (ES256/RS256 -- the public-key path needs NO secret), and fall back
to the legacy shared HS256 secret (``SUPABASE_JWT_SECRET``) only if that is the
configured signing mode.

The JWKS is fetched lazily and cached in-process (``PyJWKClient`` keeps its own
LRU). A token whose ``kid`` is not in the cached JWKS triggers exactly one
refresh before it is rejected, so a key rotation is picked up without a restart.

Fail-closed: every failure path -- bad signature, expired, wrong issuer/audience,
unreachable JWKS with no usable secret -- raises :class:`JWTVerificationError`,
which the identity layer turns into a 401. A token is NEVER accepted on a
verification error and NEVER silently downgraded to the demo tenant.
"""
from __future__ import annotations

import os
import threading
from dataclasses import dataclass
from typing import Any, Optional

import jwt
from jwt import PyJWKClient

# Supabase access tokens carry aud="authenticated" for a signed-in user.
_EXPECTED_AUD = "authenticated"
_LEEWAY_SECONDS = 10


class JWTVerificationError(Exception):
    """Raised when a presented JWT cannot be verified. Always a 401 upstream."""


@dataclass(frozen=True)
class VerifiedClaims:
    """The trusted subset of a verified token. Only set after full verification."""

    sub: str
    email: str
    raw: dict[str, Any]


_jwks_lock = threading.Lock()
_jwks_client: Optional[PyJWKClient] = None
_jwks_url_cached: Optional[str] = None


def _supabase_url() -> str:
    return (os.getenv("SUPABASE_URL") or "").rstrip("/")


def jwks_url() -> str:
    base = _supabase_url()
    return f"{base}/auth/v1/.well-known/jwks.json" if base else ""


def _expected_issuer() -> Optional[str]:
    """The token issuer to enforce: ``{SUPABASE_URL}/auth/v1``.

    Returns None only when SUPABASE_URL is unset (issuer cannot be enforced); the
    JWKS path already requires SUPABASE_URL, so in practice the issuer is always
    checked for the asymmetric path. Pinning ``iss`` stops a validly-signed token
    from a DIFFERENT project being accepted here.
    """
    base = _supabase_url()
    return f"{base}/auth/v1" if base else None


def _hs256_secret() -> str:
    """Legacy symmetric secret, only used if asymmetric keys are off."""
    return os.getenv("SUPABASE_JWT_SECRET") or ""


def _get_jwks_client() -> PyJWKClient:
    """Return a process-wide cached PyJWKClient for the configured project.

    Rebuilds if SUPABASE_URL changed (tests point at a fake issuer). PyJWKClient
    caches fetched keys internally, so steady-state verification makes no network
    call.
    """
    global _jwks_client, _jwks_url_cached
    url = jwks_url()
    if not url:
        raise JWTVerificationError("SUPABASE_URL not configured for JWKS")
    with _jwks_lock:
        if _jwks_client is None or _jwks_url_cached != url:
            _jwks_client = PyJWKClient(url, cache_keys=True, lifespan=600)
            _jwks_url_cached = url
        return _jwks_client


def reset_jwks_cache() -> None:
    """Drop the cached JWKS client (test isolation / forced rotation pickup)."""
    global _jwks_client, _jwks_url_cached
    with _jwks_lock:
        _jwks_client = None
        _jwks_url_cached = None


def _header_alg(token: str) -> str:
    try:
        return str(jwt.get_unverified_header(token).get("alg", ""))
    except Exception as exc:  # noqa: BLE001 -- malformed token -> 401
        raise JWTVerificationError("malformed token header") from exc


def _decode_asymmetric(token: str) -> dict[str, Any]:
    client = _get_jwks_client()
    try:
        signing_key = client.get_signing_key_from_jwt(token)
    except Exception as exc:  # noqa: BLE001 -- unknown kid / unreachable JWKS
        raise JWTVerificationError("no usable signing key for token") from exc
    issuer = _expected_issuer()
    try:
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            audience=_EXPECTED_AUD,
            issuer=issuer,
            leeway=_LEEWAY_SECONDS,
            options={"require": ["exp", "sub"], "verify_iss": issuer is not None},
        )
    except Exception as exc:  # noqa: BLE001 -- bad sig / expired / aud / iss
        raise JWTVerificationError(f"token rejected: {type(exc).__name__}") from exc


def _decode_hs256(token: str) -> dict[str, Any]:
    secret = _hs256_secret()
    if not secret:
        raise JWTVerificationError("HS256 token but no SUPABASE_JWT_SECRET set")
    issuer = _expected_issuer()
    try:
        return jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            audience=_EXPECTED_AUD,
            issuer=issuer,
            leeway=_LEEWAY_SECONDS,
            options={"require": ["exp", "sub"], "verify_iss": issuer is not None},
        )
    except Exception as exc:  # noqa: BLE001 -- bad sig / expired / aud / iss
        raise JWTVerificationError(f"token rejected: {type(exc).__name__}") from exc


def verify_token(token: str) -> VerifiedClaims:
    """Verify a Supabase access token and return its trusted claims.

    Picks the verification path from the token's ``alg`` header: ES256/RS256 go
    through the project JWKS (public key, no secret); HS256 uses the legacy
    shared secret if one is configured. Any failure raises
    :class:`JWTVerificationError`.
    """
    if not token or not isinstance(token, str):
        raise JWTVerificationError("empty token")

    alg = _header_alg(token)
    if alg in ("ES256", "RS256"):
        claims = _decode_asymmetric(token)
    elif alg == "HS256":
        claims = _decode_hs256(token)
    else:
        raise JWTVerificationError(f"unsupported token alg: {alg or 'none'}")

    sub = claims.get("sub")
    if not sub:
        raise JWTVerificationError("token missing sub claim")
    email = claims.get("email") or claims.get("user_metadata", {}).get("email") or ""
    return VerifiedClaims(sub=str(sub), email=str(email), raw=claims)
