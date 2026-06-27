"""HydraSentry application database layer (Postgres via SQLModel).

This package is the APP store: tenants, users, incidents, certificates,
regression rules, and audit logs. HydraDB remains the graph memory store; the
two are cleanly separated.

Public surface:
* ``engine`` / ``get_session`` -- SQLAlchemy engine + session factory built from
  ``DATABASE_URL`` (Postgres in production, sqlite for offline tests).
* ``models`` -- SQLModel tables, every domain row tenant-scoped.
* ``repo`` -- ``TenantScopedRepo`` with default-deny tenant filtering (BOLA
  defense): every read/write REQUIRES a tenant_id.
* ``migrate`` -- reversible, idempotent ``up``/``down``/``reset``/``seed`` runner.
"""
from __future__ import annotations

__all__ = ["engine", "models", "repo", "migrate"]
