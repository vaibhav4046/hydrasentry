"""Tenant-scoped repository with enforced isolation (BOLA defense).

Every read and write REQUIRES a ``tenant_id`` and filters by it. There is no
method that queries a domain table without a tenant predicate -- default-deny.
``get(tenant_id, row_id)`` returns ``None`` when the row exists but belongs to a
different tenant, so a Broken-Object-Level-Authorization probe (tenant B asking
for tenant A's incident id) gets nothing back, never the data.

The repo opens its own short-lived session per call by default (so callers do
not have to manage sessions), but accepts an injected session for tests and for
batching multiple writes in one transaction.
"""
from __future__ import annotations

from contextlib import contextmanager
from typing import Any, Iterator, Optional

from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from db.engine import get_session
from db.models import (
    AuditLog,
    Certificate,
    Incident,
    RegressionRule,
    Tenant,
    User,
)


class TenantScopingError(ValueError):
    """Raised when a repo method is called without a tenant_id. Fail closed:
    a missing tenant scope is a programming error, never a silent full-table
    query."""


def _require_tenant(tenant_id: Optional[str]) -> str:
    if not tenant_id or not isinstance(tenant_id, str) or not tenant_id.strip():
        raise TenantScopingError(
            "tenant_id is required for every repository operation (BOLA defense)"
        )
    return tenant_id


@contextmanager
def _session(session: Optional[Session]) -> Iterator[Session]:
    """Yield the injected session, or open/commit/close a fresh one."""
    if session is not None:
        yield session
        return
    s = get_session()
    try:
        yield s
        s.commit()
    finally:
        s.close()


# --- Tenants ----------------------------------------------------------------
# Tenant rows are the tenancy roots themselves, so they are looked up by slug or
# id rather than scoped by a parent tenant_id.

class TenantRepo:
    @staticmethod
    def get_by_slug(slug: str, *, session: Optional[Session] = None) -> Optional[Tenant]:
        with _session(session) as s:
            return s.exec(select(Tenant).where(Tenant.slug == slug)).first()

    @staticmethod
    def get_by_id(tenant_id: str, *, session: Optional[Session] = None) -> Optional[Tenant]:
        _require_tenant(tenant_id)
        with _session(session) as s:
            return s.get(Tenant, tenant_id)

    @staticmethod
    def ensure(slug: str, name: str, *, session: Optional[Session] = None) -> Tenant:
        """Idempotently get-or-create a tenant by slug.

        Concurrency-safe: two simultaneous inserts of the same slug race on the
        unique constraint; the loser catches the IntegrityError, rolls back, and
        re-reads the now-committed row, so neither caller sees a 500.
        """
        with _session(session) as s:
            existing = s.exec(select(Tenant).where(Tenant.slug == slug)).first()
            if existing is not None:
                return existing
            tenant = Tenant(slug=slug, name=name)
            s.add(tenant)
            try:
                s.flush()
                s.refresh(tenant)
                return tenant
            except IntegrityError:
                s.rollback()
                won = s.exec(select(Tenant).where(Tenant.slug == slug)).first()
                if won is None:
                    raise
                return won


class _ScopedRepo:
    """Base for tenant-scoped domain repos. ``model`` is set by subclasses."""

    model: Any

    @classmethod
    def create(
        cls, tenant_id: str, *, session: Optional[Session] = None, **fields: Any
    ) -> Any:
        tid = _require_tenant(tenant_id)
        with _session(session) as s:
            row = cls.model(tenant_id=tid, **fields)
            s.add(row)
            s.flush()
            s.refresh(row)
            return row

    @classmethod
    def get(
        cls, tenant_id: str, row_id: str, *, session: Optional[Session] = None
    ) -> Optional[Any]:
        """Return the row only if it belongs to ``tenant_id`` -- else ``None``.

        This is the BOLA gate: the query filters on BOTH the primary key and the
        tenant_id, so a row owned by another tenant is invisible.
        """
        tid = _require_tenant(tenant_id)
        with _session(session) as s:
            stmt = select(cls.model).where(
                cls.model.id == row_id, cls.model.tenant_id == tid
            )
            return s.exec(stmt).first()

    @classmethod
    def list(
        cls, tenant_id: str, *, limit: int = 200, session: Optional[Session] = None
    ) -> list[Any]:
        """List this tenant's rows, newest first. Always tenant-filtered."""
        tid = _require_tenant(tenant_id)
        with _session(session) as s:
            stmt = (
                select(cls.model)
                .where(cls.model.tenant_id == tid)
                .order_by(cls.model.created_at.desc())
                .limit(limit)
            )
            return list(s.exec(stmt).all())


class IncidentRepo(_ScopedRepo):
    model = Incident


class CertificateRepo(_ScopedRepo):
    model = Certificate

    @classmethod
    def for_incident(
        cls, tenant_id: str, incident_id: str, *, session: Optional[Session] = None
    ) -> list[Certificate]:
        tid = _require_tenant(tenant_id)
        with _session(session) as s:
            stmt = (
                select(Certificate)
                .where(
                    Certificate.tenant_id == tid,
                    Certificate.incident_id == incident_id,
                )
                .order_by(Certificate.created_at.desc())
            )
            return list(s.exec(stmt).all())


class RegressionRuleRepo(_ScopedRepo):
    model = RegressionRule


class AuditLogRepo(_ScopedRepo):
    model = AuditLog


class UserRepo:
    """Users carry an optional tenant_id (Phase 2 wires real auth)."""

    @staticmethod
    def create(
        email: str,
        tenant_id: Optional[str] = None,
        *,
        session: Optional[Session] = None,
    ) -> User:
        with _session(session) as s:
            user = User(email=email, tenant_id=tenant_id)
            s.add(user)
            s.flush()
            s.refresh(user)
            return user

    @staticmethod
    def get_by_email(email: str, *, session: Optional[Session] = None) -> Optional[User]:
        with _session(session) as s:
            return s.exec(select(User).where(User.email == email)).first()
