"""Tests for the bring-your-own-key (BYO) provider credential feature.

Coverage (operating rule #1: genuinely real, not a stub; rule #5: BOLA + no
plaintext leak):

* Encryption round-trips, and the STORED value is ciphertext (never plaintext),
  with only a masked fingerprint exposed.
* Real validation: ``test_key`` actually calls the provider (mocked httpx here,
  but the real call path is exercised) -- a valid key -> ok, a 401 -> invalid.
* A tenant's runs use THEIR model when a credential is set (the run-path binding
  resolves to the tenant provider/model/key); otherwise the platform default.
* BOLA: user A cannot read / use / delete user B's credential (cross-tenant ->
  not found / 404), and a save lands only in the caller's tenant.
* No endpoint or audit log leaks the plaintext key.

All offline: the upstream HTTP call is monkeypatched so no real provider key is
needed, but the genuine validation + encryption code paths run.
"""
from __future__ import annotations

import time

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.testclient import TestClient

import auth.jwt_verifier as jwt_verifier
import crypto_box
import provider_credentials
from db.repo import TenantProviderCredentialRepo, UserRepo

# Reuse the local ES256 keypair pattern from test_auth so a real verify path
# runs offline against a real signature.
_PRIV_KEY = ec.generate_private_key(ec.SECP256R1())
_KID = "byo-key-1"


def _public_jwk() -> dict:
    from jwt.algorithms import ECAlgorithm

    jwk = ECAlgorithm.to_jwk(_PRIV_KEY.public_key(), as_dict=True)
    jwk.update({"kid": _KID, "use": "sig", "alg": "ES256"})
    return jwk


def _mint_jwt(sub: str, email: str) -> str:
    now = int(time.time())
    payload = {
        "sub": sub, "email": email, "aud": "authenticated",
        "iat": now, "exp": now + 3600,
        "iss": "https://test.supabase.co/auth/v1", "role": "authenticated",
    }
    return jwt.encode(payload, _PRIV_KEY, algorithm="ES256", headers={"kid": _KID})


class _FakeSigningKey:
    def __init__(self, key):
        self.key = key


class _FakeJWKClient:
    def __init__(self, *_a, **_k):
        from jwt.algorithms import ECAlgorithm

        self._key = ECAlgorithm.from_jwk(__import__("json").dumps(_public_jwk()))

    def get_signing_key_from_jwt(self, _token):
        return _FakeSigningKey(self._key)


@pytest.fixture()
def jwks(monkeypatch):
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


# --- Encryption round-trip + ciphertext-at-rest -----------------------------

def test_crypto_box_round_trip_and_ciphertext():
    secret = "sk-super-secret-key-value-123"
    token = crypto_box.encrypt(secret)
    assert token is not None
    # The stored token is NOT the plaintext.
    assert secret not in token
    # And it decrypts back to the original.
    assert crypto_box.decrypt(token) == secret


def test_crypto_box_tamper_returns_none():
    token = crypto_box.encrypt("abc123")
    assert token is not None
    tampered = token[:-2] + ("AA" if not token.endswith("AA") else "BB")
    # A tampered token fails closed (None), never returns garbage plaintext.
    assert crypto_box.decrypt(tampered) is None


def test_fingerprint_is_masked_not_reversible():
    fp = crypto_box.fingerprint("sk-aaaaaaaa")
    assert fp.startswith("sha256:")
    assert "sk-aaaaaaaa" not in fp


def test_saved_credential_stores_ciphertext_not_plaintext(clean_app_db):
    _user, tenant = UserRepo.get_or_create_with_tenant("byo-store", "store@x.com")
    raw = "gsk_live_ABC_do_not_store_me"
    dto = provider_credentials.save_credential(
        tenant.id, {"provider": "groq", "model": "m", "api_key": raw}
    )
    # The DTO is masked: no raw key, only a fingerprint.
    assert "api_key" not in dto
    assert dto["key_fingerprint"].startswith("sha256:")
    # The stored row holds CIPHERTEXT, never the plaintext.
    row = TenantProviderCredentialRepo.get_by_provider(tenant.id, "groq")
    assert row is not None
    assert raw not in row.api_key_ciphertext
    assert row.api_key_ciphertext != raw
    # Decrypting the stored ciphertext recovers the original (real encryption).
    assert crypto_box.decrypt(row.api_key_ciphertext) == raw


def test_save_refused_without_encryption_secret(clean_app_db, monkeypatch):
    # No encryption secret configured anywhere -> saving is refused (fail-closed,
    # never persist a plaintext / weakly-keyed value).
    monkeypatch.delenv("ENCRYPTION_KEY", raising=False)
    monkeypatch.delenv("APP_SECRET", raising=False)
    monkeypatch.delenv("HYDRASENTRY_CERT_SECRET", raising=False)
    _user, tenant = UserRepo.get_or_create_with_tenant("byo-nokey", "nk@x.com")
    with pytest.raises(provider_credentials.CredentialValidationError):
        provider_credentials.save_credential(
            tenant.id, {"provider": "groq", "api_key": "x"}
        )


