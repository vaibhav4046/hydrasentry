"""Phase 2 authentication: Supabase-JWT (via JWKS) + per-user API keys.

Auth is ADDITIVE and OPTIONAL per request. The public showcase endpoints keep
working unauthenticated against the shared ``demo`` tenant; an authenticated
caller (Supabase user JWT or an API key) resolves to their OWN private tenant.

Default-deny is scoped: the ABSENCE of any credential falls back to the demo
tenant (public demo preserved), but a PRESENT-but-INVALID credential (forged or
expired JWT, unknown or revoked API key) is a 401 -- never a silent demo
fallback. See ``identity.current_identity``.
"""
from __future__ import annotations

__all__ = ["api_keys", "jwt_verifier", "identity", "service"]
