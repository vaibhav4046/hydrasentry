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


def test_mcp_write_allowed_with_warning_when_unset(monkeypatch):
    monkeypatch.setattr(mcp_gateway, "_shared_secret", lambda: "")
    res = mcp_gateway.call_tool("schedule_scan", {"name": "x"})
    assert res["ok"] is True
    assert "MCP_SHARED_SECRET not set" in res.get("warning", "")


def test_mcp_read_tool_no_secret_required(monkeypatch):
    monkeypatch.setattr(mcp_gateway, "_shared_secret", lambda: "topsecret")
    res = mcp_gateway.call_tool("list_findings", {})
    assert res["ok"] is True


def test_mcp_recent_calls_logged():
    mcp_gateway.call_tool("list_findings", {})
    assert any(c["tool"] == "list_findings" for c in mcp_gateway.recent_calls())
