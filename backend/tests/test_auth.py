"""Phase 2 auth tests: Supabase-JWT (via JWKS) + per-user API keys.

Red-team coverage (operating rule #5), all offline:
* (a) a forged / expired / wrong-audience JWT is rejected 401 -- not accepted,
  not silently downgraded to the demo tenant.
* (b) an unknown / revoked API key is 401.
* (c) the raw API key is never stored and never returned except once at creation.
* (d) user A cannot read user B's incidents or API keys under REAL auth
  (tenant isolation holds with credentials, not just the old header).
* (e) an unauthenticated request still works against the demo tenant (public
  showcase preserved).
* (f) key verification uses a constant-time compare.

The JWKS is mocked with a locally-generated EC (ES256) keypair so the verifier's
real ``jwt.decode`` path runs against a real signature without any network.
"""
from __future__ import annotations

import time
import uuid

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.testclient import TestClient

import auth.api_keys as api_keys_mod
import auth.jwt_verifier as jwt_verifier
from auth.identity import resolve_identity
from auth.service import AuthError, resolve_api_key
from db.repo import ApiKeyRepo, IncidentRepo, UserRepo


# --- Local ES256 keypair + JWKS, so the real verify path runs offline --------

_PRIV_KEY = ec.generate_private_key(ec.SECP256R1())
_KID = "test-key-1"


def _public_jwk() -> dict:
    """Export the test public key as a JWK the verifier's JWKS client returns."""
    from jwt.algorithms import ECAlgorithm

    pub = _PRIV_KEY.public_key()
    jwk = ECAlgorithm.to_jwk(pub, as_dict=True)
    jwk.update({"kid": _KID, "use": "sig", "alg": "ES256"})
    return jwk


def _mint_jwt(
    sub: str,
    email: str,
    *,
    aud: str = "authenticated",
    exp_delta: int = 3600,
    key=None,
    alg: str = "ES256",
) -> str:
    now = int(time.time())
    payload = {
        "sub": sub,
        "email": email,
        "aud": aud,
        "iat": now,
        "exp": now + exp_delta,
        "iss": "https://test.supabase.co/auth/v1",
        "role": "authenticated",
    }
    headers = {"kid": _KID} if alg == "ES256" else {}
    return jwt.encode(payload, key or _PRIV_KEY, algorithm=alg, headers=headers)


class _FakeSigningKey:
    def __init__(self, key):
        self.key = key


class _FakeJWKClient:
    """Stands in for PyJWKClient: returns our local public key for any token."""

    def __init__(self, *_a, **_k):
        from jwt.algorithms import ECAlgorithm

        self._key = ECAlgorithm.from_jwk(__import__("json").dumps(_public_jwk()))

    def get_signing_key_from_jwt(self, _token):
        return _FakeSigningKey(self._key)


@pytest.fixture()
def jwks(monkeypatch):
    """Point the verifier at the local fake JWKS + a configured SUPABASE_URL."""
    monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
    jwt_verifier.reset_jwks_cache()
    monkeypatch.setattr(jwt_verifier, "PyJWKClient", _FakeJWKClient)
    yield
    jwt_verifier.reset_jwks_cache()


@pytest.fixture()
def client(clean_app_db):
    import main

    return TestClient(main.app)


def _bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# --- (a) forged / expired / wrong-aud JWT -> 401, never demo -----------------

def test_forged_jwt_signature_is_rejected_401(jwks, client):
    # Signed with a DIFFERENT key than the JWKS publishes -> bad signature.
    other = ec.generate_private_key(ec.SECP256R1())
    forged = _mint_jwt("attacker", "evil@x.com", key=other)
    r = client.get("/incidents", headers=_bearer(forged))
    assert r.status_code == 401
    # And nothing leaked / no demo downgrade.
    assert "data" not in r.json() or r.json().get("ok") is False


def test_expired_jwt_is_rejected_401(jwks, client):
    expired = _mint_jwt("u1", "u1@x.com", exp_delta=-3600)
    r = client.get("/incidents", headers=_bearer(expired))
    assert r.status_code == 401


def test_wrong_audience_jwt_is_rejected_401(jwks, client):
    bad_aud = _mint_jwt("u1", "u1@x.com", aud="anon")
    r = client.get("/incidents", headers=_bearer(bad_aud))
    assert r.status_code == 401


def test_garbage_bearer_is_rejected_401(jwks, client):
    r = client.get("/incidents", headers=_bearer("not.a.jwt"))
    assert r.status_code == 401


def test_alg_none_token_is_rejected_401(jwks, client):
    # alg=none unsigned token must never be accepted (classic JWT bypass).
    unsigned = jwt.encode(
        {"sub": "x", "email": "x@x.com", "aud": "authenticated",
         "exp": int(time.time()) + 3600,
         "iss": "https://test.supabase.co/auth/v1"},
        key=None, algorithm="none",
    )
    r = client.get("/incidents", headers=_bearer(unsigned))
    assert r.status_code == 401


