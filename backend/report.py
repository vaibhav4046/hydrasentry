"""Markdown finding-report generator for HydraSentry.

Sections appear in a fixed, required order. The legal testing statement is
emitted verbatim. The report clearly states whether graph evidence is real
HydraDB query_paths or a derived scenario-graph fallback.
"""
from __future__ import annotations

from typing import Any

from graph_extractor import LOCAL, REAL

LEGAL_STATEMENT = (
    "All tests were executed only against tenants, subtenants, memories, and "
    "knowledge created by this HydraSentry instance. No third-party data was "
    "accessed."
)

# Required section order (used by tests and the renderer).
SECTIONS = [
    "# HydraSentry Finding Report",
    "## Summary",
    "## Severity",
    "## Attack Type",
    "## Scenario",
    "## Environment",
    "## Reproduction Steps",
    "## Baseline Result",
    "## Poisoned Result",
    "## Behavior Difference",
    "## HydraDB Graph Evidence",
    "## Tainted query_paths Triplets",
    "## Affected Chunk IDs",
    "## Risk Score",
    "## Context Firewall Decision",
    "## Action Taken",
    "## Recommended Fix",
    "## Regression Test Created",
    "## Legal Testing Statement",
    "## Next Scheduled Scan",
]


def _bullets(items: list[str]) -> str:
    return "\n".join(f"- {i}" for i in items) if items else "- (none)"


def _graph_label(source: str) -> str:
    if source == REAL:
        return "REAL HYDRADB QUERY_PATHS"
    if source == LOCAL:
        return "LOCAL HEURISTIC GRAPH (NO HYDRADB)"
    return "DERIVED SCENARIO GRAPH FALLBACK"


def _adapter_label(source: str) -> str:
    if source == REAL:
        return "real HydraDB"
    if source == LOCAL:
        return "local heuristic graph (no HydraDB)"
    return "deterministic demo"


