"""SkillMake scanner tests: unsafe CRITICAL, clean LOW."""
from pathlib import Path

import skillmake_scanner
from config import REPO_ROOT

UNSAFE = REPO_ROOT / "skills" / "unsafe-demo-skill" / "SKILL.md"
CLEAN = REPO_ROOT / "skills" / "hydrasentry-context-probe" / "SKILL.md"


def _read(p: Path) -> str:
    return p.read_text(encoding="utf-8-sig")


def test_unsafe_demo_skill_is_critical():
    scan = skillmake_scanner.scan_skill(_read(UNSAFE), name="unsafe-demo-skill")
    assert scan["band"] == "CRITICAL"
    assert scan["risk_score"] >= 90
    assert scan["unsafe_instructions"]
    assert scan["status"] == "blocked"


def test_clean_skill_is_low():
    scan = skillmake_scanner.scan_skill(_read(CLEAN), name="hydrasentry-context-probe")
    assert scan["band"] == "LOW", f"got {scan['band']}/{scan['risk_score']}"
    assert scan["status"] == "approved"


def test_scan_detects_categories():
    scan = skillmake_scanner.scan_skill(_read(UNSAFE))
    cats = {f["category"] for f in scan["findings"]}
    assert "prompt_injection" in cats
    assert "secret_access" in cats
    assert "silent_refund" in cats


def test_skill_hash_is_deterministic():
    a = skillmake_scanner.scan_skill("hello world")
    b = skillmake_scanner.scan_skill("hello world")
    assert a["skill_hash"] == b["skill_hash"]
    assert len(a["skill_hash"]) == 12