# --- Real validation (mocked upstream, real call path) ----------------------

class _FakeResp:
    def __init__(self, status):
        self.status_code = status


class _FakeHttpxClient:
    def __init__(self, status):
        self._status = status

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def get(self, *a, **k):
        return _FakeResp(self._status)


def _patch_httpx(monkeypatch, status):
    import httpx

    monkeypatch.setattr(
        httpx, "Client", lambda *a, **k: _FakeHttpxClient(status)
    )


def test_test_key_valid(monkeypatch):
    _patch_httpx(monkeypatch, 200)
    result = provider_credentials.test_key("groq", "any-key")
    assert result["ok"] is True
    assert result["status"] == "valid"
    # The verdict NEVER echoes the key.
    assert "any-key" not in str(result)


def test_test_key_invalid_on_401(monkeypatch):
    _patch_httpx(monkeypatch, 401)
    result = provider_credentials.test_key("openai", "bad-key")
    assert result["ok"] is False
    assert result["status"] == "invalid"
    assert "bad-key" not in str(result)


def test_test_key_unreachable_never_raises(monkeypatch):
    import httpx

    def _boom(*a, **k):
        raise httpx.ConnectError("no network")

    monkeypatch.setattr(httpx, "Client", _boom)
    result = provider_credentials.test_key("anthropic", "k")
    assert result["ok"] is False
    assert result["status"] == "unreachable"


def test_test_saved_credential_decrypts_and_validates(clean_app_db, monkeypatch):
    _user, tenant = UserRepo.get_or_create_with_tenant("byo-test", "t@x.com")
    provider_credentials.save_credential(
        tenant.id, {"provider": "groq", "api_key": "stored-key"}
    )
    _patch_httpx(monkeypatch, 200)
    result = provider_credentials.test_saved_credential(tenant.id, "groq")
    assert result["ok"] is True
    # Status was persisted on the row.
    row = TenantProviderCredentialRepo.get_by_provider(tenant.id, "groq")
    assert row.last_status == "valid"


# --- Run-path binding uses the tenant's model when set ----------------------

def test_runtime_for_tenant_uses_saved_provider(clean_app_db):
    _user, tenant = UserRepo.get_or_create_with_tenant("byo-rt", "rt@x.com")
    provider_credentials.save_credential(
        tenant.id, {"provider": "groq", "model": "my-own-model", "api_key": "K123"}
    )
    rt = provider_credentials.runtime_for_tenant(tenant.id, "groq")
    assert rt is not None
    assert rt.source == "tenant"
    assert rt.model == "my-own-model"
    assert rt.api_key == "K123"  # decrypted in-process for the run


def test_runtime_for_tenant_none_when_unset(clean_app_db):
    _user, tenant = UserRepo.get_or_create_with_tenant("byo-none", "n@x.com")
    # No credential saved -> platform default (None).
    assert provider_credentials.runtime_for_tenant(tenant.id, "groq") is None
    # No tenant at all (public demo) -> platform default.
    assert provider_credentials.runtime_for_tenant(None, "groq") is None


def test_runtime_from_request_builds_ephemeral_binding():
    """The simple no-login per-request path builds a binding straight from the
    passed provider/key/model, never touching the store. ``source`` is "request"
    so the run can label it without exposing the key."""
    rt = provider_credentials.runtime_from_request("groq", "REQ-KEY-1", "pick-model")
    assert rt is not None
    assert rt.source == "request"
    assert rt.provider == "groq"
    assert rt.model == "pick-model"
    assert rt.api_key == "REQ-KEY-1"


def test_runtime_from_request_defaults_model_and_rejects_bad_input():
    # Blank model -> falls back to the provider's default model (never empty).
    rt = provider_credentials.runtime_from_request("openai", "K", "")
    assert rt is not None and rt.model
    # Unknown / unsupported provider -> None (falls back to platform default).
    assert provider_credentials.runtime_from_request("notaprovider", "K") is None
    assert provider_credentials.runtime_from_request("local", "K") is None
    # No key -> None (never a keyless binding).
    assert provider_credentials.runtime_from_request("groq", "") is None
    assert provider_credentials.runtime_from_request("groq", None) is None


def test_real_run_binding_resolves_tenant_model(clean_app_db):
    """The real-run binding resolver picks the tenant's BYO model when saved."""
    import real_run

    _user, tenant = UserRepo.get_or_create_with_tenant("byo-bind", "b@x.com")
    provider_credentials.save_credential(
        tenant.id, {"provider": "groq", "model": "tenant-model-x", "api_key": "KK"}
    )
    binding = real_run._resolve_binding(tenant.id)
    assert binding is not None
    assert binding.source == "tenant"
    assert binding.model == "tenant-model-x"


