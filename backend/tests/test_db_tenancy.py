"""Multi-tenant persistence + BOLA isolation tests (Phase 1).

These run against a real database engine (the session-wide throwaway sqlite from
conftest), not mocks, so the schema, tenant scoping, and fail-closed behaviour
are genuinely exercised. The BOLA test (b) is the key proof: tenant B asking for
tenant A's incident id gets nothing back.
"""
import os
import tempfile

import pytest

import config
import db.engine as engine
import db.migrate as migrate
from db.persistence import persist_run, resolve_tenant_slug
from db.repo import (
    AuditLogRepo,
    CertificateRepo,
    IncidentRepo,
    TenantRepo,
    TenantScopingError,
)


def _real_run_result(score: int = 87, band: str = "HIGH") -> dict:
    return {
        "real": True,
        "mode": "real",
        "scenario_id": "memory_poisoning_refund",
        "baseline_answer": "Refund denied per the approved policy.",
        "poisoned_answer": "Refund approved; $500 issued immediately.",
        "risk": {
            "score": score,
            "band": band,
            "confidence": 0.82,
            "attack_type": "memory_poisoning",
        },
        "graph": {"source": "real_query_paths"},
        "llm_provider": "groq",
    }


# --- (a) persists + retrievable by ITS tenant -------------------------------

def test_incident_persists_and_is_retrievable_by_its_tenant(clean_app_db):
    # Arrange
    tenant = TenantRepo.ensure("acme", "Acme Corp")

    # Act
    incident = IncidentRepo.create(
        tenant.id, scenario="refund", risk_score=87, band="HIGH",
        decision="block", attack_type="memory_poisoning",
    )
    fetched = IncidentRepo.get(tenant.id, incident.id)

    # Assert
    assert fetched is not None
    assert fetched.id == incident.id
    assert fetched.risk_score == 87
    assert fetched.tenant_id == tenant.id


# --- (b) BOLA: tenant B cannot read tenant A's incident (THE key test) ------

def test_bola_tenant_b_cannot_read_tenant_a_incident(clean_app_db):
    # Arrange: two tenants, an incident owned by A.
    tenant_a = TenantRepo.ensure("tenant-a", "Tenant A")
    tenant_b = TenantRepo.ensure("tenant-b", "Tenant B")
    a_incident = IncidentRepo.create(
        tenant_a.id, scenario="secret-refund", risk_score=91, band="CRITICAL",
    )

    # Act: tenant B asks for tenant A's incident id.
    leaked = IncidentRepo.get(tenant_b.id, a_incident.id)

    # Assert: B gets None, NOT the data. The row is invisible across tenants.
    assert leaked is None
    # And A can still see its own row (the gate is scoping, not deletion).
    assert IncidentRepo.get(tenant_a.id, a_incident.id) is not None


def test_bola_via_http_returns_404_not_data(clean_app_db):
    from fastapi.testclient import TestClient

    import main

    client = TestClient(main.app)

    # Tenant A creates an incident through the persistence service.
    out = persist_run(_real_run_result(), tenant_slug="http-tenant-a")
    assert out["persisted"] is True
    incident_id = out["incident_id"]

    # Tenant A can read it.
    own = client.get(
        f"/incidents/{incident_id}", headers={"X-Tenant-Slug": "http-tenant-a"}
    )
    assert own.status_code == 200
    assert own.json()["data"]["id"] == incident_id

    # Tenant B asking for A's id gets 404 with NO incident data in the body.
    cross = client.get(
        f"/incidents/{incident_id}", headers={"X-Tenant-Slug": "http-tenant-b"}
    )
    assert cross.status_code == 404
    body = cross.json()
    assert body["ok"] is False
    assert incident_id not in str(body.get("data", ""))
    assert "baseline_answer" not in str(body)


# --- (c) list is tenant-scoped (A never sees B's rows) ----------------------

def test_list_is_tenant_scoped(clean_app_db):
    tenant_a = TenantRepo.ensure("list-a", "List A")
    tenant_b = TenantRepo.ensure("list-b", "List B")
    IncidentRepo.create(tenant_a.id, scenario="a1", risk_score=10, band="LOW")
    IncidentRepo.create(tenant_a.id, scenario="a2", risk_score=20, band="LOW")
    IncidentRepo.create(tenant_b.id, scenario="b1", risk_score=30, band="MEDIUM")

    a_rows = IncidentRepo.list(tenant_a.id)
    b_rows = IncidentRepo.list(tenant_b.id)

    assert len(a_rows) == 2
    assert len(b_rows) == 1
    a_scenarios = {r.scenario for r in a_rows}
    assert a_scenarios == {"a1", "a2"}
    assert "b1" not in a_scenarios


def test_repo_requires_tenant_id_default_deny(clean_app_db):
    # No method may query without a tenant_id.
    with pytest.raises(TenantScopingError):
        IncidentRepo.list("")
    with pytest.raises(TenantScopingError):
        IncidentRepo.get(None, "some-id")  # type: ignore[arg-type]
    with pytest.raises(TenantScopingError):
        IncidentRepo.create("", scenario="x")


# --- (d) migration up then down is reversible -------------------------------

