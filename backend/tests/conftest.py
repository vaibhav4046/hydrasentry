"""Pytest config: ensure the backend package is importable and DB is ready."""
import os
import sys
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import storage  # noqa: E402


def pytest_configure(config):  # noqa: D401
    storage.init_db()
    storage.seed_scheduled_agents()


@pytest.fixture(autouse=True)
def _disable_semantic_detection_by_default(monkeypatch):
    """Force the lexical-only path for the legacy suite so existing band
    assertions stay deterministic and no test makes a live embeddings call.

    The dedicated semantic tests (test_semantic_detector.py) re-enable it
    explicitly (and either mock embeddings or mark themselves live), so this
    default never hides the moat -- it just keeps the 97 pre-existing tests
    offline and stable."""
    monkeypatch.setenv("HYDRASENTRY_SEMANTIC_DETECTION", "0")
