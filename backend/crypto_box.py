"""Authenticated symmetric encryption for secrets stored at rest.

A bring-your-own-key (BYO) provider credential's raw API key is NEVER stored in
the clear. This module encrypts it with Fernet (AES-128-CBC + HMAC-SHA256,
authenticated, timestamped) before it touches the database and decrypts it only
in-process, on the run path, immediately before the upstream provider call.

Key derivation
--------------
The Fernet key is derived deterministically from an application secret so there
is no extra key file to manage and so a round-trip works across restarts:

* ``ENCRYPTION_KEY`` if set (a dedicated secret, lets the credential-encryption
  secret rotate independently of the API-key hashing pepper), else
* ``APP_SECRET`` (the existing application secret), else
* ``HYDRASENTRY_CERT_SECRET`` (last-ditch fallback so dev/CI still round-trips).

The secret is run through HKDF-SHA256 to a 32-byte key, urlsafe-base64 encoded
to the exact shape Fernet expects. A raw 32-byte urlsafe-base64 ``ENCRYPTION_KEY``
is also accepted verbatim (the canonical Fernet key shape) so an operator can
paste a ``Fernet.generate_key()`` value directly.

Honesty / fail-closed contract
------------------------------
* ``is_encryption_available()`` is True only when a secret is configured. With
  NO secret the service refuses to STORE a credential rather than persisting a
  weakly-keyed or plaintext value (operating rule #1: never fake real
  encryption). The masked fingerprint is still computable without a key.
* ``encrypt``/``decrypt`` never log the plaintext. ``decrypt`` returns ``None``
  on any tamper/format/key error instead of raising, so the run path fails
  closed to the platform default rather than 500-ing.
"""
from __future__ import annotations

import base64
import hashlib
import logging
import os
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

logger = logging.getLogger("hydrasentry.crypto_box")

# A stable, non-secret context label for the HKDF so the derived credential key
# is domain-separated from any other use of the same application secret.
_HKDF_INFO = b"hydrasentry:provider-credential:v1"
_DERIVED_KEY_BYTES = 32

_warned_no_secret = False


def _raw_secret() -> str:
    """The configured application secret used to derive the encryption key.

    Order: ENCRYPTION_KEY -> APP_SECRET -> HYDRASENTRY_CERT_SECRET -> "".
    Read fresh from the environment each call so a test/process that sets the
    var after import still takes effect (mirrors auth.api_keys._salt)."""
    return (
        os.getenv("ENCRYPTION_KEY")
        or os.getenv("APP_SECRET")
        or os.getenv("HYDRASENTRY_CERT_SECRET")
        or ""
    )


def is_encryption_available() -> bool:
    """True when a secret is configured, so a credential can be encrypted at
    rest. With no secret the store refuses to persist a key (fail-closed)."""
    return bool(_raw_secret())


def _looks_like_fernet_key(value: str) -> bool:
    """Whether ``value`` is already a canonical Fernet key (32 bytes, urlsafe
    base64). If so it is used verbatim instead of being run through HKDF, so an
    operator can paste a ``Fernet.generate_key()`` value as ENCRYPTION_KEY."""
    try:
        decoded = base64.urlsafe_b64decode(value.encode("utf-8"))
    except Exception:  # noqa: BLE001 -- not base64; not a Fernet key
        return False
    return len(decoded) == _DERIVED_KEY_BYTES


def _fernet() -> Optional[Fernet]:
    """Build the Fernet cipher from the configured secret, or ``None`` if no
    secret is configured. Never raises."""
    global _warned_no_secret
    secret = _raw_secret()
    if not secret:
        if not _warned_no_secret:
            logger.warning(
                "ENCRYPTION_KEY / APP_SECRET / HYDRASENTRY_CERT_SECRET unset: "
                "provider credentials cannot be encrypted at rest -- saving a "
                "BYO key is refused until a secret is configured"
            )
            _warned_no_secret = True
        return None
    if _looks_like_fernet_key(secret):
        key = secret.encode("utf-8")
    else:
        derived = HKDF(
            algorithm=hashes.SHA256(),
            length=_DERIVED_KEY_BYTES,
            salt=None,
            info=_HKDF_INFO,
        ).derive(secret.encode("utf-8"))
        key = base64.urlsafe_b64encode(derived)
    return Fernet(key)


def encrypt(plaintext: str) -> Optional[str]:
    """Encrypt a secret to an opaque Fernet token (urlsafe text). Returns
    ``None`` when no secret is configured (caller must refuse to store). Never
    logs the plaintext."""
    cipher = _fernet()
    if cipher is None:
        return None
    token = cipher.encrypt(plaintext.encode("utf-8"))
    return token.decode("utf-8")


def decrypt(token: str) -> Optional[str]:
    """Decrypt a Fernet token back to the plaintext secret, or ``None`` on any
    tamper/format/key error (fail-closed: the run path then uses the platform
    default rather than 500-ing). Never logs the plaintext or the token."""
    cipher = _fernet()
    if cipher is None:
        return None
    try:
        return cipher.decrypt(token.encode("utf-8")).decode("utf-8")
    except (InvalidToken, ValueError, TypeError):
        logger.warning("provider credential decrypt failed (tampered or wrong key)")
        return None


def fingerprint(plaintext: str) -> str:
    """A masked, non-reversible fingerprint of a secret for display/logging.

    Mirrors ``config.key_status``: ``sha256:<first10hex>``. The length is
    deliberately NOT exposed. Safe to store alongside the ciphertext and to
    return to the frontend; the raw key is never revealed."""
    digest = hashlib.sha256(plaintext.encode("utf-8")).hexdigest()
    return f"sha256:{digest[:10]}"
