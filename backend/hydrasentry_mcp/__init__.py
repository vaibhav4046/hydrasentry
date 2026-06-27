"""HydraSentry native stdio MCP server package.

Exposes HydraSentry's REAL context-integrity tools (SKILL.md safety scan, local
memory poison/integrity scan, live HydraDB graph query, the Groq agent attack
run, and Memory Integrity Certificates) as native Model Context Protocol tools
over stdio, so any MCP client can install and run them against its own agent.

Every tool calls the existing real backend modules. Tools that need a key or a
live service fail closed with an honest message; they never fabricate output.

Entry points:
  * console script ``hydrasentry-mcp`` (see pyproject) -> ``server:main``
  * ``python -m hydrasentry_mcp`` -> ``__main__`` -> ``server:main``
"""
from __future__ import annotations

__all__ = ["__version__"]

__version__ = "1.0.0"
