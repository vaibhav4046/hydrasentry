"""Constellan zero-setup CLI.

Run the full Constellan pipeline on your OWN memories with no HydraDB key, no
account, and no network:

    python -m constellan scan examples/refund_memories.json

(from the ``backend/`` directory), or equivalently:

    python cli.py scan examples/refund_memories.json

It ingests the memories, builds a transparent LOCAL HEURISTIC GRAPH in-process,
detects any poisoned/stale memory, traces the taint path to the unsafe action,
scores the risk deterministically, and prints the risk band, the tainted path,
and the flagged findings. The graph is honestly labelled ``local_graph`` -- a
local heuristic graph, NOT real HydraDB. HydraDB remains the flagship, graph-
native backend (see the README "Adapters" section).
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

# Allow ``python cli.py ...`` from the backend dir and ``python -m constellan``
# from the repo root by ensuring the backend dir is importable.
_BACKEND_DIR = Path(__file__).resolve().parent
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

from adapters.local_scan import run_local_scan  # noqa: E402

_RULE = "-" * 60


def _load_payload(path: Path) -> dict[str, Any]:
    """Read a memories JSON file, tolerating a UTF-8 BOM. Accepts either the
    object form ``{task?, policy?, memories: [...]}`` or a bare list of
    memories."""
    data = json.loads(path.read_text(encoding="utf-8-sig"))
    if isinstance(data, list):
        return {"memories": data}
    if isinstance(data, dict):
        return data
    raise ValueError("memories file must be a JSON object or array")


def _render(result: dict[str, Any]) -> str:
    """Render the scan result as readable plain text for the terminal."""
    risk = result["risk"]
    lines: list[str] = []
    lines.append("Constellan local scan (no HydraDB key required)")
    lines.append(_RULE)
    lines.append(f"Task           : {result['task']}")
    lines.append(f"Graph source   : {result['graph_source']}  "
                 "(local heuristic graph, NOT real HydraDB)")
    lines.append("")
    lines.append(f"RISK           : {risk['band']}  "
                 f"(score {risk['score']}/100, confidence {risk['confidence']})")
    lines.append(f"Attack type    : {risk['attack_type']}")
    lines.append(f"Firewall       : {result['firewall']['decision']}")
    lines.append("")

    tainted = result["tainted_path"]
    lines.append("Tainted path:")
    lines.append("  " + (" -> ".join(tainted) if tainted else "(none detected)"))
    lines.append("")

    lines.append("Tainted query_paths triplets:")
    tainted_triplets = [t for t in result["query_paths"] if t.get("tainted")]
    if tainted_triplets:
        for t in tainted_triplets:
            lines.append(
                f"  {t['source']} --{t['relation']}--> {t['target']} "
                f"(chunk {t.get('source_chunk_id')})"
            )
    else:
        lines.append("  (none)")
    lines.append("")

    lines.append("Flagged findings:")
    if result["findings"]:
        for f in result["findings"]:
            lines.append(f"  - {f}")
    else:
        lines.append("  - (no findings)")
    lines.append(_RULE)
    lines.append("Note: this is a local heuristic graph for zero-setup use. "
                 "For graph-native HydraDB query_paths, run with a HydraDB key "
                 "(APP_MODE=real).")
    return "\n".join(lines)


def _cmd_scan(args: argparse.Namespace) -> int:
    path = Path(args.memories)
    if not path.exists():
        print(f"error: memories file not found: {path}", file=sys.stderr)
        return 2
    try:
        payload = _load_payload(path)
    except (ValueError, json.JSONDecodeError, OSError, UnicodeDecodeError) as exc:
        print(f"error: could not parse {path}: {exc}", file=sys.stderr)
        return 2
    if not payload.get("memories"):
        print(f"error: no memories found in {path}", file=sys.stderr)
        return 2

    result = run_local_scan(payload)
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print(_render(result))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="constellan",
        description="Constellan: context-integrity harness for AI agent memory. "
                    "Run a poisoned-memory scan on your own data with no HydraDB key.",
    )
    sub = parser.add_subparsers(dest="command", required=True)
    scan = sub.add_parser(
        "scan",
        help="Scan a JSON file of memories for poisoning and trace the taint path.",
    )
    scan.add_argument(
        "memories",
        help="Path to a JSON file: {task?, policy?, memories:[{id?,text,trust?}]} "
             "or a bare list of memories.",
    )
    scan.add_argument(
        "--json", action="store_true",
        help="Emit the full result as JSON instead of formatted text.",
    )
    scan.set_defaults(func=_cmd_scan)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
