"""In-process token-bucket rate limiter (no external dependency).

Finding #1 (MEDIUM): the cost / outbound paths had no app-level rate limit, so a
burst could drive real Groq spend (``POST /runs/real``) or repeated outbound
fetches (``POST /skillmake/scan-url``). This adds a tiny, dependency-free token
bucket keyed on the caller identity (authenticated user/tenant) or, failing
that, the client IP.

Design notes
------------
* TIGHT caps on the genuinely costly/outbound paths, a LOOSER cap on the
  demo-write / key-creation paths, and the deterministic read paths are left
  alone (a read should never 429 into uselessness).
* The canonical one-click ``/runs/judge-demo`` keeps a GENEROUS cap so a judge
  can click it repeatedly without tripping the limiter.
* Over-limit returns HTTP 429 with a clear JSON envelope and a ``Retry-After``
  header (seconds).
* Single-process, in-memory. On Vercel each warm instance keeps its own buckets;
  that is acceptable for abuse-dampening (the goal is to blunt a burst, not to
  be a distributed quota). It is fail-OPEN on internal error: a limiter bug must
  never take down the service, and the downstream handlers are themselves
  bounded and fail-closed.

The buckets are bounded (LRU-evicted past ``_MAX_BUCKETS``) so a flood of unique
keys cannot grow memory without limit.
"""
from __future__ import annotations

import threading
import time
from collections import OrderedDict
from dataclasses import dataclass
from typing import Optional

# Cap on distinct keys tracked at once. Past this the oldest bucket is evicted;
# an evicted attacker simply gets a fresh full bucket, which is fine -- the cap
# exists to bound memory, not to be a precise global quota.
_MAX_BUCKETS = 10_000


@dataclass(frozen=True)
class Limit:
    """A token-bucket limit: ``capacity`` tokens, refilled at ``refill_per_sec``.

    ``capacity`` is the burst allowance; ``refill_per_sec`` is the sustained
    rate. ``retry_after`` is what we advertise on a 429 (seconds until at least
    one token is available again, rounded up to a friendly minimum).
    """

    name: str
    capacity: float
    refill_per_sec: float

    def retry_after_seconds(self) -> int:
        # Time to accrue one token, min 1s so the header is never "0".
        if self.refill_per_sec <= 0:
            return 1
        return max(1, int(1.0 / self.refill_per_sec + 0.999))


# --- Named limits (tunable in one place) ------------------------------------
# Costly / outbound -> TIGHT. Demo-write / key-creation -> LOOSER. judge-demo ->
# GENEROUS so the canonical one-click stays usable for a judge.
LIMITS: dict[str, Limit] = {
    # Real Groq spend: a handful of bursts, ~1 sustained per 6s.
    "runs_real": Limit("runs_real", capacity=5, refill_per_sec=1.0 / 6.0),
    # Outbound fetch to the skill marketplace.
    "scan_url": Limit("scan_url", capacity=5, refill_per_sec=1.0 / 6.0),
    # Demo row write -- generous so a judge can click repeatedly (~1 / 2s).
    "judge_demo": Limit("judge_demo", capacity=12, refill_per_sec=0.5),
    # Local scan (CPU, no spend): loose.
    "scan_local": Limit("scan_local", capacity=20, refill_per_sec=2.0),
    # API key creation (write, per-user): loose-ish.
    "api_key_create": Limit("api_key_create", capacity=10, refill_per_sec=1.0 / 3.0),
}


@dataclass
class _Bucket:
    tokens: float
    updated_at: float