def test_wrong_issuer_jwt_is_rejected_401(jwks, client):
    # A validly-signed token from a DIFFERENT project (wrong iss) is rejected.
    now = int(time.time())
    token = jwt.encode(
        {"sub": "x", "email": "x@x.com", "aud": "authenticated",
         "iat": now, "exp": now + 3600,
         "iss": "https://EVIL.supabase.co/auth/v1"},
        _PRIV_KEY, algorithm="ES256", headers={"kid": _KID},
    )
    r = client.get("/incidents", headers=_bearer(token))
    assert r.status_code == 401


def test_valid_jwt_syncs_user_and_resolves_own_tenant(jwks, client):
    sub = f"user-{uuid.uuid4()}"
    token = _mint_jwt(sub, "alice@x.com")
    r = client.post("/auth/sync", headers=_bearer(token))
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["auth_method"] == "jwt"
    assert data["email"] == "alice@x.com"
    assert data["tenant_id"]
    # Idempotent: a second sync returns the SAME tenant (one tenant per user).
    r2 = client.post("/auth/sync", headers=_bearer(token))
    assert r2.json()["data"]["tenant_id"] == data["tenant_id"]


# --- (b) unknown / revoked API key -> 401 ------------------------------------

def test_unknown_api_key_is_rejected_401(client):
    r = client.get("/incidents", headers={"X-API-Key": "hs_live_totallyfake"})
    assert r.status_code == 401


def test_revoked_api_key_is_rejected_401(client):
    user, tenant = UserRepo.get_or_create_with_tenant("sub-rev", "rev@x.com")
    gen = api_keys_mod.new_key()
    row = ApiKeyRepo.create(
        user_id=user.id, tenant_id=tenant.id, name="k",
        key_hash=gen.key_hash, prefix=gen.prefix,
    )
    # Works before revoke.
    ok_resp = client.get("/incidents", headers={"X-API-Key": gen.raw})
    assert ok_resp.status_code == 200
    # Revoke then it is 401.
    ApiKeyRepo.revoke(user.id, row.id)
    after = client.get("/incidents", headers={"X-API-Key": gen.raw})
    assert after.status_code == 401


def test_malformed_api_key_header_is_rejected_401(client):
    # A non-empty X-API-Key that is not even shaped like a key is still a
    # presented credential -> reject, never demo fallback.
    r = client.get("/incidents", headers={"X-API-Key": "garbage"})
    assert r.status_code == 401


# --- (c) raw key never stored / returned except once -------------------------

def test_raw_key_returned_once_and_never_stored(jwks, client):
    token = _mint_jwt(f"sub-{uuid.uuid4()}", "store@x.com")
    created = client.post("/api-keys", json={"name": "agent"}, headers=_bearer(token))
    assert created.status_code == 200
    body = created.json()["data"]
    raw = body["raw_key"]
    assert raw.startswith("hs_live_")

    # The stored row holds only a salted hash + prefix, NOT the raw key.
    from db.engine import get_session
    from db.models import ApiKey

    with get_session() as s:
        row = s.get(ApiKey, body["id"])
        assert row.key_hash != raw
        assert raw not in row.key_hash
        assert row.key_hash == api_keys_mod.hash_key(raw)
        assert not hasattr(row, "raw_key") or getattr(row, "raw_key", None) is None

    # Listing never returns the raw key again.
    listing = client.get("/api-keys", headers=_bearer(token))
    assert listing.status_code == 200
    for item in listing.json()["data"]:
        assert "raw_key" not in item
        assert raw not in str(item)


# --- (d) BOLA under real auth: user A cannot see user B's data ---------------

def test_api_key_run_lands_in_owners_tenant_not_demo(client):
    """Connect-your-agent: an API-key run persists into the KEY's tenant, and
    the same key reads it back -- proving it did NOT land in demo."""
    user, tenant = UserRepo.get_or_create_with_tenant("sub-agent", "agent@x.com")
    gen = api_keys_mod.new_key()
    ApiKeyRepo.create(
        user_id=user.id, tenant_id=tenant.id, name="agent",
        key_hash=gen.key_hash, prefix=gen.prefix,
    )
    # Seed an incident directly in the owner tenant (stand-in for a real run).
    inc = IncidentRepo.create(tenant.id, scenario="agent-run", risk_score=87, band="HIGH")

    # The key reads its own incident back.
    own = client.get("/incidents", headers={"X-API-Key": gen.raw})
    assert own.status_code == 200
    ids = {i["id"] for i in own.json()["data"]}
    assert inc.id in ids

    # The unauthenticated demo caller does NOT see the agent's incident.
    demo = client.get("/incidents")
    demo_ids = {i["id"] for i in demo.json()["data"]}
    assert inc.id not in demo_ids


