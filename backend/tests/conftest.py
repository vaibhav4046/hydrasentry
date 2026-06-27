"""Pytest config: ensure the backend package is importable and DB is ready.

The app DB (Postgres in prod) is pointed at a throwaway local sqlite file for
the whole test session BEFORE any module imports ``config``/``db.engine``, so the
schema/repo/BOLA logic is exercised against a real database engine offline. The
real Postgres is never required for CI; a separate, explicitly opt-in marker
runs the same proof live against ``DATABASE_URL`` when it is reachable.
"""
import os
import sys
import tempfile
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Point the app DB at a throwaway sqlite file for the test session so the suite
# stays offline + green and NEVER touches the real Supabase Postgres. The legacy
# storage.py keeps its own sqlite path (DATABASE_URL only drives the app DB
# engine in db.engine, which reads it fresh on first use).
_APP_DB_FILE = Path(tempfile.gettempdir()) / "hydrasentry_app_test.db"
if _APP_DB_FILE.exists():
    _APP_DB_FILE.unlink()
_TEST_DB_URL = f"sqlite:///{_APP_DB_FILE.as_posix()}"
os.environ["DATABASE_URL"] = _TEST_DB_URL
# A signing secret so issued certificates in tests are signed (real HMAC).
os.environ.setdefault("HYDRASENTRY_CERT_SECRET", "hydrasentry-test-cert-secret")

import config  # noqa: E402

# config's module-level load_dotenv(override=True) repopulates os.environ from
# backend/.env on import -- which would put the REAL Postgres DATABASE_URL back
# and make the suite run against live Supabase. Re-assert the sqlite test URL
# AFTER that import so the test DB is authoritative regardless of .env, then
# rebuild settings from the patched environment.
os.environ["DATABASE_URL"] = _TEST_DB_URL
config.settings = config.load_settings()
assert config.settings.database_url == _TEST_DB_URL, (
    "test suite must use the throwaway sqlite app DB, not the real Postgres"
)

import storage  # noqa: E402


def pytest_configure(config):  # noqa: D401
    storage.init_db()
    storage.seed_scheduled_agents()
    # Bring the app DB schema up + seed the demo tenant on the test sqlite.
    import db.engine as engine
    import db.migrate as migrate

    engine.reset_engine()
    migrate.reset()


@pytest.fixture()
def clean_app_db():
    """Reset the app DB to a clean seeded demo state for a test that needs
    isolation from rows other tests created."""
    import db.engine as engine
    import db.migrate as migrate

    engine.reset_engine()
    migrate.reset()
    yield


@pytest.fixture(autouse=True)
def _disable_semantic_detection_by_default(monkeypatch):
    """Force the lexical-only path for the legacy suite so existing band
    assertions stay deterministic and no test makes a live embeddings call.

    The dedicated semantic tests (test_semantic_detector.py) re-enable it
    explicitly (and either mock embeddings or mark themselves live), so this
    default never hides the moat -- it just keeps the 97 pre-existing tests
    offline and stable."""
    monkeypatch.setenv("HYDRASENTRY_SEMANTIC_DETECTION", "0")
