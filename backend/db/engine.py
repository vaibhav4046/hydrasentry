"""SQLAlchemy engine + session factory for the HydraSentry app DB.

The engine is built from ``DATABASE_URL`` (read via ``config.settings``). It is
driver-agnostic: the same code path drives Postgres in production and sqlite for
offline tests, so the schema, repo, and BOLA logic are exercised against a real
database engine without a live network in CI.

Postgres specifics (Supabase session pooler):
* The Supabase connection string is Prisma-shaped and may carry a ``?schema=``
  query parameter that ``psycopg2`` rejects as an invalid DSN option. We strip
  any non-libpq query keys and translate ``schema`` into a ``search_path``
  via ``connect_args['options']`` instead.
* ``sslmode=require`` is forced when absent (Supabase requires TLS).
* The session pooler (port 5432) supports prepared statements, so SQLAlchemy's
  default statement caching is left on.

Nothing here opens a connection at import time. The engine is created lazily on
first use so importing the app never blocks on (or fails because of) an
unreachable database -- callers that need the DB get an honest error at call
time, which is what the fail-closed persistence path relies on.
"""
from __future__ import annotations

import logging
import re
import threading
from typing import Any, Optional
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from sqlalchemy.engine import Engine
from sqlmodel import Session, create_engine

from config import settings

logger = logging.getLogger("hydrasentry.db.engine")

# A valid unquoted Postgres identifier (schema name). Rejects anything that
# could smuggle extra libpq ``options`` directives via the search_path.
_SCHEMA_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_$]*$")

# libpq connection options psycopg2 understands as DSN query params. Anything
# else in the URL query (notably Prisma's ``schema``) is stripped from the DSN.
_LIBPQ_QUERY_KEYS = {
    "sslmode",
    "connect_timeout",
    "application_name",
    "options",
    "target_session_attrs",
    "gssencmode",
    "channel_binding",
    "keepalives",
    "keepalives_idle",
}

_engine_lock = threading.Lock()
_engine: Optional[Engine] = None


def _is_postgres(url: str) -> bool:
    return url.startswith("postgres://") or url.startswith("postgresql")


def _is_sqlite(url: str) -> bool:
    return url.startswith("sqlite")


def sanitize_postgres_url(url: str) -> tuple[str, dict[str, Any]]:
    """Return a psycopg2-safe DSN plus connect_args for a Postgres URL.

    Drops non-libpq query params (e.g. Prisma ``schema``), forces ``sslmode``
    to ``require`` when absent, and maps a ``schema`` param to a ``search_path``
    via the libpq ``options`` connect arg. Never logs or returns secrets.
    """
    parts = urlsplit(url)
    raw_q = dict(parse_qsl(parts.query))
    kept = [(k, v) for k, v in raw_q.items() if k in _LIBPQ_QUERY_KEYS]
    if not any(k == "sslmode" for k, _ in kept):
        kept.append(("sslmode", "require"))

    clean = urlunsplit(
        (parts.scheme, parts.netloc, parts.path, urlencode(kept), "")
    )

    connect_args: dict[str, Any] = {}
    schema = raw_q.get("schema")
    if schema:
        # Validate the schema name before interpolating it into the libpq
        # ``options`` string, so a crafted ``?schema=public -c ...`` cannot
        # smuggle extra connection directives.
        if not _SCHEMA_RE.match(schema):
            raise ValueError("invalid schema name in DATABASE_URL")
        # Set search_path so unqualified table names resolve to the schema the
        # Prisma URL pointed at, without passing an invalid DSN option.
        connect_args["options"] = f"-csearch_path={schema}"
    return clean, connect_args


def _build_engine(url: str) -> Engine:
    if _is_sqlite(url):
        # check_same_thread=False so the ThreadPoolExecutor-driven real run can
        # share the connection in tests; sqlite is the offline/test driver only.
        connect_args = {"check_same_thread": False} if ":memory:" in url else {}
        return create_engine(url, connect_args=connect_args)

    if _is_postgres(url):
        dsn, connect_args = sanitize_postgres_url(url)
        # The Supabase TRANSACTION pooler (port 6543) does not support
        # server-side prepared statements; SQLAlchemy's statement cache would
        # then error under load. We target the SESSION pooler (5432) which does.
        # Warn (don't fail) if pointed at 6543 so a misconfig is visible.
        port = urlsplit(dsn).port
        if port == 6543:
            logger.warning(
                "DATABASE_URL uses the transaction pooler (port 6543); the "
                "session pooler (5432) is recommended for prepared statements"
            )
        # pool_pre_ping is the primary defense: Supabase drops idle pooled
        # connections (~60s), so a checked-out stale connection is detected and
        # transparently recycled before use. pool_recycle=1800 is a backstop.
        return create_engine(
            dsn,
            connect_args=connect_args,
            pool_pre_ping=True,
            pool_size=5,
            max_overflow=5,
            pool_recycle=1800,
        )

    # Unknown scheme: hand it straight to SQLAlchemy and let it error honestly.
    return create_engine(url)


def get_engine(*, refresh: bool = False) -> Engine:
    """Return the process-wide engine, building it on first use.

    ``refresh=True`` disposes and rebuilds (used by tests that point the app at a
    throwaway sqlite/Postgres URL).
    """
    global _engine
    with _engine_lock:
        if refresh and _engine is not None:
            _engine.dispose()
            _engine = None
        if _engine is None:
            _engine = _build_engine(settings.database_url)
        return _engine


def get_session() -> Session:
    """Open a new SQLModel session bound to the app engine.

    ``expire_on_commit=False`` so a returned model instance stays usable after
    the repo commits and closes its short-lived session (callers read fields off
    the returned row without a re-fetch). Caller owns the lifecycle (use as a
    context manager). Raises at call time if the database is unreachable -- the
    persistence layer treats that as a fail-closed condition rather than
    fabricating success.
    """
    return Session(get_engine(), expire_on_commit=False)


def reset_engine() -> None:
    """Dispose and forget the cached engine (test isolation helper)."""
    global _engine
    with _engine_lock:
        if _engine is not None:
            _engine.dispose()
            _engine = None


# Matches the ``user:password@`` credential portion of any DSN that SQLAlchemy
# may embed in an exception message, so we never surface a password.
_DSN_CRED_RE = re.compile(r"(postgres\w*://)[^@/\s]*@")


def safe_error_detail(exc: Exception, limit: int = 200) -> str:
    """First line of an exception, with any embedded DSN credentials redacted.

    SQLAlchemy/psycopg2 connection errors often inline the full DSN (including
    the password). This strips ``user:password@`` before the detail is returned
    in an API body or printed, so a credential can never leak through an error.
    """
    raw = str(exc).splitlines()[0] if str(exc) else ""
    redacted = _DSN_CRED_RE.sub(r"\1***@", raw)
    return redacted[:limit]
