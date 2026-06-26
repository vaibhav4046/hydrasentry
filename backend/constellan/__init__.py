"""Constellan zero-setup CLI package.

Thin namespace so ``python -m constellan scan <memories.json>`` works from the
``backend/`` directory. The actual implementation lives in ``cli.py`` (and the
shared pipeline in ``adapters/local_scan.py``); this package only delegates to
keep one source of truth.
"""
from __future__ import annotations
