"""Pins the MEASURED accuracy of the semantic poison detector.

Round "push10-1" gap: the detector's accuracy was asserted in prose, never
measured in-repo. ``eval/semantic_eval.py`` now runs the detector's real public
gate (``semantic_detector.detect``) over a versioned labeled dataset and computes
a confusion matrix. These tests assert minimum metrics so a threshold regression
(e.g. someone nudges ``POISON_THRESHOLD`` and silently breaks recall, or weakens
the benign veto and adds false positives) fails CI instead of passing quietly.

Offline by default (deterministic fake embedding space, no key, CI-safe). The
live proof against real gemini-embedding-001 is opt-in and lives at the bottom.
"""
import os

import pytest

import semantic_detector
from eval import semantic_eval
from eval.fake_embedding_space import fake_embed_for_eval

# Conservative floors: the offline decision-logic eval measures precision = recall
# = f1 = 1.000 on the shipped thresholds. We pin the floors BELOW that so the test
# is a real regression guard (it tolerates a single new hard row drifting) rather
# than a brittle exact-equality assertion, while still failing loudly on any
# meaningful accuracy loss.
_MIN_PRECISION = 0.95
_MIN_RECALL = 0.95
_MIN_F1 = 0.95
_MIN_ACCURACY = 0.95


@pytest.fixture
def semantic_on(monkeypatch):
    monkeypatch.setenv("HYDRASENTRY_SEMANTIC_DETECTION", "1")
    monkeypatch.setattr(semantic_detector, "_provider_key", lambda: "test-key")
    # detect() uses provider.base_url; a dummy provider key is enough because the
    # embedding function is fully replaced by the harness.
    return monkeypatch


# --- dataset integrity ------------------------------------------------------

def test_dataset_loads_and_is_balanced():
    rows = semantic_eval.load_dataset()
    assert len(rows) >= 20, "eval set too small to be meaningful"
    poison = [r for r in rows if r.label == "poison"]
    benign = [r for r in rows if r.label == "benign"]
    assert len(poison) >= 8 and len(benign) >= 8
    # No duplicate ids; load_dataset raises on dupes, so reaching here proves it.
    assert len({r.id for r in rows}) == len(rows)


def test_dataset_has_hard_negatives():
    """The benign set must include policy-affirming text that shares attack
    vocabulary -- otherwise a perfect score would be meaningless."""
    rows = semantic_eval.load_dataset()
    benign_texts = " ".join(r.text.lower() for r in rows if r.label == "benign")
    assert "manager approval" in benign_texts
    assert "escalated to a supervisor" in benign_texts


# --- measured metrics on the real detector gate -----------------------------

def test_offline_eval_meets_precision_recall_floor(semantic_on):
    report = semantic_eval.evaluate(embed_fn=fake_embed_for_eval)
    c = report["confusion"]
    assert report["mode"] == "offline"
    assert c["precision"] >= _MIN_PRECISION, (
        f"precision regressed to {c['precision']}; errors: {report['errors']}"
    )
    assert c["recall"] >= _MIN_RECALL, (
        f"recall regressed to {c['recall']}; errors: {report['errors']}"
    )
    assert c["f1"] >= _MIN_F1
    assert c["accuracy"] >= _MIN_ACCURACY


def test_offline_eval_no_false_positive_on_policy_text(semantic_on):
    """The benign veto must keep policy-affirming hard-negatives out of the
    poison bucket. A false positive here means the veto weakened."""
    report = semantic_eval.evaluate(embed_fn=fake_embed_for_eval)
    fps = [e for e in report["errors"] if e["kind"] == "false_positive"]
    assert not fps, f"benign policy text false-flagged: {fps}"


def test_offline_eval_catches_recon_evasion_row(semantic_on):
    """The exact lexical-evasion case that motivated the semantic layer must be a
    true positive, not just an aggregate hit."""
    report = semantic_eval.evaluate(embed_fn=fake_embed_for_eval)
    missed_ids = {e["id"] for e in report["errors"] if e["kind"] == "missed"}
    assert "p_recon_1" not in missed_ids


def test_confusion_metric_math():
    """Guard the metric arithmetic itself so a reported number can be trusted."""
    c = semantic_eval.Confusion(
        true_positive=8, false_positive=2, true_negative=9, false_negative=1
    )
    assert c.total == 20
    assert round(c.precision, 4) == 0.8  # 8 / (8+2)
    assert round(c.recall, 4) == 0.8889  # 8 / (8+1)
    assert round(c.accuracy, 4) == 0.85  # 17 / 20
    # f1 = 2PR/(P+R)
    assert round(c.f1, 4) == 0.8421


def test_eval_restores_detector_globals(semantic_on):
    """The harness must not leak its injected embedding fn or scratch caches into
    the live module (which would poison every later test)."""
    original_embed = semantic_detector._embed_one
    original_cache = semantic_detector._SIG_CACHE
    semantic_eval.evaluate(embed_fn=fake_embed_for_eval)
    assert semantic_detector._embed_one is original_embed
    assert semantic_detector._SIG_CACHE is original_cache


# --- live proof against real gemini-embedding-001 (opt-in) ------------------
_LIVE = (
    os.getenv("HYDRASENTRY_SEMANTIC_LIVE", "0").lower() in ("1", "true", "yes")
    and bool(os.getenv("GEMINI_API_KEY"))
)
_live_only = pytest.mark.skipif(
    not _LIVE, reason="set HYDRASENTRY_SEMANTIC_LIVE=1 + GEMINI_API_KEY"
)


@_live_only
def test_live_eval_meets_floor():
    os.environ["HYDRASENTRY_SEMANTIC_DETECTION"] = "1"
    report = semantic_eval.evaluate(embed_fn=None)
    c = report["confusion"]
    # Live floors are looser than offline: the real model is allowed an
    # occasional miss on the hardest row, but must still be strongly accurate.
    assert c["recall"] >= 0.80, report["errors"]
    assert c["precision"] >= 0.80, report["errors"]
