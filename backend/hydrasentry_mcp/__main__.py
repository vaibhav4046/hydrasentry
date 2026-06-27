"""``python -m hydrasentry_mcp`` entry point: serve MCP over stdio."""
from __future__ import annotations

from .server import main

if __name__ == "__main__":
    raise SystemExit(main())
