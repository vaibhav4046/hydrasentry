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

from sqlalchemy import inspect, text

from db.engine import get_engine
from db.models import ALL_TABLES, SQLModel
from db.repo import TenantRepo

# The migration version. Bump and add a branch here when the schema changes; the
# downgrade must stay the exact inverse so up/down round-trips cleanly.
#
# 0002_api_keys_and_user_sub adds the per-user API key table and the
# ``users.supabase_sub`` column (Phase 2 auth). ``create_all`` creates the new
# ``api_keys`` table on both fresh and existing databases, but it never ALTERs an
# existing table -- so the new column on the already-live ``users`` table is
# added explicitly and reversibly below.
#
# 0003_rule_store adds the Phase 5 per-tenant rule-store columns to the existing
# ``regression_rules`` table (signature_text, attack_type, severity, enabled,
# embedded). On a fresh DB ``create_all`` makes them; on an already-live table
# they are added explicitly + reversibly, same pattern as 0002.
MIGRATION_VERSION = "0003_rule_store"

# Phase 5 columns added to the live regression_rules table, with the DDL type and
# the default backfill for existing rows. Ordered so the downgrade drops them in
# reverse. The boolean columns use BOOLEAN so the type matches what SQLModel's
# ``bool`` field creates via ``create_all`` on a fresh DB: Postgres has a native
# boolean (an INTEGER column would reject the boolean literal psycopg2 sends),
# and sqlite stores BOOLEAN as numeric, so TRUE/FALSE defaults are valid on both.
_RULE_STORE_COLUMNS: list[tuple[str, str, str]] = [
    ("signature_text", "VARCHAR", "''"),
    ("attack_type", "VARCHAR", "'memory_poisoning'"),
    ("severity", "VARCHAR", "'MEDIUM'"),
    ("enabled", "BOOLEAN", "TRUE"),
    ("embedded", "BOOLEAN", "FALSE"),
]

DEFAULT_TENANT_SLUG = "demo"
DEFAULT_TENANT_NAME = "Demo Tenant"

# Table names in dependency order (parents first). Drop walks this in reverse.
_TABLE_NAMES = [t.__tablename__ for t in ALL_TABLES]


def _users_columns() -> set[str]:
    insp = inspect(get_engine())
    if "users" not in set(insp.get_table_names()):
        return set()
    return {c["name"] for c in insp.get_columns("users")}


def _add_user_sub_column() -> bool:
    """Add ``users.supabase_sub`` (nullable, unique) to an existing users table.

    Returns True if the column was added, False if it was already present. Safe
    to re-run (checks the live schema first). On a fresh DB the column is created
    by ``create_all`` and this is a no-op.
    """
    if "supabase_sub" in _users_columns():
        return False
    engine = get_engine()
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE users ADD COLUMN supabase_sub VARCHAR"))
        # A partial-safe unique index (NULLs are allowed to repeat on both
        # Postgres and sqlite). Named so the downgrade can drop it precisely.
        conn.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_supabase_sub "
                "ON users (supabase_sub)"
            )
        )
    return True


def _drop_user_sub_column() -> bool:
    """Reverse of :func:`_add_user_sub_column`. Drops the index then the column.

    Postgres supports ``DROP COLUMN``; older sqlite may not, but the test
    round-trip uses ``drop_all`` (whole-table) so this is exercised on Postgres.
    """
    cols = _users_columns()
    if "supabase_sub" not in cols:
        return False
    engine = get_engine()
    with engine.begin() as conn:
        conn.execute(text("DROP INDEX IF EXISTS ix_users_supabase_sub"))
        try:
            conn.execute(text("ALTER TABLE users DROP COLUMN supabase_sub"))
        except Exception:  # noqa: BLE001 -- sqlite < 3.35 cannot drop columns
            return False
    return True


def _rule_columns() -> set[str]:
    insp = inspect(get_engine())
    if "regression_rules" not in set(insp.get_table_names()):
        return set()
    return {c["name"] for c in insp.get_columns("regression_rules")}


def _rule_column_types() -> dict[str, str]:
    insp = inspect(get_engine())
    if "regression_rules" not in set(insp.get_table_names()):
        return {}
    return {c["name"]: str(c["type"]).upper() for c in insp.get_columns("regression_rules")}


