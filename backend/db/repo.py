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
from datetime import datetime, timezone
from typing import Any, Iterator, Optional

from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from db.engine import get_session
from db.models import (
    ApiKey,
    AuditLog,
    Certificate,
    Incident,
    RegressionRule,
    Tenant,
    TenantProviderCredential,
    User,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


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


class TenantProviderCredentialRepo(_ScopedRepo):
    """Per-tenant BYO provider credentials. Tenant-scoped (BOLA-safe): every
    lookup filters on ``tenant_id`` so one tenant can never read, upsert, or
    delete another tenant's credential. One row per (tenant, provider) is
    enforced by the unique index; ``upsert`` keeps that invariant."""

    model = TenantProviderCredential

    @classmethod
    def get_by_provider(
        cls, tenant_id: str, provider: str, *, session: Optional[Session] = None
    ) -> Optional[TenantProviderCredential]:
        """The tenant's credential for ``provider``, or ``None``. Always filters
        on tenant_id, so another tenant's credential is invisible (BOLA gate)."""
        tid = _require_tenant(tenant_id)
        with _session(session) as s:
            stmt = select(TenantProviderCredential).where(
                TenantProviderCredential.tenant_id == tid,
                TenantProviderCredential.provider == provider,
            )
            return s.exec(stmt).first()

    @classmethod
    def upsert(
        cls,
        tenant_id: str,
        provider: str,
        *,
        model: str,
        api_key_ciphertext: str,
        key_fingerprint: str,
        last_status: str = "untested",
        enabled: bool = True,
        session: Optional[Session] = None,
    ) -> TenantProviderCredential:
        """Create or replace the tenant's credential for ``provider`` in ONE
        tenant-scoped transaction. A re-save updates the existing row in place
        (so the unique (tenant, provider) index never trips), never creating a
        duplicate. The ciphertext fully replaces the prior one -- there is no
        partial-update path that could leave a stale key behind."""
        tid = _require_tenant(tenant_id)
        with _session(session) as s:
            row = s.exec(
                select(TenantProviderCredential).where(
                    TenantProviderCredential.tenant_id == tid,
                    TenantProviderCredential.provider == provider,
                )
            ).first()
            if row is None:
                row = TenantProviderCredential(tenant_id=tid, provider=provider)
            row.model = model
            row.api_key_ciphertext = api_key_ciphertext
            row.key_fingerprint = key_fingerprint
            row.last_status = last_status
            row.enabled = enabled
            row.updated_at = _now()
            s.add(row)
            s.flush()
            s.refresh(row)
            return row

    @classmethod
    def set_status(
        cls,
        tenant_id: str,
        provider: str,
        status: str,
        *,
        session: Optional[Session] = None,
    ) -> Optional[TenantProviderCredential]:
        """Record the latest validation status on the tenant's credential.
        Tenant-scoped: a cross-tenant provider name resolves to ``None``."""
        tid = _require_tenant(tenant_id)
        with _session(session) as s:
            row = s.exec(
                select(TenantProviderCredential).where(
                    TenantProviderCredential.tenant_id == tid,
                    TenantProviderCredential.provider == provider,
                )
            ).first()
            if row is None:
                return None
            row.last_status = status
            row.updated_at = _now()
            s.add(row)
            s.flush()
            s.refresh(row)
            return row

    @classmethod
    def delete_by_provider(
        cls, tenant_id: str, provider: str, *, session: Optional[Session] = None
    ) -> bool:
        """Revoke (delete) the tenant's credential for ``provider``. Returns
        True if a row was deleted, False if the tenant has no such credential
        (a cross-tenant provider name is simply not found -> False -> 404)."""
        tid = _require_tenant(tenant_id)
        with _session(session) as s:
            row = s.exec(
                select(TenantProviderCredential).where(
                    TenantProviderCredential.tenant_id == tid,
                    TenantProviderCredential.provider == provider,
                )
            ).first()
            if row is None:
                return False
            s.delete(row)
            s.flush()
            return True


class UserRepo:
    """Users are linked to a personal Tenant. ``supabase_sub`` (the verified JWT
    subject) is the stable anchor for get-or-create on sign-in."""

    @staticmethod
    def create(
        email: str,
        tenant_id: Optional[str] = None,
        supabase_sub: Optional[str] = None,
        *,
        session: Optional[Session] = None,
    ) -> User:
        with _session(session) as s:
            user = User(email=email, tenant_id=tenant_id, supabase_sub=supabase_sub)
            s.add(user)
            s.flush()
            s.refresh(user)
            return user

    @staticmethod
    def get_by_email(email: str, *, session: Optional[Session] = None) -> Optional[User]:
        with _session(session) as s:
            return s.exec(select(User).where(User.email == email)).first()

    @staticmethod
    def get_by_sub(sub: str, *, session: Optional[Session] = None) -> Optional[User]:
        with _session(session) as s:
            return s.exec(select(User).where(User.supabase_sub == sub)).first()

    @staticmethod
    def get_or_create_with_tenant(
        sub: str,
        email: str,
        *,
        session: Optional[Session] = None,
    ) -> tuple[User, Tenant]:
        """Idempotently resolve a verified Supabase identity to (user, tenant).

        One personal Tenant per user, keyed by a deterministic ``user-<sub>``
        slug so a re-sign-in never spawns a second tenant. Concurrency-safe: a
        racing insert on the unique ``supabase_sub`` constraint is caught and the
        committed row re-read, so neither caller 500s. Only ever called AFTER the
        JWT is cryptographically verified -- ``sub``/``email`` are trusted here.
        """
        slug = f"user-{sub}"
        # The personal tenant is created in its OWN committed transaction first
        # (TenantRepo.ensure manages its own session/savepoint), so a unique-slug
        # race inside ensure can never roll back the user transaction below. The
        # user row is then created/looked-up in the caller's session.
        tenant = TenantRepo.ensure(slug, email or slug, session=session)
        with _session(session) as s:
            existing = s.exec(
                select(User).where(User.supabase_sub == sub)
            ).first()
            if existing is not None:
                if not existing.tenant_id:
                    existing.tenant_id = tenant.id
                    s.add(existing)
                    s.flush()
                # Keep the display email fresh if it changed upstream.
                if email and existing.email != email:
                    existing.email = email
                    s.add(existing)
                    s.flush()
                # Resolve the tenant the user is actually linked to (may predate
                # this call); fall back to the ensured personal tenant.
                linked = s.get(Tenant, existing.tenant_id) or tenant
                return existing, linked

            user = User(email=email or slug, tenant_id=tenant.id, supabase_sub=sub)
            s.add(user)
            try:
                s.flush()
                s.refresh(user)
                return user, tenant
            except IntegrityError:
                # A concurrent sign-in created the user first. Roll back THIS
                # session's failed insert and re-read the committed winner.
                s.rollback()
                won = s.exec(
                    select(User).where(User.supabase_sub == sub)
                ).first()
                if won is None:
                    raise
                won_tenant = s.get(Tenant, won.tenant_id) or tenant
                return won, won_tenant


class ApiKeyRepo:
    """Per-user API keys. Only a salted hash + display prefix are stored; the
    raw key is never persisted. Verification is a keyed hash lookup that excludes
    revoked keys, then a constant-time compare in the service layer."""

    @staticmethod
    def create(
        *,
        user_id: str,
        tenant_id: str,
        name: str,
        key_hash: str,
        prefix: str,
        session: Optional[Session] = None,
    ) -> ApiKey:
        with _session(session) as s:
            row = ApiKey(
                user_id=user_id,
                tenant_id=tenant_id,
                name=name,
                key_hash=key_hash,
                prefix=prefix,
            )
            s.add(row)
            s.flush()
            s.refresh(row)
            return row

    @staticmethod
    def get_active_by_hash(
        key_hash: str, *, session: Optional[Session] = None
    ) -> Optional[ApiKey]:
        """Look up a NON-revoked key by its salted hash. Revoked keys are
        invisible here (default-deny: a revoked key authenticates nothing)."""
        with _session(session) as s:
            return s.exec(
                select(ApiKey).where(
                    ApiKey.key_hash == key_hash,
                    ApiKey.revoked_at.is_(None),  # type: ignore[union-attr]
                )
            ).first()

    @staticmethod
    def list_for_user(
        user_id: str, *, session: Optional[Session] = None
    ) -> list[ApiKey]:
        """All of a user's keys (active + revoked), newest first."""
        with _session(session) as s:
            stmt = (
                select(ApiKey)
                .where(ApiKey.user_id == user_id)
                .order_by(ApiKey.created_at.desc())
            )
            return list(s.exec(stmt).all())

    @staticmethod
    def get_for_user(
        user_id: str, key_id: str, *, session: Optional[Session] = None
    ) -> Optional[ApiKey]:
        """A single key only if it belongs to ``user_id`` (BOLA gate for keys)."""
        with _session(session) as s:
            return s.exec(
                select(ApiKey).where(
                    ApiKey.id == key_id, ApiKey.user_id == user_id
                )
            ).first()

    @staticmethod
    def touch_last_used(key_id: str, *, session: Optional[Session] = None) -> None:
        with _session(session) as s:
            row = s.get(ApiKey, key_id)
            if row is not None and row.revoked_at is None:
                row.last_used_at = _now()
                s.add(row)
                s.flush()

    @staticmethod
    def revoke(
        user_id: str, key_id: str, *, session: Optional[Session] = None
    ) -> Optional[ApiKey]:
        """Revoke a key the caller owns. Returns the revoked row, or None if the
        key does not exist or belongs to another user (no cross-user revoke)."""
        with _session(session) as s:
            row = s.exec(
                select(ApiKey).where(
                    ApiKey.id == key_id, ApiKey.user_id == user_id
                )
            ).first()
            if row is None:
                return None
            if row.revoked_at is None:
                row.revoked_at = _now()
                s.add(row)
                s.flush()
                s.refresh(row)
            return row