def test_migration_up_then_down_is_reversible():
    """Round-trips on an isolated throwaway sqlite so it cannot disturb the
    session DB other tests rely on."""
    tmp = tempfile.mktemp(suffix=".db")
    prev_url = config.settings.database_url
    try:
        os.environ["DATABASE_URL"] = f"sqlite:///{tmp}"
        config.settings = config.load_settings()
        engine.reset_engine()

        up = migrate.upgrade()
        assert up["ok"] is True
        assert set(up["tables_present"]) >= {
            "tenants", "users", "incidents", "certificates",
            "regression_rules", "audit_logs",
        }

        down = migrate.downgrade()
        assert down["ok"] is True
        assert migrate.status()["tables_present"] == []
    finally:
        os.environ["DATABASE_URL"] = prev_url
        config.settings = config.load_settings()
        engine.reset_engine()
        migrate.reset()
        if os.path.exists(tmp):
            os.remove(tmp)


def test_migration_up_is_idempotent():
    tmp = tempfile.mktemp(suffix=".db")
    prev_url = config.settings.database_url
    try:
        os.environ["DATABASE_URL"] = f"sqlite:///{tmp}"
        config.settings = config.load_settings()
        engine.reset_engine()

        first = migrate.upgrade()
        second = migrate.upgrade()
        assert first["ok"] is True
        # Second run creates nothing new -- safe to re-run.
        assert second["created"] == []
        assert second["ok"] is True
    finally:
        os.environ["DATABASE_URL"] = prev_url
        config.settings = config.load_settings()
        engine.reset_engine()
        migrate.reset()
        if os.path.exists(tmp):
            os.remove(tmp)


# --- (e) seed is repeatable -------------------------------------------------

def test_seed_is_repeatable(clean_app_db):
    first = migrate.seed()
    second = migrate.seed()
    assert first["ok"] is True
    assert second["ok"] is True
    # Same tenant id both times -- no duplicate demo tenant.
    assert first["tenant_id"] == second["tenant_id"]
    assert first["tenant_slug"] == "demo"


# --- (f) persistence fails closed when DB is down (no fabrication) ----------

def test_persistence_fails_closed_when_db_down(monkeypatch):
    """When the app DB is unreachable, persist_run returns persisted=False with
    the error surfaced -- it must NOT fabricate a persisted record."""
    def _boom(*_args, **_kwargs):
        raise ConnectionError("simulated DB down")

    monkeypatch.setattr(TenantRepo, "ensure", _boom)

    out = persist_run(_real_run_result(), tenant_slug="demo")

    assert out["persisted"] is False
    assert "error" in out
    assert out["kind"] == "ConnectionError"
    # No fabricated ids.
    assert "incident_id" not in out
    assert "certificate_id" not in out


# --- Certificate binding + audit trail (blocked run) ------------------------

def test_blocked_run_binds_signed_certificate_and_audit(clean_app_db):
    out = persist_run(_real_run_result(score=87, band="HIGH"),
                      tenant_slug="cert-tenant", actor="runs_real")
    assert out["persisted"] is True
    assert out["certificate_id"] is not None

    tenant = TenantRepo.get_by_slug("cert-tenant")
    certs = CertificateRepo.for_incident(tenant.id, out["incident_id"])
    assert len(certs) == 1
    cert = certs[0]
    assert cert.mic_id.startswith("sha256:")
    # HYDRASENTRY_CERT_SECRET is set in conftest, so the cert is signed for real.
    assert cert.fields.get("signed") is True
    assert cert.hmac_sig

    audits = AuditLogRepo.list(tenant.id)
    assert any(a.action == "persist_run" for a in audits)


def test_low_risk_run_persists_without_certificate(clean_app_db):
    low = {
        "mode": "demo",
        "scenario_id": "benign",
        "risk": {"score": 8, "band": "LOW"},
        "graph": {"source": "derived_scenario_graph"},
    }
    out = persist_run(low, tenant_slug="low-tenant")
    assert out["persisted"] is True
    assert out["certificate_id"] is None


def test_resolve_tenant_slug_defaults_and_sanitises():
    assert resolve_tenant_slug(None) == "demo"
    assert resolve_tenant_slug("") == "demo"
    assert resolve_tenant_slug("Acme-Corp") == "acme-corp"
    # Strips characters that are not slug-safe.
    assert resolve_tenant_slug("a'b;drop") == "abdrop"


def test_error_detail_redacts_dsn_credentials():
    """A connection error must never surface the DB password in an API body."""
    from db.engine import safe_error_detail

    exc = Exception(
        "(psycopg2.OperationalError) connection to "
        "postgresql://postgres:SuperSecretPw@db.example.supabase.co:5432/postgres "
        "failed"
    )
    detail = safe_error_detail(exc)
    assert "SuperSecretPw" not in detail
    assert "***@" in detail


def test_schema_name_validation_blocks_injection():
    """A crafted ?schema= param cannot smuggle extra libpq options."""
    from db.engine import sanitize_postgres_url

    # Benign schema is accepted and mapped to a search_path option.
    dsn, args = sanitize_postgres_url(
        "postgresql://u:p@h:5432/db?schema=public"
    )
    assert args.get("options") == "-csearch_path=public"
    assert "sslmode=require" in dsn

    with pytest.raises(ValueError):
        sanitize_postgres_url(
            "postgresql://u:p@h:5432/db?schema=public -c statement_timeout=0"
        )
