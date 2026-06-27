"""Reversible, idempotent migration runner for the HydraSentry app DB.

A clean versioned migration module (no Alembic dependency, per the task's
explicit allowance): one ``upgrade`` that creates every table and one
``downgrade`` that drops them in reverse FK order. Both are safe to re-run:

* ``up``    -- create all tables if absent (``checkfirst=True``). Idempotent.
* ``down``  -- drop all tables if present. Reversible inverse of ``up``.
* ``reset`` -- ``down`` then ``up`` then ``seed``: one command back to a clean
  demo state.
* ``seed``  -- idempotently create the default/system tenant (slug ``demo``)
  used until Phase 2 maps real users.

Run against the configured ``DATABASE_URL``:

    python -m db.migrate up
    python -m db.migrate down
    python -m db.migrate reset
    python -m db.migrate seed
    python -m db.migrate status

Every command prints a compact JSON status and exits non-zero on failure, so a
CI step or operator can gate on it. Secrets are never printed.
"""
from __future__ import annotations

import json
import sys
from typing import Any

from sqlalchemy import inspect

from db.engine import get_engine
from db.models import ALL_TABLES, SQLModel
from db.repo import TenantRepo

# The migration version. Bump and add a branch here when the schema changes; the
# downgrade must stay the exact inverse so up/down round-trips cleanly.
MIGRATION_VERSION = "0001_initial"

DEFAULT_TENANT_SLUG = "demo"
DEFAULT_TENANT_NAME = "Demo Tenant"

# Table names in dependency order (parents first). Drop walks this in reverse.
_TABLE_NAMES = [t.__tablename__ for t in ALL_TABLES]


def _existing_tables() -> set[str]:
    insp = inspect(get_engine())
    return set(insp.get_table_names())


def upgrade() -> dict[str, Any]:
    """Create all tables. Idempotent (``checkfirst`` skips existing)."""
    engine = get_engine()
    before = _existing_tables()
    SQLModel.metadata.create_all(engine, checkfirst=True)
    after = _existing_tables()
    created = sorted((after - before) & set(_TABLE_NAMES))
    return {
        "action": "up",
        "version": MIGRATION_VERSION,
        "created": created,
        "tables_present": sorted(after & set(_TABLE_NAMES)),
        "ok": set(_TABLE_NAMES).issubset(after),
    }


def downgrade() -> dict[str, Any]:
    """Drop all tables in reverse FK order. Idempotent (``checkfirst``)."""
    engine = get_engine()
    before = _existing_tables()
    # Drop children before parents. SQLModel.metadata.drop_all already sorts in
    # reverse dependency order, but pass checkfirst so a partial state is fine.
    SQLModel.metadata.drop_all(engine, checkfirst=True)
    after = _existing_tables()
    dropped = sorted((before - after) & set(_TABLE_NAMES))
    return {
        "action": "down",
        "version": MIGRATION_VERSION,
        "dropped": dropped,
        "tables_present": sorted(after & set(_TABLE_NAMES)),
        "ok": not (set(_TABLE_NAMES) & after),
    }


def seed() -> dict[str, Any]:
    """Idempotently create the default 'demo' tenant. Requires tables to exist."""
    present = _existing_tables()
    if "tenants" not in present:
        upgrade()
    tenant = TenantRepo.ensure(DEFAULT_TENANT_SLUG, DEFAULT_TENANT_NAME)
    return {
        "action": "seed",
        "tenant_slug": tenant.slug,
        "tenant_id": tenant.id,
        "ok": True,
    }


def reset() -> dict[str, Any]:
    """One command back to a clean demo state: drop, recreate, seed."""
    down_res = downgrade()
    up_res = upgrade()
    seed_res = seed()
    return {
        "action": "reset",
        "version": MIGRATION_VERSION,
        "down": down_res,
        "up": up_res,
        "seed": seed_res,
        "ok": up_res["ok"] and seed_res["ok"],
    }


def status() -> dict[str, Any]:
    present = _existing_tables() & set(_TABLE_NAMES)
    return {
        "action": "status",
        "version": MIGRATION_VERSION,
        "tables_present": sorted(present),
        "tables_expected": sorted(_TABLE_NAMES),
        "ok": set(_TABLE_NAMES).issubset(present),
    }


_COMMANDS = {
    "up": upgrade,
    "down": downgrade,
    "reset": reset,
    "seed": seed,
    "status": status,
}


def main(argv: list[str] | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv
    cmd = args[0] if args else "status"
    fn = _COMMANDS.get(cmd)
    if fn is None:
        print(json.dumps({"ok": False, "error": f"unknown command '{cmd}'",
                          "commands": sorted(_COMMANDS)}))
        return 2
    try:
        result = fn()
    except Exception as exc:  # noqa: BLE001 -- report honestly, never fabricate
        # Surface the failure kind (e.g. unreachable DB) without leaking the DSN
        # credentials embedded in SQLAlchemy connection errors.
        from db.engine import safe_error_detail

        print(json.dumps({"ok": False, "action": cmd,
                          "error": "migration failed",
                          "kind": type(exc).__name__,
                          "detail": safe_error_detail(exc)}))
        return 1
    print(json.dumps(result))
    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
