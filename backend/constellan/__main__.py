"""``python -m constellan`` entrypoint.

Delegates to the CLI in ``cli.py`` so there is a single implementation. Adds the
backend dir to ``sys.path`` first so engine modules import cleanly regardless of
the current working directory.
"""
from __future__ import annotations

import sys
from pathlib import Path

_BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

from cli import main  # noqa: E402

if __name__ == "__main__":
    raise SystemExit(main())
