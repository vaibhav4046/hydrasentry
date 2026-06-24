"""Quarantine state transition tests."""
import scenario_engine
import storage


def test_quarantine_on_high_risk_run():
    art = scenario_engine.run_scenario("memory_poisoning_refund", quarantine_enabled=True)
    assert art["firewall"]["decision"] in ("block", "quarantine")
    assert art["quarantine"]["memory_id"] == "mem_poison_047"
    assert art["quarantine"]["status"] == "quarantined"


def test_quarantine_disabled_leaves_memory():
    art = scenario_engine.run_scenario("memory_poisoning_refund", quarantine_enabled=False)
    assert art["quarantine"]["memory_id"] is None
    assert art["quarantine"]["status"] == "not_quarantined"


def test_quarantine_persisted_and_reloadable():
    art = scenario_engine.run_scenario("memory_poisoning_refund", quarantine_enabled=True)
    reloaded = storage.load_run(art["run_id"])
    assert reloaded is not None
    assert reloaded["quarantine"]["status"] == "quarantined"
