"""Live fetch of SKILL.md files from the skillmake.xyz marketplace.

skillmake.xyz is a HydraDB-powered marketplace of agent SKILL.md files. It
exposes no API or SDK; the only public surface is an unauthenticated
``GET https://skillmake.xyz/i/<slug>`` that returns the raw SKILL.md text.

This module performs the server-side fetch (the browser cannot, owing to CORS)
and is deliberately OPT-IN and additive: nothing here is on the canonical
``/runs/judge-demo`` path. It is built to FAIL CLOSED — every network, timeout,
size, or HTTP error returns a structured error dict (never an exception that
would surface as a 500), and a pre-cached real fixture is used as an offline
fallback so conference wifi cannot sink a live demo.

Pure public GET. No accounts, no keys, nothing is submitted.
"""
from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import Any

import httpx

logger = logging.getLogger("hydrasentry.skillmake_marketplace")

# Public marketplace surface.
MARKETPLACE_BASE = "https://skillmake.xyz/i"

# Slugs are simple kebab-case identifiers. Validate to avoid SSRF/path tricks:
# only lowercase letters, digits and hyphens, bounded length.
_SLUG_RE = re.compile(r"^[a-z0-9-]+$")
_MAX_SLUG_LEN = 80

# Hard limits so a hostile or huge response can never hang or OOM the function.
_TIMEOUT_S = 6.0
_MAX_BYTES = 256 * 1024  # 256 KB

# Pre-cached real SKILL.md fixtures shipped with the backend. Used as an offline
# fallback when the live fetch fails, so the demo always has real content.
_CACHE_DIR = Path(__file__).resolve().parent / "skillmake_cache"

# Real, validated slugs surfaced to the UI as one-click examples.
EXAMPLE_SLUGS: list[str] = ["firecrawl-mcp", "playwright-skill"]


def is_valid_slug(slug: str) -> bool:
    """True for a safe marketplace slug (^[a-z0-9-]+$, bounded length)."""
    return bool(slug) and len(slug) <= _MAX_SLUG_LEN and _SLUG_RE.match(slug) is not None


def _cached_skill(slug: str) -> str | None:
    """Return the pre-cached SKILL.md text for a slug, if one ships with us."""
    if not is_valid_slug(slug):
        return None
    path = _CACHE_DIR / f"{slug}.md"
    try:
        if path.is_file():
            return path.read_text(encoding="utf-8")
    except OSError as exc:  # pragma: no cover - filesystem edge
        logger.warning("skillmake cache read failed for %s: %s", slug, exc)
    return None


def fetch_skill(slug: str) -> dict[str, Any]:
    """Fetch a SKILL.md from skillmake.xyz, with an offline cache fallback.

    Returns a structured dict (never raises):
      { ok: True,  slug, source: "live"|"cache", url, content }
      { ok: False, slug, source: "none"|"cache", url, error, content? }

    On a live failure we serve the pre-cached fixture when present (source
    "cache", ok True) so the demo keeps working offline; only when there is also
    no cache do we return ok False with a clean error and no content.
    """
    slug = (slug or "").strip()
    url = f"{MARKETPLACE_BASE}/{slug}"

    if not is_valid_slug(slug):
        return {
            "ok": False,
            "slug": slug,
            "source": "none",
            "url": url,
            "error": "invalid slug (expected ^[a-z0-9-]+$)",
        }

    # 1) Try the live marketplace.
    try:
        with httpx.Client(timeout=_TIMEOUT_S, follow_redirects=True) as client:
            resp = client.get(url, headers={"Accept": "text/markdown, text/plain, */*"})
        if resp.status_code != 200:
            raise httpx.HTTPStatusError(
                f"HTTP {resp.status_code}", request=resp.request, response=resp
            )
        raw = resp.content[:_MAX_BYTES]
        text = raw.decode("utf-8", errors="replace")
        if not text.strip():
            raise ValueError("empty response body")
        logger.info("skillmake live fetch ok: %s (%d bytes)", slug, len(raw))
        return {"ok": True, "slug": slug, "source": "live", "url": url, "content": text}
    except (httpx.HTTPError, ValueError, OSError) as exc:
        logger.warning("skillmake live fetch failed for %s: %s", slug, exc)

    # 2) Fall back to a shipped fixture so the demo survives offline.
    cached = _cached_skill(slug)
    if cached is not None:
        logger.info("skillmake serving cached fixture: %s", slug)
        return {
            "ok": True,
            "slug": slug,
            "source": "cache",
            "url": url,
            "content": cached,
        }

    # 3) Nothing live and nothing cached — clean, fail-closed error.
    return {
        "ok": False,
        "slug": slug,
        "source": "none",
        "url": url,
        "error": "skillmake.xyz unreachable and no offline copy cached for this slug",
    }
