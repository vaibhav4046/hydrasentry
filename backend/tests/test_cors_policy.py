"""CORS policy hardening tests (red-team finding #11).

The historic config was ``allow_origins=settings.cors_origins or ["*"]`` with
``allow_credentials=True``. With ``CORS_ORIGINS`` unset that asks the framework
for a *credentialed wildcard* -- a combination the CORS spec forbids and which
browsers only refuse because the framework quietly downgrades it. These tests
pin the explicit policy in ``config.resolve_cors`` so the contradiction can
never be configured, and assert the running app wires that exact policy into
its CORS middleware (so a deploy with no ``CORS_ORIGINS`` is safe by
construction, not by luck).

All offline. The pure-function tests need no network, no DB, and no key.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from starlette.middleware.cors import CORSMiddleware

from config import CorsPolicy, resolve_cors


# --- The security invariant: never a credentialed wildcard ------------------

def test_explicit_allowlist_uses_credentials():
    policy = resolve_cors(
        ["https://app.example.com", "https://admin.example.com"],
        "http://localhost:3000",
    )
    assert policy.allow_origins == (
        "https://app.example.com",
        "https://admin.example.com",
    )
    assert policy.allow_credentials is True
    assert policy.is_wildcard is False


def test_no_allowlist_falls_back_to_frontend_url_not_wildcard():
    # The real deployment shape: one SPA origin, no explicit CORS_ORIGINS.
    policy = resolve_cors([], "https://frontend-nu-ochre.vercel.app")
    assert policy.allow_origins == ("https://frontend-nu-ochre.vercel.app",)
    assert policy.allow_credentials is True
    assert policy.is_wildcard is False


def test_nothing_configured_wildcard_forces_credentials_off():
    # The dangerous case the old fallback got wrong. A wildcard is only ever
    # paired with credentials DISABLED -- the browser still refuses cookies.
    policy = resolve_cors([], "")
    assert policy.allow_origins == ("*",)
    assert policy.allow_credentials is False
    assert policy.is_wildcard is True


def test_literal_star_in_allowlist_is_not_treated_as_credentialed_allowlist():
    # A stray "*" entry must not sneak a credentialed wildcard through; it is
    # dropped and resolution falls through to FRONTEND_URL.
    policy = resolve_cors(["*"], "https://frontend-nu-ochre.vercel.app")
    assert policy.is_wildcard is False
    assert policy.allow_origins == ("https://frontend-nu-ochre.vercel.app",)
    assert policy.allow_credentials is True


def test_star_frontend_also_forces_credentials_off():
    # If even FRONTEND_URL is a wildcard, credentials are still forced off.
    policy = resolve_cors([], "*")
    assert policy.allow_origins == ("*",)
    assert policy.allow_credentials is False


@pytest.mark.parametrize(
    "cors_origins,frontend_url",
    [
        ([], ""),
        ([], "https://app.example.com"),
        (["https://a.example.com"], "https://app.example.com"),
        (["*"], ""),
        (["*"], "https://app.example.com"),
    ],
)
def test_invariant_never_credentialed_wildcard(cors_origins, frontend_url):
    """The one rule that must hold for EVERY environment: you never get
    ``allow_credentials=True`` together with a ``*`` origin."""
    policy = resolve_cors(cors_origins, frontend_url)
    assert isinstance(policy, CorsPolicy)
    assert not (policy.is_wildcard and policy.allow_credentials), (
        f"credentialed wildcard leaked for "
        f"cors_origins={cors_origins!r} frontend_url={frontend_url!r}"
    )


# --- The running app actually wires this policy -----------------------------

def _app_cors_middleware():
    """Pull the configured CORSMiddleware off the live app's stack so we assert
    the REAL wiring, not a reconstruction."""
    import main

    for mw in main.app.user_middleware:
        if mw.cls is CORSMiddleware:
            return mw
    raise AssertionError("CORSMiddleware is not configured on the app")


def test_app_cors_middleware_is_never_credentialed_wildcard():
    mw = _app_cors_middleware()
    kwargs = mw.kwargs
    origins = list(kwargs.get("allow_origins", []))
    creds = kwargs.get("allow_credentials", False)
    if origins == ["*"]:
        assert creds is False, "app wired a credentialed wildcard"


def test_app_cors_matches_resolve_cors_for_current_env():
    from config import settings

    expected = resolve_cors(settings.cors_origins, settings.frontend_url)
    mw = _app_cors_middleware()
    assert list(mw.kwargs.get("allow_origins", [])) == list(expected.allow_origins)
    assert mw.kwargs.get("allow_credentials") == expected.allow_credentials


# --- A real preflight reflects the policy (no credentialed wildcard echo) ----

def test_preflight_does_not_echo_credentialed_wildcard():
    """A browser preflight from an arbitrary origin must never get back BOTH
    ``Access-Control-Allow-Origin: *`` AND
    ``Access-Control-Allow-Credentials: true``."""
    import main

    client = TestClient(main.app)
    r = client.options(
        "/health",
        headers={
            "Origin": "https://evil.example.com",
            "Access-Control-Request-Method": "GET",
        },
    )
    allow_origin = r.headers.get("access-control-allow-origin")
    allow_creds = r.headers.get("access-control-allow-credentials")
    assert not (allow_origin == "*" and allow_creds == "true")
