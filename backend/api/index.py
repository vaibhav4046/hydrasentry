"""Vercel Python serverless entrypoint for the HydraSentry backend.

Vercel's Python runtime imports the ASGI ``app`` from the file that matches the
request route. ``vercel.json`` rewrites every path to ``/api/index`` so this one
function serves the whole FastAPI app. The backend package lives one directory
up, so we add it to ``sys.path`` before importing ``main``.

Local/dev behavior is unchanged: this file is only used by Vercel. Running
``uvicorn main:app`` locally never touches it. The /tmp path switch (config.py,
storage.py) is keyed off the ``VERCEL`` env var that Vercel sets automatically.
"""
from __future__ import annotations

import sys
from pathlib import Path

# backend/ is the parent of backend/api/ — make `import main` and its siblings
# (config, storage, scenario_engine, ...) resolve when Vercel runs this file.
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from main import app  # noqa: E402  (path must be set before this import)

# Vercel's ASGI detection looks for a module-level `app`.
__all__ = ["app"]
