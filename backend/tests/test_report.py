"""Report generator tests: all sections present + exact legal statement."""
import report
import scenario_engine


def _artifact():
    return scenario_engine.run_judge_demo()


def test_all_sections_present_in_order():
    md = _artifact()["report_markdown"]
    last = -1
    for section in report.SECTIONS:
        idx = md.find(section)
        assert idx != -1, f"missing section: {section}"
        assert idx > last, f"section out of order: {section}"
        last = idx


def test_exact_legal_statement():
    md = _artifact()["report_markdown"]
    assert report.LEGAL_STATEMENT in md
    assert ("only against tenants, subtenants, memories, and knowledge created "
            "by this HydraSentry instance") in md


def test_graph_evidence_labeled():
    md = _artifact()["report_markdown"]
    assert ("REAL HYDRADB QUERY_PATHS" in md
            or "DERIVED SCENARIO GRAPH FALLBACK" in md)


def test_report_includes_score_and_decision():
    art = _artifact()
    md = art["report_markdown"]
    assert str(art["risk"]["score"]) in md
    assert art["firewall"]["decision"] in md
