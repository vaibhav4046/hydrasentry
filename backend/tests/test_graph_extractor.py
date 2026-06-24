"""Graph extractor tests: derived fallback, taint, provenance labeling."""
import graph_extractor
import scenario_loader


def test_derived_fallback_when_no_paths():
    sc = scenario_loader.get_scenario("memory_poisoning_refund")
    g = graph_extractor.build_graph(None, sc)
    assert g["source"] == "derived_scenario_graph"
    assert len(g["nodes"]) == 8
    assert len(g["edges"]) == 8


def test_derived_taint_marks_poison():
    sc = scenario_loader.get_scenario("memory_poisoning_refund")
    g = graph_extractor.build_graph(None, sc)
    tainted = [n for n in g["nodes"] if n["status"] == "tainted"]
    assert tainted, "no tainted nodes"
    assert "poisoned_memory" in g["tainted_path"]
    assert "unsafe_tool_action" in g["tainted_path"]


def test_demo_paths_labeled_derived_not_real():
    sc = scenario_loader.get_scenario("memory_poisoning_refund")
    demo_qr = {
        "real": False, "demo": True,
        "graph_context": {"query_paths": [
            {"source": "mem_poison_047", "relation": "overrides",
             "target": "policy_refund_v2", "source_chunk_id": "mem_poison_047",
             "tainted": True},
        ]},
    }
    g = graph_extractor.build_graph(demo_qr, sc)
    assert g["source"] == "derived_scenario_graph"
    assert any(t["tainted"] for t in g["query_paths"])


def test_genuine_real_paths_labeled_real():
    sc = scenario_loader.get_scenario("memory_poisoning_refund")
    real_qr = {
        "real": True,
        "graph_context": {"query_paths": [
            {"source": "a", "relation": "r", "target": "b",
             "source_chunk_id": "mem_poison_047", "tainted": True},
        ]},
    }
    g = graph_extractor.build_graph(real_qr, sc)
    assert g["source"] == "real_query_paths"


def test_query_paths_triplets_have_shape():
    sc = scenario_loader.get_scenario("memory_poisoning_refund")
    g = graph_extractor.build_graph(None, sc)
    for t in g["query_paths"]:
        assert {"source", "relation", "target", "source_chunk_id", "tainted"} <= set(t)
