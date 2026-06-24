"""Pytest config: ensure the backend package is importable and DB is ready."""
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import storage  # noqa: E402


def pytest_configure(config):  # noqa: D401
    storage.init_db()
    storage.seed_scheduled_agents()
