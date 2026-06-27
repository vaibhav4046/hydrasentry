"""API key generation, hashing, verification, and revocation.

A key is a high-entropy, URL-safe token shaped ``hs_live_<43 url-safe chars>``
(32 random bytes, base64url, no padding). The RAW key is returned to the caller
exactly ONCE at creation and is never stored. Only a *salted* SHA-256 hash and
the first-8-char display prefix are persisted.

Salting: the hash is ``sha256(salt + ":" + raw)`` where ``salt`` is the
application secret (``APP_SECRET``, falling back to ``HYDRASENTRY_CERT_SECRET``).
The salt makes a stolen database of ``key_hash`` values useless for an offline
dictionary/precompute attack without also stealing the app secret. Lookups stay
O(1): the same deterministic hash is recomputed and matched on the unique
``key_hash`` column, then a constant-time compare guards against a (vanishingly
unlikely) hash-prefix timing side-channel and confirms the row is the real one.
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import os
import secrets
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger("hydrasentry.auth.api_keys")

KEY_PREFIX = "hs_live_"
# 32 bytes -> 43 url-safe base64 chars (no padding). 256 bits of entropy.
_KEY_RANDOM_BYTES = 32
# Show the literal "hs_live_" tag plus 8 chars of the random tail so a user can
# tell their keys apart in a list (the displayed tail is far below any
# brute-force threshold; the full 256-bit secret is never shown).
PREFIX_DISPLAY_LEN = len(KEY_PREFIX) + 8

_warned_no_salt = False


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _salt() -> str:
    """Per-deployment salt (pepper) for key hashing. Never logged, never returned.

    Falls back HYDRASENTRY_CERT_SECRET -> "" so dev/CI still works, but an empty
    salt degrades the stored hash toward unsalted SHA-256, so we warn ONCE if no
    secret is configured. Production must set APP_SECRET (or the cert secret).
    """
    global _warned_no_salt
    value = os.getenv("APP_SECRET") or os.getenv("HYDRASENTRY_CERT_SECRET") or ""
    if not value and not _warned_no_salt:
        logger.warning(
            "APP_SECRET / HYDRASENTRY_CERT_SECRET unset: API key hashes are "
            "unsalted -- set a secret in production"
        )
        _warned_no_salt = True
    return value


def generate_raw_key() -> str:
    """Return a fresh high-entropy raw API key. Caller stores nothing of this
    except via :func:`hash_key`; the raw value is shown to the user once."""
    return KEY_PREFIX + secrets.token_urlsafe(_KEY_RANDOM_BYTES)


def hash_key(raw_key: str) -> str:
    """Deterministic salted SHA-256 hex digest of a raw key.

    Used both to store the hash at creation and to look a presented key up.
    """
    digest = hashlib.sha256(f"{_salt()}:{raw_key}".encode("utf-8")).hexdigest()
    return digest


def display_prefix(raw_key: str) -> str:
    """First ``PREFIX_DISPLAY_LEN`` chars of the raw key, safe to show in a list.

    Includes the ``hs_live_`` tag plus 8 chars of the random tail so a user can
    distinguish their keys. The shown tail is far too short to brute-force; the
    full 256-bit secret is never stored or displayed.
    """
    return raw_key[:PREFIX_DISPLAY_LEN]


def constant_time_match(presented_hash: str, stored_hash: str) -> bool:
    """Constant-time comparison of two hex digests (timing-attack safe)."""
    return hmac.compare_digest(presented_hash, stored_hash)


@dataclass(frozen=True)
class GeneratedKey:
    """The result of creating a key. ``raw`` is returned to the user ONCE."""

    raw: str
    key_hash: str
    prefix: str


def new_key() -> GeneratedKey:
    """Generate a raw key plus the values that get persisted (hash + prefix)."""
    raw = generate_raw_key()
    return GeneratedKey(raw=raw, key_hash=hash_key(raw), prefix=display_prefix(raw))


def looks_like_api_key(value: Optional[str]) -> bool:
    """Cheap shape check before any DB work. Not a security boundary -- the hash
    lookup + constant-time compare is. Just avoids a pointless query on noise."""
    return bool(value) and value.startswith(KEY_PREFIX) and len(value) > len(KEY_PREFIX)