def test_user_a_cannot_read_user_b_incident_under_auth(jwks, client):
    # User A (JWT) creates an incident in A's tenant.
    a_token = _mint_jwt("sub-A", "a@x.com")
    client.post("/auth/sync", headers=_bearer(a_token))
    _, a_tenant = UserRepo.get_or_create_with_tenant("sub-A", "a@x.com")
    a_inc = IncidentRepo.create(a_tenant.id, scenario="a-secret", risk_score=91, band="CRITICAL")

    # User B (JWT) asks for A's incident id -> 404, no data leak.
    b_token = _mint_jwt("sub-B", "b@x.com")
    cross = client.get(f"/incidents/{a_inc.id}", headers=_bearer(b_token))
    assert cross.status_code == 404
    assert "a-secret" not in str(cross.json())

    # A can still read its own.
    own = client.get(f"/incidents/{a_inc.id}", headers=_bearer(a_token))
    assert own.status_code == 200
    assert own.json()["data"]["id"] == a_inc.id


def test_user_a_cannot_list_or_revoke_user_b_api_keys(jwks, client):
    # B mints a key.
    b_token = _mint_jwt("sub-B2", "b2@x.com")
    b_created = client.post("/api-keys", json={"name": "b-key"}, headers=_bearer(b_token))
    b_key_id = b_created.json()["data"]["id"]

    # A lists keys -> sees only its own (none), never B's.
    a_token = _mint_jwt("sub-A2", "a2@x.com")
    a_list = client.get("/api-keys", headers=_bearer(a_token))
    assert a_list.status_code == 200
    assert all(k["id"] != b_key_id for k in a_list.json()["data"])

    # A tries to revoke B's key -> 404 (not B's owner), key stays usable for B.
    a_revoke = client.delete(f"/api-keys/{b_key_id}", headers=_bearer(a_token))
    assert a_revoke.status_code == 404
    b_list = client.get("/api-keys", headers=_bearer(b_token))
    assert any(k["id"] == b_key_id and not k["revoked"] for k in b_list.json()["data"])


# --- (e) unauthenticated still works against the demo tenant -----------------

def test_unauthenticated_incidents_uses_demo_tenant(client):
    r = client.get("/incidents")
    assert r.status_code == 200
    assert r.json()["ok"] is True
    # demo tenant exists (seeded), so it is a list, not an error.
    assert isinstance(r.json()["data"], list)


def test_user_data_endpoints_require_real_user(jwks, client):
    # Unauthenticated -> 401 on the management endpoints (default-deny).
    assert client.get("/api-keys").status_code == 401
    assert client.post("/api-keys", json={}).status_code == 401
    assert client.post("/auth/sync").status_code == 401
    # An API key is NOT a user -> cannot manage keys.
    user, tenant = UserRepo.get_or_create_with_tenant("sub-akmgmt", "ak@x.com")
    gen = api_keys_mod.new_key()
    ApiKeyRepo.create(
        user_id=user.id, tenant_id=tenant.id, name="k",
        key_hash=gen.key_hash, prefix=gen.prefix,
    )
    assert client.get("/api-keys", headers={"X-API-Key": gen.raw}).status_code == 401


# --- (f) constant-time compare + pure resolver fail-closed -------------------

def test_key_verification_uses_constant_time_compare(monkeypatch):
    calls = {"n": 0}
    real = api_keys_mod.constant_time_match

    def _spy(a, b):
        calls["n"] += 1
        return real(a, b)

    monkeypatch.setattr(api_keys_mod, "constant_time_match", _spy)
    # Patch the resolver's bound reference too (it imports the module symbol).
    import auth.service as svc
    monkeypatch.setattr(svc.api_keys, "constant_time_match", _spy)

    with pytest.raises(AuthError):
        resolve_api_key("hs_live_doesnotexist")
    assert calls["n"] >= 1  # the compare ran even on the not-found path


def test_resolver_absence_is_demo_presence_invalid_is_error(clean_app_db):
    from fastapi import HTTPException

    # No credentials -> demo (public showcase).
    demo = resolve_identity(api_key=None, authorization=None)
    assert demo.auth_method == "demo"

    # Present-but-invalid API key -> HTTPException 401 (never demo).
    with pytest.raises(HTTPException) as ei:
        resolve_identity(api_key="hs_live_bogus", authorization=None)
    assert ei.value.status_code == 401

    # Present-but-invalid bearer -> 401.
    with pytest.raises(HTTPException) as ej:
        resolve_identity(api_key=None, authorization="Bearer not.a.token")
    assert ej.value.status_code == 401
