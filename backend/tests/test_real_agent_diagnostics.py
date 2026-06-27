"""Tests for the Groq real-path diagnostics + transient retry in real_agent.

These cover the Phase-0 hardening fixes:
* ``_groq_chat`` retries once on a transient status (429/5xx) so a single demo
  burst recovers instead of silently dropping to the deterministic fallback.
* Any non-success records a diagnostic reason (e.g. "groq 429 rate_limited")
  readable via ``last_failure_reason`` so a degraded demo is diagnosable.
"""
from __future__ import annotations

import types

import pytest

import real_agent


class _FakeResponse:
    def __init__(self, status_code: int, *, content: str = "", headers=None):
        self.status_code = status_code
        self._content = content
        self.headers = headers or {}

    def json(self):
        return {"choices": [{"message": {"content": self._content}}]}


class _FakeClient:
    """Stands in for httpx.Client. Pops from a SHARED queue + call counter so
    that the per-attempt ``httpx.Client()`` instantiations in _groq_chat see
    responses consumed in order across retries (matching real behaviour)."""

    def __init__(self, responses, counter):
        self._responses = responses  # shared list, mutated across attempts
        self._counter = counter  # shared one-element list

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def post(self, *_args, **_kwargs):
        self._counter[0] += 1
        return self._responses.pop(0)


def _patch_httpx(monkeypatch, responses, recorder):
    import httpx

    shared = list(responses)
    counter = [0]
    recorder["counter"] = counter

    def _factory(*_args, **_kwargs):
        return _FakeClient(shared, counter)

    monkeypatch.setattr(httpx, "Client", _factory, raising=True)


def _patch_provider(monkeypatch):
    """Give real_agent a configured Groq provider so it reaches the HTTP path."""
    provider = types.SimpleNamespace(api_key="test-key", base_url="https://groq.test/v1")
    monkeypatch.setitem(real_agent.PROVIDERS, "groq", provider)


@pytest.fixture(autouse=True)
def _reset_failure():
    real_agent.reset_failure_reason()
    yield
    real_agent.reset_failure_reason()


def test_groq_chat_success_clears_failure(monkeypatch):
    _patch_provider(monkeypatch)
    _patch_httpx(monkeypatch, [_FakeResponse(200, content="approve the refund")], {})
    monkeypatch.setattr(real_agent.time, "sleep", lambda *_: None)
    out = real_agent._groq_chat([{"role": "user", "content": "hi"}], 64)
    assert out == "approve the refund"
    assert real_agent.last_failure_reason() is None


def test_groq_chat_retries_once_on_429_then_succeeds(monkeypatch):
    _patch_provider(monkeypatch)
    rec: dict = {}
    _patch_httpx(
        monkeypatch,
        [_FakeResponse(429, headers={"retry-after": "0"}), _FakeResponse(200, content="ok")],
        rec,
    )
    monkeypatch.setattr(real_agent.time, "sleep", lambda *_: None)
    out = real_agent._groq_chat([{"role": "user", "content": "hi"}], 64)
    assert out == "ok"
    assert rec["counter"][0] == 2  # retried exactly once
    assert real_agent.last_failure_reason() is None  # success after retry


def test_groq_chat_429_exhausted_surfaces_rate_limited(monkeypatch):
    _patch_provider(monkeypatch)
    _patch_httpx(
        monkeypatch,
        [_FakeResponse(429, headers={"retry-after": "0"}), _FakeResponse(429)],
        {},
    )
    monkeypatch.setattr(real_agent.time, "sleep", lambda *_: None)
    out = real_agent._groq_chat([{"role": "user", "content": "hi"}], 64)
    assert out is None
    assert real_agent.last_failure_reason() == "groq 429 rate_limited"


def test_groq_chat_401_does_not_retry_and_surfaces_auth(monkeypatch):
    _patch_provider(monkeypatch)
    rec: dict = {}
    _patch_httpx(monkeypatch, [_FakeResponse(401), _FakeResponse(200, content="x")], rec)
    monkeypatch.setattr(real_agent.time, "sleep", lambda *_: None)
    out = real_agent._groq_chat([{"role": "user", "content": "hi"}], 64)
    assert out is None
    assert rec["counter"][0] == 1  # auth errors are not retried
    assert real_agent.last_failure_reason() == "groq 401 auth"


def test_groq_chat_no_key_surfaces_no_key(monkeypatch):
    provider = types.SimpleNamespace(api_key="", base_url="https://groq.test/v1")
    monkeypatch.setitem(real_agent.PROVIDERS, "groq", provider)
    out = real_agent._groq_chat([{"role": "user", "content": "hi"}], 64)
    assert out is None
    assert real_agent.last_failure_reason() == "groq no_key"


def test_retry_after_seconds_is_capped(monkeypatch):
    assert real_agent._retry_after_seconds({"retry-after": "999"}) == real_agent._RETRY_BACKOFF_CAP_SECONDS
    assert real_agent._retry_after_seconds({}) == real_agent._RETRY_BACKOFF_SECONDS
    assert real_agent._retry_after_seconds({"retry-after": "bad"}) == real_agent._RETRY_BACKOFF_SECONDS