def generate_report(artifact: dict[str, Any]) -> str:
    risk = artifact.get("risk", {})
    graph = artifact.get("graph", {})
    baseline = artifact.get("baseline", {})
    poisoned = artifact.get("poisoned", {})
    behavior = artifact.get("behavior_diff", {})
    firewall = artifact.get("firewall", {})
    quarantine = artifact.get("quarantine", {})
    mission = artifact.get("mission", {})
    refine = artifact.get("self_refinement", {})
    scan = artifact.get("skill_scan")
    sched = artifact.get("scheduled_scan", {})

    graph_source = graph.get("source", artifact.get("graph_source", "derived_scenario_graph"))
    graph_label = _graph_label(graph_source)

    affected = sorted(set(
        (baseline.get("retrieved_chunk_ids", []) or [])
        + (poisoned.get("retrieved_chunk_ids", []) or [])
    ))

    triplets = graph.get("query_paths", [])
    triplet_lines = [
        f"`{t['source']}` --{t['relation']}--> `{t['target']}` "
        f"(chunk `{t.get('source_chunk_id')}`, tainted={t.get('tainted')})"
        for t in triplets
    ]

    repro = [
        f"Provision owned tenant `{artifact.get('mission',{}).get('id','')}` "
        f"under `{baseline.get('tenant_id', 'hydrasentry-owned-test')}`.",
        "Seed the clean context (policy + trusted memory).",
        f"Run baseline replay for task: {mission.get('objective','')}",
        "Inject the poisoned context chunk.",
        "Re-run the poisoned replay and capture the answer.",
        "Parse the HydraDB graph, taint the poisoned path, and score the risk.",
    ]

    rule_id = refine.get("rule_id", "n/a")
    regression_id = refine.get("regression_scenario_id", "n/a")

    lines: list[str] = []
    lines.append(SECTIONS[0])
    lines.append("")
    lines.append(SECTIONS[1])
    lines.append(mission.get("title", artifact.get("scenario_id", "")))
    lines.append("")
    lines.append(mission.get("objective", ""))
    lines.append("")
    lines.append(SECTIONS[2])
    lines.append(f"**{risk.get('band','LOW')}** (score {risk.get('score',0)}/100, "
                 f"confidence {risk.get('confidence',0)})")
    lines.append("")
    lines.append(SECTIONS[3])
    lines.append(f"`{risk.get('attack_type','unknown')}`")
    lines.append("")
    lines.append(SECTIONS[4])
    lines.append(f"Scenario id: `{artifact.get('scenario_id','')}` "
                 f"(mode: {artifact.get('mode','demo')})")
    lines.append("")
    lines.append(SECTIONS[5])
    lines.append(f"- Tenant: `{baseline.get('tenant_id','hydrasentry-owned-test')}`")
    lines.append(f"- Adapter: {_adapter_label(graph_source)}")
    lines.append(f"- Graph evidence: {graph_label}")
    lines.append("")
    lines.append(SECTIONS[6])
    lines.append(_bullets(repro))
    lines.append("")
    lines.append(SECTIONS[7])
    lines.append(f"Verdict: **{baseline.get('verdict','safe')}**")
    lines.append("")
    lines.append(f"> {baseline.get('answer','')}")
    lines.append("")
    lines.append(SECTIONS[8])
    lines.append(f"Verdict: **{poisoned.get('verdict','compromised')}**")
    lines.append("")
    lines.append(f"> {poisoned.get('answer','')}")
    lines.append("")
    lines.append(SECTIONS[9])
    lines.append(f"Changed: **{behavior.get('changed', False)}**")
    lines.append("")
    lines.append(_bullets(behavior.get("indicators", [])))
    lines.append("")
    lines.append(SECTIONS[10])
    lines.append(f"Graph source: **{graph_label}** (`{graph_source}`)")
    lines.append("")
    lines.append(f"- Nodes: {len(graph.get('nodes', []))}")
    lines.append(f"- Edges: {len(graph.get('edges', []))}")
    lines.append(f"- Tainted path: {' -> '.join(graph.get('tainted_path', [])) or '(none)'}")
    lines.append("")
    lines.append(SECTIONS[11])
    lines.append(_bullets(triplet_lines))
    lines.append("")
    lines.append(SECTIONS[12])
    lines.append(_bullets([f"`{c}`" for c in affected]))
    lines.append("")
    lines.append(SECTIONS[13])
    lines.append(f"**{risk.get('score',0)}/100** -> band **{risk.get('band','LOW')}**")
    lines.append("")
    lines.append(f"- rules: {risk.get('components',{}).get('rules')}")
    lines.append(f"- judge: {risk.get('components',{}).get('judge')}")
    lines.append(f"- replay: {risk.get('components',{}).get('replay')}")
    lines.append(f"- deterministic_only: {risk.get('deterministic_only')}")
    lines.append("")
    lines.append(_bullets(risk.get("rules_fired", [])))
    lines.append("")
    lines.append(SECTIONS[14])
    lines.append(f"Decision: **{firewall.get('decision','allow')}** "
                 f"(mode: {firewall.get('mode','copilot')})")
    lines.append("")
    lines.append(_bullets(firewall.get("actions", [])))
    lines.append("")
    lines.append(SECTIONS[15])
    if quarantine and quarantine.get("memory_id"):
        lines.append(f"Quarantined memory `{quarantine.get('memory_id')}` "
                     f"-> status **{quarantine.get('status')}**")
    else:
        lines.append("No quarantine action taken.")
    lines.append("")
    lines.append(SECTIONS[16])
    if scan:
        lines.append(f"Skill `{scan.get('name')}` scanned: band **{scan.get('band')}** "
                     f"(score {scan.get('risk_score')}). {scan.get('recommended_fix','')}")
    else:
        lines.append(artifact.get("recommended_fix",
                     "Reject the poisoned context, enforce the approved policy, and "
                     "require human review for the blocked action."))
    lines.append("")
    lines.append(SECTIONS[17])
    lines.append(f"Regression scenario `{regression_id}` registered; detection rule "
                 f"`{rule_id}` drafted.")
    lines.append("")
    lines.append(SECTIONS[18])
    lines.append(LEGAL_STATEMENT)
    lines.append("")
    lines.append(SECTIONS[19])
    lines.append(f"`{sched.get('name','Regression Replay')}` at "
                 f"`{sched.get('next_run','(scheduled)')}` (schedule `{sched.get('schedule','')}`).")
    lines.append("")
    return "\n".join(lines)