def _fix_bool_column_types() -> list[str]:
    """Self-heal the enabled/embedded columns to BOOLEAN on Postgres.

    An earlier build added these as INTEGER, which Postgres rejects when SQLModel
    sends a boolean literal. This converts an INTEGER column to BOOLEAN in place
    (idempotent: a no-op once the type is already boolean, and skipped entirely
    on sqlite, which is typeless for these). Reversible -- the downgrade drops
    the columns wholesale, so no inverse cast is needed.
    """
    engine = get_engine()
    if engine.dialect.name != "postgresql":
        return []
    types = _rule_column_types()
    # The INTEGER default (1 / 0) cannot auto-cast to boolean during the TYPE
    # change, so drop the default first, cast the type, then restore a boolean
    # default. Done per column inside one transaction so a failure rolls back.
    bool_defaults = {"enabled": "TRUE", "embedded": "FALSE"}
    fixed: list[str] = []
    with engine.begin() as conn:
        for name in ("enabled", "embedded"):
            current = types.get(name, "")
            if current and "BOOL" not in current:
                conn.execute(text(
                    f"ALTER TABLE regression_rules ALTER COLUMN {name} DROP DEFAULT"
                ))
                conn.execute(text(
                    f"ALTER TABLE regression_rules ALTER COLUMN {name} "
                    f"TYPE BOOLEAN USING ({name} <> 0)"
                ))
                conn.execute(text(
                    f"ALTER TABLE regression_rules ALTER COLUMN {name} "
                    f"SET DEFAULT {bool_defaults[name]}"
                ))
                fixed.append(name)
    return fixed


def _add_rule_store_columns() -> list[str]:
    """Add the Phase 5 rule-store columns to an existing regression_rules table.

    Returns the list of columns actually added (empty if all present). Each
    column is added with a default that backfills existing rows, so a live row
    created before Phase 5 reads back as an enabled rule with empty
    signature_text. Idempotent: re-checks the live schema first; on a fresh DB
    ``create_all`` already made them and this is a no-op.
    """
    present = _rule_columns()
    if not present:  # table absent on a brand-new DB; create_all handles it
        return []
    added: list[str] = []
    engine = get_engine()
    with engine.begin() as conn:
        for name, ddl_type, default in _RULE_STORE_COLUMNS:
            if name in present:
                continue
            conn.execute(text(
                f"ALTER TABLE regression_rules ADD COLUMN {name} {ddl_type} "
                f"DEFAULT {default}"
            ))
            added.append(name)
    return added


def _drop_rule_store_columns() -> list[str]:
    """Reverse of :func:`_add_rule_store_columns`. Drops the Phase 5 columns in
    reverse order. Postgres supports DROP COLUMN; on sqlite < 3.35 the test
    round-trip uses whole-table drop_all so this is exercised on Postgres."""
    present = _rule_columns()
    dropped: list[str] = []
    engine = get_engine()
    with engine.begin() as conn:
        for name, _ddl, _default in reversed(_RULE_STORE_COLUMNS):
            if name not in present:
                continue
            try:
                conn.execute(text(f"ALTER TABLE regression_rules DROP COLUMN {name}"))
                dropped.append(name)
            except Exception:  # noqa: BLE001 -- sqlite < 3.35 cannot drop columns
                pass
    return dropped


def _existing_tables() -> set[str]:
    insp = inspect(get_engine())
    return set(insp.get_table_names())


def upgrade() -> dict[str, Any]:
    """Create all tables + apply additive column migrations. Idempotent.

    ``create_all(checkfirst=True)`` creates any missing table (incl. the new
    ``api_keys`` table) but never ALTERs an existing one, so the new
    ``users.supabase_sub`` column on the already-live ``users`` table is added
    explicitly and reversibly. Both steps re-check the live schema first, so the
    whole thing is safe to re-run on a fresh or already-migrated DB.
    """
    engine = get_engine()
    before = _existing_tables()
    SQLModel.metadata.create_all(engine, checkfirst=True)
    sub_added = _add_user_sub_column()
    rule_cols_added = _add_rule_store_columns()
    rule_cols_fixed = _fix_bool_column_types()
    after = _existing_tables()
    created = sorted((after - before) & set(_TABLE_NAMES))
    return {
        "action": "up",
        "version": MIGRATION_VERSION,
        "created": created,
        "user_sub_column_added": sub_added,
        "rule_store_columns_added": rule_cols_added,
        "rule_bool_columns_fixed": rule_cols_fixed,
        "tables_present": sorted(after & set(_TABLE_NAMES)),
        "ok": set(_TABLE_NAMES).issubset(after),
    }


def downgrade() -> dict[str, Any]:
    """Drop all tables in reverse FK order. Idempotent (``checkfirst``)."""
    engine = get_engine()
    before = _existing_tables()
    # Drop the added columns first (they live on tables about to be dropped, but
    # dropping them explicitly keeps the migration a clean inverse if a future
    # downgrade is column-only rather than whole-table).
    _drop_rule_store_columns()
    _drop_user_sub_column()
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