def test_real_run_binding_prefers_request_runtime_over_tenant(clean_app_db):
    """A per-request BYO runtime WINS over a saved tenant credential, so the
    no-login client-side key drives the run even for a signed-in tenant."""
    import real_run

    _user, tenant = UserRepo.get_or_create_with_tenant("byo-req", "req@x.com")
    provider_credentials.save_credential(
        tenant.id, {"provider": "groq", "model": "saved-model", "api_key": "SAVED"}
    )
    req_rt = provider_credentials.runtime_from_request("groq", "REQKEY", "req-model")
    binding = real_run._resolve_binding(tenant.id, req_rt)
    assert binding is not None
    assert binding.source == "request"
    assert binding.model == "req-model"
    assert binding.api_key == "REQKEY"


def test_http_test_just_entered_key_no_login(client, monkeypatch):
    """A just-entered key validates with NO sign-in (the simple no-login path),
    and the key never appears in the response body."""
    _patch_httpx(monkeypatch, 200)
    r = client.post(
        "/settings/providers/test",
        json={"provider": "groq", "api_key": "no-login-probe"},
    )
    assert r.status_code == 200
    assert r.json()["data"]["ok"] is True
    assert "no-login-probe" not in r.text


# --- BOLA: cross-tenant isolation -------------------------------------------

def test_bola_cannot_read_or_delete_other_tenant_credential(clean_app_db):
    _ua, tenant_a = UserRepo.get_or_create_with_tenant("byo-A", "a@x.com")
    _ub, tenant_b = UserRepo.get_or_create_with_tenant("byo-B", "b@x.com")
    provider_credentials.save_credential(
        tenant_a.id, {"provider": "groq", "api_key": "A-secret"}
    )
    # B cannot SEE A's credential.
    assert TenantProviderCredentialRepo.get_by_provider(tenant_b.id, "groq") is None
    assert provider_credentials.get_credential_dto(tenant_b.id, "groq") is None
    assert provider_credentials.list_credentials(tenant_b.id) == []
    # B cannot USE A's key (binding resolves to None for B).
    assert provider_credentials.runtime_for_tenant(tenant_b.id, "groq") is None
    # B cannot DELETE A's credential (-> False -> 404), and A's row survives.
    assert provider_credentials.delete_credential(tenant_b.id, "groq") is False
    assert TenantProviderCredentialRepo.get_by_provider(tenant_a.id, "groq") is not None


# --- HTTP endpoint: gated, masked, BOLA-safe --------------------------------

def test_http_save_requires_user(client):
    # Unauthenticated -> require_user 401.
    r = client.post("/settings/providers", json={"provider": "groq", "api_key": "k"})
    assert r.status_code == 401


def test_http_save_and_list_masked(jwks, client, monkeypatch):
    token = _mint_jwt("sub-http", "http@x.com")
    r = client.post(
        "/settings/providers",
        json={"provider": "groq", "model": "m1", "api_key": "raw-secret-xyz"},
        headers=_bearer(token),
    )
    assert r.status_code == 200, r.text
    dto = r.json()["data"]
    assert "api_key" not in dto
    assert dto["key_fingerprint"].startswith("sha256:")
    # Listing shows the masked credential; the raw key never appears anywhere.
    g = client.get("/settings/providers", headers=_bearer(token))
    assert g.status_code == 200
    body = g.json()["data"]
    assert body["can_configure"] is True
    creds = body["tenant_credentials"]
    assert any(c["provider"] == "groq" for c in creds)
    assert "raw-secret-xyz" not in g.text


def test_http_delete_unknown_is_404(jwks, client):
    token = _mint_jwt("sub-del", "del@x.com")
    r = client.delete("/settings/providers/openai", headers=_bearer(token))
    assert r.status_code == 404


def test_http_test_just_entered_key(jwks, client, monkeypatch):
    _patch_httpx(monkeypatch, 200)
    token = _mint_jwt("sub-tk", "tk@x.com")
    r = client.post(
        "/settings/providers/test",
        json={"provider": "groq", "api_key": "probe-key"},
        headers=_bearer(token),
    )
    assert r.status_code == 200
    assert r.json()["data"]["ok"] is True
    assert "probe-key" not in r.text


def test_http_no_plaintext_in_any_response_or_audit(jwks, client):
    token = _mint_jwt("sub-leak", "leak@x.com")
    raw = "ABSOLUTELY-SECRET-9999"
    client.post(
        "/settings/providers",
        json={"provider": "groq", "api_key": raw},
        headers=_bearer(token),
    )
    # The list response never contains the raw key.
    g = client.get("/settings/providers", headers=_bearer(token))
    assert raw not in g.text
    # The audit log row stores only the fingerprint, never the key.
    from db.repo import AuditLogRepo, UserRepo as UR

    user = UR.get_by_sub("sub-leak")
    assert user is not None
    logs = AuditLogRepo.list(user.tenant_id)
    for entry in logs:
        assert raw not in str(entry.detail)
