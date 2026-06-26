"""Smoke tests for the zero-setup Constellan CLI (cli.main).

Drives the CLI entrypoint in-process on the bundled sample and asserts it exits
cleanly and prints the risk band + taint path with no HydraDB key.
"""
import json
from pathlib import Path

import cli

_EXAMPLES = Path(__file__).resolve().parent.parent / "examples" / "refund_memories.json"


def test_cli_scan_sample_exits_zero_and_reports_poison(capsys):
    rc = cli.main(["scan", str(_EXAMPLES)])
    assert rc == 0
    out = capsys.readouterr().out
    assert "local_graph" in out
    assert "RISK" in out
    assert "HIGH" in out
    assert "mem_poison_047" in out
    assert "Tainted path" in out


def test_cli_scan_json_mode_emits_valid_json(capsys):
    rc = cli.main(["scan", str(_EXAMPLES), "--json"])
    assert rc == 0
    out = capsys.readouterr().out
    data = json.loads(out)
    assert data["graph_source"] == "local_graph"
    assert data["risk"]["band"] in ("HIGH", "CRITICAL")
    assert data["tainted_path"]


def test_cli_missing_file_returns_error_code(capsys):
    rc = cli.main(["scan", "does_not_exist_12345.json"])
    assert rc == 2
    err = capsys.readouterr().err
    assert "not found" in err
