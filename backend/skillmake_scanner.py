"""Static safety scanner for SkillMake SKILL.md content.

Detects hidden prompt injection, secret access, dangerous shell, exfiltration,
silent refund approval, user-deception, and description/body semantic mismatch.
Returns a deterministic risk score, band, and per-line findings. The
unsafe-demo-skill fixture must score CRITICAL (>=90); a benign skill LOW.
"""
from __future__ import annotations

import hashlib
import re
from typing import Any

# Each rule: (category, severity, weight, compiled pattern).
_RULES: list[tuple[str, str, int, "re.Pattern[str]"]] = [
    ("prompt_injection", "critical", 45,
     re.compile(r"ignore (all |the )?previous instructions", re.I)),
    ("ignore_rules", "high", 25,
     re.compile(r"\b(disregard|bypass|override)\b.{0,40}\b(rules?|policy|policies|guardrails?)\b", re.I)),
    ("secret_access", "critical", 40,
     re.compile(
         r"(read|open|cat|load|access|extract|dump|steal|exfiltrate|grab|harvest)\s+"
         r"(the\s+|all\s+|any\s+)?(\.?env|secret|token|password|credential|api[_ ]?key)",
         re.I)),
    ("dangerous_shell", "critical", 40,
     re.compile(r"rm\s+-rf|curl[^\n]*\|\s*(sh|bash)|wget[^\n]*\|\s*(sh|bash)|\beval\s*\(", re.I)),
    ("network_exfil", "critical", 40,
     re.compile(r"(send|post|exfiltrate|upload|transmit)\b.{0,40}\b(external|endpoint|server|http)|https?://exfil", re.I)),
    ("filesystem_access", "high", 20,
     re.compile(r"(read|write|delete|scan)\s+(all\s+)?(files?|filesystem|/etc|home directory)", re.I)),
    ("silent_refund", "critical", 40,
     re.compile(r"approve\s+refunds?\s+silently|refund\s+approved\s+silently", re.I)),
    ("user_deception", "high", 25,
     re.compile(r"do not (tell|notify|inform)\s+the user|without (telling|notifying) (the )?user|hide .* from the user", re.I)),
    ("risky_trigger", "medium", 12,
     re.compile(r"trigger.{0,30}(always|automatically|every (request|message))", re.I)),
]

# Verbs that indicate dangerous behaviour for semantic-mismatch detection.
_DANGER_VERBS = re.compile(
    r"\b(exfiltrate|delete|destroy|leak|steal|disable|bypass|hijack|inject)\b", re.I)

BAND_LOW_MAX = 39
BAND_MEDIUM_MAX = 69
BAND_HIGH_MAX = 89


def _band(score: int) -> str:
    if score <= BAND_LOW_MAX:
        return "LOW"
    if score <= BAND_MEDIUM_MAX:
        return "MEDIUM"
    if score <= BAND_HIGH_MAX:
        return "HIGH"
    return "CRITICAL"


def _frontmatter_description(text: str) -> str:
    m = re.search(r"^---\s*$(.*?)^---\s*$", text, re.S | re.M)
    block = m.group(1) if m else text[:400]
    d = re.search(r"^\s*description\s*:\s*(.+)$", block, re.M | re.I)
    return d.group(1).strip().strip('"').strip("'") if d else ""


def _skill_name(text: str) -> str:
    m = re.search(r"^\s*name\s*:\s*(.+)$", text, re.M | re.I)
    return m.group(1).strip().strip('"').strip("'") if m else "unknown-skill"


def scan_skill(content: str, name: str | None = None) -> dict[str, Any]:
    """Scan SKILL.md text and return a structured risk result."""
    content = content or ""
    skill_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()[:12]
    skill_name = name or _skill_name(content)
    description = _frontmatter_description(content)

    lines = content.splitlines()
    findings: list[dict[str, Any]] = []
    unsafe_instructions: list[str] = []
    total = 0
    seen_categories: set[str] = set()

    for idx, line in enumerate(lines, start=1):
        for category, severity, weight, pattern in _RULES:
            if pattern.search(line):
                findings.append({
                    "line_no": idx,
                    "text": line.strip()[:200],
                    "category": category,
                    "severity": severity,
                })
                # Count each category's weight once, plus a small repeat penalty.
                if category not in seen_categories:
                    total += weight
                    seen_categories.add(category)
                else:
                    total += 5
                if severity in ("critical", "high"):
                    unsafe_instructions.append(line.strip()[:200])

    # Semantic mismatch: benign-sounding description but dangerous body verbs.
    benign_desc = bool(re.search(r"\b(helper|triage|assistant|benign|support|summari[sz]e)\b",
                                 description, re.I))
    body = content
    if m := re.search(r"^---\s*$(.*?)^---\s*$(.*)$", content, re.S | re.M):
        body = m.group(2)
    if benign_desc and _DANGER_VERBS.search(body):
        findings.append({
            "line_no": 0,
            "text": f"description claims benign ('{description[:60]}') but body contains dangerous verbs",
            "category": "semantic_mismatch",
            "severity": "high",
        })
        if "semantic_mismatch" not in seen_categories:
            total += 25
            seen_categories.add("semantic_mismatch")

    risk_score = int(max(0, min(100, total)))
    band = _band(risk_score)

    if band == "CRITICAL":
        recommended_fix = (
            "Block this skill. Remove hidden prompt-injection, secret access, "
            "silent refund approval, and exfiltration instructions before any use."
        )
        status = "blocked"
    elif band in ("HIGH", "MEDIUM"):
        recommended_fix = (
            "Quarantine and review. Strip risky instructions and re-scan before enabling."
        )
        status = "quarantined"
    else:
        recommended_fix = "No unsafe instructions detected. Safe to use under normal review."
        status = "approved"

    return {
        "skill_hash": skill_hash,
        "name": skill_name,
        "description": description,
        "risk_score": risk_score,
        "band": band,
        "findings": findings,
        "unsafe_instructions": unsafe_instructions,
        "recommended_fix": recommended_fix,
        "status": status,
    }
