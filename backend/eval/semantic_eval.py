"""Measured evaluation of the semantic poison detector.

WHY THIS EXISTS
---------------
``semantic_detector.py`` ships hand-tuned thresholds (``POISON_THRESHOLD``,
``HIGH_SIM_THRESHOLD``) and the README claims it catches *reworded* policy-
override poison without false-flagging policy-affirming text. Until now those
claims were ASSERTED in prose. This module turns the claim into a measured,
repeatable number: it runs the detector's OWN public decision gate
(``semantic_detector.detect``) over a versioned labeled dataset and reports a
confusion matrix (precision / recall / F1 / accuracy) plus every misclassified
row, so the accuracy claim is evidence-backed and a threshold regression is
visible instead of silent.

HONESTY / NO FAKE DATA
----------------------
* The dataset (``semantic_eval_dataset.json``) is the ground truth; this module
  never invents a score. ``detect`` decides; this module only counts.
* OFFLINE (default, CI-safe): the caller injects a deterministic embedding
  function (the same fake-space approach the test-suite already uses) so the
  decision LOGIC -- the threshold gate, the benign veto, the band mapping -- is
  evaluated end to end with NO network call and NO API key. This measures the
  decision boundary, not the embedding model.
* LIVE (opt-in): with a real Gemini key and ``HYDRASENTRY_SEMANTIC_LIVE=1`` the
  same harness runs against real ``gemini-embedding-001`` embeddings, measuring
  the shipped detector for real. Reported separately so the two are never
  conflated.

The harness is pure: it does not import the value path (risk_engine, auth, DB),
holds no state, and cannot affect the canonical judge demo or tenant isolation.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Optional

import semantic_detector

_EVAL_DIR = Path(__file__).resolve().parent
DATASET_PATH = _EVAL_DIR / "semantic_eval_dataset.json"

# A detector verdict is POSITIVE (poison) when detect() reports it available and
# fired; everything else (not fired, or unavailable) is treated as NEGATIVE. An
# unavailable result is deliberately a NEGATIVE here, not an error: the detector
# fails closed to the lexical path in production, so for the SEMANTIC layer's own
# accuracy an unavailable verdict is "this layer did not flag it".
PoisonLabel = "poison"
BenignLabel = "benign"


@dataclass(frozen=True)
class EvalRow:
    """One labeled candidate memory."""

    id: str
    label: str
    text: str
    provenance: str = ""


@dataclass(frozen=True)
class Confusion:
    """Confusion matrix + derived metrics for a binary poison/benign run."""

    true_positive: int
    false_positive: int
    true_negative: int
    false_negative: int

    @property
    def total(self) -> int:
        return (
            self.true_positive
            + self.false_positive
            + self.true_negative
            + self.false_negative
        )

    @property
    def precision(self) -> float:
        denom = self.true_positive + self.false_positive
        return self.true_positive / denom if denom else 1.0

    @property
    def recall(self) -> float:
        denom = self.true_positive + self.false_negative
        return self.true_positive / denom if denom else 1.0

    @property
    def f1(self) -> float:
        p, r = self.precision, self.recall
        return (2 * p * r / (p + r)) if (p + r) else 0.0

    @property
    def accuracy(self) -> float:
        correct = self.true_positive + self.true_negative
        return correct / self.total if self.total else 1.0

    def as_dict(self) -> dict[str, Any]:
        return {
            "true_positive": self.true_positive,
            "false_positive": self.false_positive,
            "true_negative": self.true_negative,
            "false_negative": self.false_negative,
            "total": self.total,
            "precision": round(self.precision, 4),
            "recall": round(self.recall, 4),
            "f1": round(self.f1, 4),
            "accuracy": round(self.accuracy, 4),
        }


def load_dataset(path: Path = DATASET_PATH) -> list[EvalRow]:
    """Load and validate the labeled dataset. Raises on a malformed row rather
    than silently dropping it -- a corrupt eval set must fail loudly, not lie."""
    raw = json.loads(path.read_text(encoding="utf-8"))
    rows_raw = raw.get("rows")
    if not isinstance(rows_raw, list) or not rows_raw:
        raise ValueError("eval dataset has no rows")
    rows: list[EvalRow] = []
    seen_ids: set[str] = set()
    for item in rows_raw:
        rid = str(item["id"])
        label = str(item["label"]).strip().lower()
        text = str(item["text"]).strip()
        if label not in (PoisonLabel, BenignLabel):
            raise ValueError(f"row {rid!r} has invalid label {label!r}")
        if not text:
            raise ValueError(f"row {rid!r} has empty text")
        if rid in seen_ids:
            raise ValueError(f"duplicate row id {rid!r}")
        seen_ids.add(rid)
        rows.append(
            EvalRow(id=rid, label=label, text=text,
                    provenance=str(item.get("provenance", "")))
        )
    return rows


def _verdict_is_poison(result: dict[str, Any]) -> bool:
    """Map a ``semantic_detector.detect`` result to a binary poison verdict."""
    return bool(result.get("available")) and bool(result.get("fired"))


def evaluate(
    rows: Optional[list[EvalRow]] = None,
    embed_fn: Optional[Callable[[str, str, str], Optional[list[float]]]] = None,
) -> dict[str, Any]:
    """Run the REAL detector gate over ``rows`` and return metrics + errors.

    ``embed_fn`` (offline mode) is monkeypatched onto
    ``semantic_detector._embed_one`` for the duration of the run and restored
    afterwards, so callers get deterministic, key-free evaluation of the decision
    logic. When ``embed_fn`` is None the live shipped embedding path is used
    (requires a configured Gemini key; otherwise detect() fails closed and every
    row reads as NEGATIVE, which the live test guards against).

    Returns ``{confusion, errors, by_provenance, mode}`` where ``errors`` lists
    every misclassified row (id, label, text, verdict) so a regression is
    legible, not just a dropped number.
    """
    if rows is None:
        rows = load_dataset()

    original_embed = semantic_detector._embed_one
    original_sig_cache = semantic_detector._SIG_CACHE
    original_anchor_cache = semantic_detector._ANCHOR_CACHE
    try:
        if embed_fn is not None:
            # Isolate from any persisted regression store and warm cache so the
            # measured boundary is the SHIPPED base signatures + anchors only.
            semantic_detector._embed_one = embed_fn  # type: ignore[assignment]
            semantic_detector._SIG_CACHE = type(original_sig_cache)()
            semantic_detector._ANCHOR_CACHE = {"emb": None}
        tp = fp = tn = fn = 0
        errors: list[dict[str, Any]] = []
        for row in rows:
            result = semantic_detector.detect([{"chunk_id": row.id, "text": row.text}])
            predicted_poison = _verdict_is_poison(result)
            actual_poison = row.label == PoisonLabel
            if actual_poison and predicted_poison:
                tp += 1
            elif actual_poison and not predicted_poison:
                fn += 1
                errors.append(_error_row(row, "missed", result))
            elif not actual_poison and predicted_poison:
                fp += 1
                errors.append(_error_row(row, "false_positive", result))
            else:
                tn += 1
    finally:
        semantic_detector._embed_one = original_embed  # type: ignore[assignment]
        semantic_detector._SIG_CACHE = original_sig_cache
        semantic_detector._ANCHOR_CACHE = original_anchor_cache

    confusion = Confusion(
        true_positive=tp, false_positive=fp, true_negative=tn, false_negative=fn
    )
    return {
        "mode": "offline" if embed_fn is not None else "live",
        "confusion": confusion.as_dict(),
        "errors": errors,
        "row_count": len(rows),
        "poison_rows": sum(1 for r in rows if r.label == PoisonLabel),
        "benign_rows": sum(1 for r in rows if r.label == BenignLabel),
    }


def _error_row(row: EvalRow, kind: str, result: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row.id,
        "label": row.label,
        "provenance": row.provenance,
        "kind": kind,
        "text": row.text,
        "max_similarity": result.get("max_similarity"),
        "available": result.get("available"),
        "fired": result.get("fired"),
    }


def format_report(report: dict[str, Any]) -> str:
    """Human-readable summary for the CLI entrypoint."""
    c = report["confusion"]
    lines = [
        f"Semantic poison-detector evaluation ({report['mode']} mode)",
        f"  dataset: {report['row_count']} rows "
        f"({report['poison_rows']} poison, {report['benign_rows']} benign)",
        "  confusion matrix:",
        f"    TP={c['true_positive']}  FP={c['false_positive']}  "
        f"TN={c['true_negative']}  FN={c['false_negative']}",
        f"  precision = {c['precision']:.3f}",
        f"  recall    = {c['recall']:.3f}",
        f"  f1        = {c['f1']:.3f}",
        f"  accuracy  = {c['accuracy']:.3f}",
    ]
    if report["errors"]:
        lines.append("  misclassified:")
        for err in report["errors"]:
            lines.append(
                f"    [{err['kind']}] {err['id']} ({err['label']}): {err['text'][:70]!r}"
            )
    else:
        lines.append("  misclassified: none")
    return "\n".join(lines)


if __name__ == "__main__":  # pragma: no cover - manual CLI entrypoint
    import os
    import sys

    live = os.getenv("HYDRASENTRY_SEMANTIC_LIVE", "0").lower() in ("1", "true", "yes")
    if live:
        os.environ["HYDRASENTRY_SEMANTIC_DETECTION"] = "1"
        out = evaluate(embed_fn=None)
    else:
        # Import the offline deterministic embedding space lazily so the module
        # has no test dependency in its import graph.
        from eval.fake_embedding_space import fake_embed_for_eval

        os.environ["HYDRASENTRY_SEMANTIC_DETECTION"] = "1"
        out = evaluate(embed_fn=fake_embed_for_eval)
    print(format_report(out))
    sys.exit(0)
