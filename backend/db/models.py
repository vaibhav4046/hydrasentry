"""SQLModel tables for the HydraSentry app store.

Every domain row (``Incident``, ``Certificate``, ``RegressionRule``,
``AuditLog``) carries a ``tenant_id`` foreign key to ``Tenant``. The repository
layer enforces that no domain row is ever read or written without a tenant_id
(BOLA defense / default-deny). ``Tenant`` and ``User`` are the tenancy roots.

UUID primary keys are stored as strings so the identical schema works on both
Postgres and sqlite (the offline test driver) without a dialect-specific UUID
type. JSON columns hold the flexible payloads (certificate fields, audit detail).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import Column, Index
from sqlalchemy.types import JSON, TIMESTAMP
from sqlmodel import Field, SQLModel  # re-exported for db.migrate

__all__ = [
    "SQLModel",
    "Tenant",
    "User",
    "Incident",
    "Certificate",
    "RegressionRule",
    "AuditLog",
    "ALL_TABLES",
]


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _ts_column(*, index: bool = False) -> Column:
    """A timezone-aware timestamp column.

    ``TIMESTAMP(timezone=True)`` maps to ``TIMESTAMPTZ`` on Postgres and to a
    UTC-aware TEXT round-trip on sqlite, so created_at reads back as an *aware*
    datetime on both -- avoiding the naive/aware comparison divergence between
    the offline test driver and the real Postgres.
    """
    return Column(TIMESTAMP(timezone=True), index=index, nullable=False)


def _json_column() -> Column:
    """A JSON column with an empty-dict server-side default, cross-dialect."""
    return Column(JSON, nullable=False, default=dict)


class Tenant(SQLModel, table=True):
    """A tenancy boundary. All domain data is scoped to exactly one tenant."""

    __tablename__ = "tenants"

    id: str = Field(default_factory=_uuid, primary_key=True)
    name: str
    slug: str = Field(index=True, unique=True)
    created_at: datetime = Field(default_factory=_now, sa_column=_ts_column())


class User(SQLModel, table=True):
    """An identity. Populated for real in Phase 2 (auth); the table exists now
    so the tenant/user model is in place and migrations are stable."""

    __tablename__ = "users"

    id: str = Field(default_factory=_uuid, primary_key=True)
    tenant_id: Optional[str] = Field(
        default=None, foreign_key="tenants.id", index=True
    )
    email: str = Field(index=True, unique=True)
    created_at: datetime = Field(default_factory=_now, sa_column=_ts_column())


class Incident(SQLModel, table=True):
    """A persisted run result: baseline vs poisoned answers + computed risk."""

    __tablename__ = "incidents"
    # Composite index serves the tenant-scoped newest-first list() without a sort.
    __table_args__ = (
        Index("ix_incidents_tenant_created", "tenant_id", "created_at"),
    )

    id: str = Field(default_factory=_uuid, primary_key=True)
    tenant_id: str = Field(foreign_key="tenants.id", index=True)
    scenario: str
    baseline_answer: str = Field(default="")
    poisoned_answer: str = Field(default="")
    risk_score: int = Field(default=0)
    band: str = Field(default="LOW")
    decision: str = Field(default="allow")
    attack_type: str = Field(default="unknown")
    graph_source: str = Field(default="derived_scenario_graph")
    confidence: float = Field(default=0.0)
    llm_provider: str = Field(default="deterministic")
    mode: str = Field(default="demo")
    created_at: datetime = Field(default_factory=_now, sa_column=_ts_column(index=True))


class Certificate(SQLModel, table=True):
    """A Memory Integrity Certificate bound to a blocked/high-risk incident."""

    __tablename__ = "certificates"
    __table_args__ = (
        Index("ix_certificates_tenant_created", "tenant_id", "created_at"),
    )

    id: str = Field(default_factory=_uuid, primary_key=True)
    tenant_id: str = Field(foreign_key="tenants.id", index=True)
    incident_id: str = Field(foreign_key="incidents.id", index=True)
    mic_id: str
    hmac_sig: Optional[str] = Field(default=None)
    risk_score: int = Field(default=0)
    decision: str = Field(default="block")
    fields: dict[str, Any] = Field(default_factory=dict, sa_column=_json_column())
    created_at: datetime = Field(default_factory=_now, sa_column=_ts_column(index=True))


class RegressionRule(SQLModel, table=True):
    """A detection rule / regression signature registered after a finding."""

    __tablename__ = "regression_rules"
    __table_args__ = (
        Index("ix_regression_rules_tenant_created", "tenant_id", "created_at"),
    )

    id: str = Field(default_factory=_uuid, primary_key=True)
    tenant_id: str = Field(foreign_key="tenants.id", index=True)
    name: str
    signature: str = Field(default="")
    created_at: datetime = Field(default_factory=_now, sa_column=_ts_column(index=True))


class AuditLog(SQLModel, table=True):
    """An append-only audit record. One row per tenant-scoped action."""

    __tablename__ = "audit_logs"
    __table_args__ = (
        Index("ix_audit_logs_tenant_created", "tenant_id", "created_at"),
    )

    id: str = Field(default_factory=_uuid, primary_key=True)
    tenant_id: str = Field(foreign_key="tenants.id", index=True)
    actor: str = Field(default="system")
    action: str
    detail: dict[str, Any] = Field(default_factory=dict, sa_column=_json_column())
    created_at: datetime = Field(default_factory=_now, sa_column=_ts_column(index=True))


# Ordered for create (parents first) and reverse for drop (children first), so
# the migration honours foreign-key dependencies on both directions.
ALL_TABLES = [
    Tenant,
    User,
    Incident,
    Certificate,
    RegressionRule,
    AuditLog,
]