class _TokenBuckets:
    """Thread-safe, LRU-bounded token-bucket store."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._buckets: "OrderedDict[str, _Bucket]" = OrderedDict()

    def allow(self, key: str, limit: Limit, *, now: Optional[float] = None) -> bool:
        """Consume one token for ``key`` under ``limit``. True if allowed."""
        ts = time.monotonic() if now is None else now
        with self._lock:
            bucket = self._buckets.get(key)
            if bucket is None:
                bucket = _Bucket(tokens=limit.capacity, updated_at=ts)
                self._buckets[key] = bucket
            else:
                # Refill since last touch, capped at capacity.
                elapsed = max(0.0, ts - bucket.updated_at)
                bucket.tokens = min(
                    limit.capacity, bucket.tokens + elapsed * limit.refill_per_sec
                )
                bucket.updated_at = ts
                self._buckets.move_to_end(key)

            if bucket.tokens >= 1.0:
                bucket.tokens -= 1.0
                allowed = True
            else:
                allowed = False

            # Bound memory: evict the least-recently-used bucket past the cap.
            while len(self._buckets) > _MAX_BUCKETS:
                self._buckets.popitem(last=False)
            return allowed

    def reset(self) -> None:
        """Clear all buckets (test isolation)."""
        with self._lock:
            self._buckets.clear()


_BUCKETS = _TokenBuckets()


def reset() -> None:
    """Reset all rate-limit state (used between tests)."""
    _BUCKETS.reset()


def _client_ip(request: object) -> str:
    """Best-effort client IP for an unauthenticated caller.

    Prefers the PLATFORM-set ``x-real-ip`` (Vercel/most proxies set this to the
    true client and a client cannot forge it), then the socket peer, and only
    THEN the client-controllable ``x-forwarded-for`` as a last resort. Ordering
    ``x-forwarded-for`` last matters: an anonymous attacker can put any value in
    XFF to mint a fresh bucket per request and bypass the per-IP cap, so it is
    used only when nothing more trustworthy is available. Never raises; an
    unknown peer collapses to a constant so unkeyed callers still share a bucket.
    """
    try:
        headers = getattr(request, "headers", {}) or {}
        get = headers.get if hasattr(headers, "get") else None
        # 1) Proxy-set real client IP (not client-spoofable on Vercel).
        if get is not None:
            real_ip = get("x-real-ip")
            if real_ip and real_ip.strip():
                return real_ip.strip()
        # 2) Socket peer (direct connections / local).
        client = getattr(request, "client", None)
        host = getattr(client, "host", None)
        if host:
            return str(host)
        # 3) Last resort: first XFF hop (client-controllable; least trusted).
        if get is not None:
            xff = get("x-forwarded-for")
            if xff:
                first = xff.split(",")[0].strip()
                if first:
                    return first
    except Exception:  # noqa: BLE001 -- IP derivation must never raise
        pass
    return "anon"


def check(limit_name: str, identity_key: Optional[str], request: object) -> dict:
    """Check + consume one token for ``limit_name``.

    ``identity_key`` is a stable per-caller key (e.g. ``tenant:<id>`` or
    ``user:<id>``); when None (unauthenticated) the client IP is used. Returns
    ``{"allowed": bool, "retry_after": int, "limit": str}``. Fail-OPEN: any
    internal error allows the request (the downstream handler is itself bounded
    and fail-closed), so a limiter bug cannot take the service down.
    """
    try:
        limit = LIMITS.get(limit_name)
        if limit is None:
            return {"allowed": True, "retry_after": 0, "limit": limit_name}
        who = identity_key or f"ip:{_client_ip(request)}"
        key = f"{limit_name}:{who}"
        allowed = _BUCKETS.allow(key, limit)
        return {
            "allowed": allowed,
            "retry_after": 0 if allowed else limit.retry_after_seconds(),
            "limit": limit_name,
        }
    except Exception:  # noqa: BLE001 -- fail open, never break the request path
        return {"allowed": True, "retry_after": 0, "limit": limit_name}


def identity_key(identity: object) -> Optional[str]:
    """Derive a stable rate-limit key from a resolved Identity.

    Prefers the user id (one human, possibly many keys), then the tenant id, so
    an authenticated caller is limited as themselves rather than per source IP.
    Returns None for the unauthenticated demo caller so ``check`` falls back to
    the client IP (the public demo is shared but still IP-bucketed).
    """
    user_id = getattr(identity, "user_id", None)
    if user_id:
        return f"user:{user_id}"
    auth_method = getattr(identity, "auth_method", None)
    tenant_id = getattr(identity, "tenant_id", None)
    if auth_method and auth_method != "demo" and tenant_id:
        return f"tenant:{tenant_id}"
    return None
