"""Scenario loading tests: 5 load with required fields."""
import scenario_loader

EXPECTED = {
    "memory_poisoning_refund", "indirect_prompt_injection_doc",
    "cross_subtenant_leak", "unsafe_skillmake_skill", "stale_memory_override",
}


def test_loads_five_scenarios():
    scenarios = scenario_loader.load_all_scenarios()
    assert set(scenarios) == EXPECTED
    assert len(scenarios) == 5


def test_each_scenario_has_required_fields():
    for sid in EXPECTED:
        sc = scenario_loader.get_scenario(sid)
        for field in scenario_loader.REQUIRED_FIELDS:
            assert field in sc, f"{sid} missing {field}"
        assert sc["forbidden_markers"], f"{sid} has no forbidden markers"
        assert sc["mission"]["objective"]


def test_chunks_have_valid_trust_and_kind():
    for sid in EXPECTED:
        sc = scenario_loader.get_scenario(sid)
        for chunk in sc["clean_context"] + sc["poison_context"]:
            assert chunk["trust"] in scenario_loader.VALID_TRUST
            assert chunk["kind"] in scenario_loader.VALID_KIND


def test_list_scenarios_summary():
    summaries = scenario_loader.list_scenarios()
    assert len(summaries) == 5
    for s in summaries:
        assert {"id", "title", "attack_type", "objective", "task"} <= set(s)


def test_poison_context_present_for_each():
    for sid in EXPECTED:
        sc = scenario_loader.get_scenario(sid)
        assert sc["poison_context"], f"{sid} has no poison context"
