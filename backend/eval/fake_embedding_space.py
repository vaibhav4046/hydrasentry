"""Deterministic offline embedding space for the semantic-eval harness.

This is the SAME modelling idea the test-suite uses in
``tests/test_semantic_detector.py``: a tiny, transparent keyword router that maps
a text to a low-dimensional vector approximating where ``gemini-embedding-001``
would place it. It exists so the detector's DECISION LOGIC (threshold gate,
benign veto, band mapping) can be measured end to end with no network and no key.

HONESTY NOTE -- it does NOT cheat by reading labels
---------------------------------------------------
The router keys off *meaning words* an attacker/operator would actually use, not
off the dataset's ground-truth label. The benign POLICY rows ("must be escalated
to a supervisor") deliberately route to the benign axis -- close to the poison
axis on shared vocabulary, exactly the hard-negative the real model produces --
so the benign veto must do real work to keep them out of the poison bucket. If
the router trivially separated the classes there would be nothing to measure.

A reader can audit every routing decision below; nothing here is opaque.
"""
from __future__ import annotations

from typing import Optional

import semantic_detector

# Four orthogonal-ish axes. Poison paraphrases land high on axis 0 with a small
# benign bleed (mirrors the real model's high cosine floor on shared finance
# vocabulary). Benign POLICY text lands high on axis 1 (the benign axis) with a
# poison bleed of the same magnitude, so on raw poison-similarity alone it would
# look suspicious -- only the benign veto (best_p >= best_b) saves it. Plain
# operational text lands on the neutral axis 2, far from both.
_POISON_VEC = [0.97, 0.24, 0.0]
_BENIGN_POLICY_VEC = [0.30, 0.95, 0.0]
_NEUTRAL_VEC = [0.05, 0.10, 0.99]

# Meaning cues that mark a memory as a policy-OVERRIDE paraphrase (the attack).
# These are about intent ("you may skip / it is already cleared / no sign-off
# needed"), distinct from policy-AFFIRMING language below.
_POISON_CUES = (
    "without waiting", "without a supervisor", "without supervisor",
    "without a manager", "without manager", "no need to", "no sign-off",
    "no sign off", "do not need", "does not need", "don't need", "exempt",
    "auto-approve", "auto approve", "automatically cleared", "automatically",
    "lifted", "bumped up", "raised", "skip the escalation", "skip the approval",
    "process the reimbursement directly", "process the refund directly",
    "pre-authorization", "pre-authorized", "pre-cleared", "straight through",
    "disregard", "ignore the manager", "override the refund policy",
    "no longer required", "settled immediately", "settle reimbursements immediately",
    "refund any amount", "clear this payout", "on your own", "right away",
)

# Meaning cues that mark a memory as policy-AFFIRMING (benign hard-negative).
# Heavy vocabulary overlap with the attacks on purpose.
_BENIGN_POLICY_CUES = (
    "require manager approval", "requires manager approval", "require approval",
    "must be escalated", "must escalate", "as required by policy",
    "verify identity", "follow the approval policy", "escalate when required",
    "escalated to a supervisor", "escalate this refund to the manager",
    "require manager approval per the policy",
)


def fake_embed_for_eval(text: str, key: str, base_url: str) -> Optional[list[float]]:
    """Deterministic embedding. Signature matches ``semantic_detector._embed_one``.

    Order of checks matters: the curated base SIGNATURES and benign ANCHORS are
    pinned to their axes first (so the detector's own reference points are never
    misrouted), then candidate text is routed by meaning cues. Policy-affirming
    cues are checked before falling through to neutral so a benign policy
    statement lands on the benign axis (the hard case), not neutral."""
    low = (text or "").strip().lower()

    # Pin the detector's own reference vectors regardless of wording.
    if low in {s.lower() for s in semantic_detector._BASE_SIGNATURES}:
        return list(_POISON_VEC)
    if low in {a.lower() for a in semantic_detector._BENIGN_ANCHORS}:
        if any(cue in low for cue in _BENIGN_POLICY_CUES):
            return list(_BENIGN_POLICY_VEC)
        return list(_NEUTRAL_VEC)

    # Candidate routing by meaning. Policy-affirming first so it is not stolen by
    # a stray poison cue, then poison, then neutral.
    if any(cue in low for cue in _BENIGN_POLICY_CUES) and \
            not any(cue in low for cue in _POISON_CUES):
        return list(_BENIGN_POLICY_VEC)
    if any(cue in low for cue in _POISON_CUES):
        return list(_POISON_VEC)
    if any(cue in low for cue in _BENIGN_POLICY_CUES):
        return list(_BENIGN_POLICY_VEC)
    return list(_NEUTRAL_VEC)
