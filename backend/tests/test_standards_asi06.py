"""Tests for the OWASP ASI06 control-mapping artifact.

These tests are what make the mapping HONEST: they fail if any control cites an
implementing file that does not exist or a symbol that is no longer in that
file. So the mapping can never silently drift into a false compliance claim --
rename or delete the implementing code and this suite goes red.
"""
from fastapi.testclient import TestClient

import main
from standards import asi06

client = TestClient(main.app)


def test_mapping_has_expected_shape():
    art = asi06.mapping(verify=True)
    assert art["risk_id"] == "ASI06"
    assert art["risk_name"] == "Memory Poisoning"
    assert art["taxonomy"].startswith("OWASP")
    assert art["control_count"] == len(asi06.CONTROLS)
    assert art["control_count"] >= 5
    # Verified shape: one row per control, each carrying its evidence anchors.
    assert len(art["controls"]) == art["control_count"]


def test_every_control_evidence_file_exists():
    for control in asi06.CONTROLS:
        path = asi06.evidence_path(control)
        assert path.is_file(), (
            f"ASI06 control {control['id']} cites a non-existent file: "
            f"{control['evidence_file']}"
        )


def test_every_control_symbol_is_present_in_its_file():
    for control in asi06.CONTROLS:
        path = asi06.evidence_path(control)
        text = path.read_text(encoding="utf-8", errors="replace")
        assert control["evidence_symbol"] in text, (
            f"ASI06 control {control['id']} cites symbol "
            f"'{control['evidence_symbol']}' which is no longer present in "
            f"{control['evidence_file']} -- update the mapping or restore the code."
        )


def test_verify_controls_all_pass():
    rows = asi06.verify_controls()
    assert rows, "expected at least one control"
    unverified = [r["id"] for r in rows if not r["verified"]]
    assert not unverified, f"unverified ASI06 controls: {unverified}"
    assert all(r["file_exists"] and r["symbol_present"] for r in rows)


def test_control_ids_are_unique():
    ids = [c["id"] for c in asi06.CONTROLS]
    assert len(ids) == len(set(ids)), "duplicate ASI06 control id"


def test_endpoint_returns_verified_mapping():
    resp = client.get("/standards/asi06")
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    data = body["data"]
    assert data["risk_id"] == "ASI06"
    # The live endpoint must report honest verification, computed against the
    # running codebase -- not a hardcoded True.
    assert data["verified_all"] is True
    assert data["control_count"] >= 5
    for control in data["controls"]:
        assert control["verified"] is True
        assert control["evidence_file"].startswith("backend/")


def test_endpoint_is_public_no_auth_required():
    # No credentials supplied: the compliance artifact must still resolve, since
    # it is the public mapping a judge fetches. It must NOT leak anything beyond
    # the static control descriptions (no keys, no provider matrix, no tenant).
    resp = client.get("/standards/asi06")
    assert resp.status_code == 200
    raw = resp.text.lower()
    for leaked in ("hs_live_", "secret", "database_url", "api_key", "password"):
        assert leaked not in raw
