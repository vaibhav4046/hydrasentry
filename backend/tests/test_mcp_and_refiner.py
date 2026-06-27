"""MCP secret-guard and self-refiner tests."""
import mcp_gateway
import scenario_engine
import self_refiner


def test_self_refiner_from_finding():
    art = scenario_engine.run_scenario("memory_poisoning_refund")
    refine = self_refiner.refine_from_finding(art)
    assert refine["finding_accepted"] is True
    assert refine["rule_id"].startswith("rule_memory_poisoning_")
    assert refine["regression_scenario_id"] == "regression_memory_poisoning_refund"
    assert refine["ota"]["pack"] == "attack-pack"
    assert len(refine["timeline"]) == 6


def test_mcp_write_requires_secret_when_set(monkeypatch):
    monkeypatch.setattr(mcp_gateway, "_shared_secret", lambda: "topsecret")
    bad = mcp_gateway.call_tool("schedule_scan", {"name": "x"}, provided_secret="wrong")
    assert bad["ok"] is False
    assert bad["error"] == "unauthorized"
    good = mcp_gateway.call_tool("schedule_scan", {"name": "x"}, provided_secret="topsecret")
    assert good["ok"] is True


def test_mcp_write_refused_when_secret_unset(monkeypatch):
    """Fail-closed (operating rule #3): an UNSET MCP_SHARED_SECRET must REFUSE
    write tools, not silently allow them. This is finding #2 (LOW latent)."""
    monkeypatch.setattr(mcp_gateway, "_shared_secret", lambda: "")
    res = mcp_gateway.call_tool("schedule_scan", {"name": "x"})
    assert res["ok"] is False
    assert res["error"] == "unauthorized"
    assert "not configured" in res.get("warning", "")


def test_mcp_read_tool_allowed_when_secret_unset(monkeypatch):
    """A read tool stays usable even with no secret configured -- only WRITE
    tools fail closed, so the public read surface (manifest/findings) survives."""
    monkeypatch.setattr(mcp_gateway, "_shared_secret", lambda: "")
    res = mcp_gateway.call_tool("list_findings", {})
    assert res["ok"] is True


def test_mcp_secret_compare_is_constant_time(monkeypatch):
    """The write-tool secret compare uses hmac.compare_digest (constant-time)."""
    import inspect

    monkeypatch.setattr(mcp_gateway, "_shared_secret", lambda: "topsecret")
    # Correct secret authorises; the guard path uses hmac.compare_digest.
    good = mcp_gateway.call_tool("schedule_scan", {"name": "x"},
                                 provided_secret="topsecret")
    assert good["ok"] is True
    assert "hmac.compare_digest" in inspect.getsource(mcp_gateway._secret_guard)


def test_mcp_read_tool_no_secret_required(monkeypatch):
    monkeypatch.setattr(mcp_gateway, "_shared_secret", lambda: "topsecret")
    res = mcp_gateway.call_tool("list_findings", {})
    assert res["ok"] is True


def test_mcp_recent_calls_logged():
    mcp_gateway.call_tool("list_findings", {})
    assert any(c["tool"] == "list_findings" for c in mcp_gateway.recent_calls())
