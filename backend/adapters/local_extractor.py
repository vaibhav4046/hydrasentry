"""Transparent local relation extractor for the zero-setup LocalGraphAdapter.

This is a deliberately simple, fully transparent heuristic that builds a
relation graph from plain memory texts WITHOUT any network call, account, or
HydraDB key. It is honestly a local heuristic graph, NOT real HydraDB graph
extraction, and every caller labels it ``local_graph`` so it can never be
mistaken for HydraDB ``query_paths``.

Two complementary signals are mined from the memory corpus:

1. **Explicit relations.** If a memory already carries ``relations`` triplets
   (the scenario fixtures do), they are used verbatim. This lets arbitrary
   user input opt into precise edges without depending on the heuristic.
2. **Co-occurrence relations.** For memories without explicit relations, a
   small set of transparent surface rules over the text mines
   ``subject --predicate--> object`` triplets: a leading noun phrase as the
   subject, a recognised predicate verb, and a trailing noun phrase as the
   object. Anything that does not match a rule contributes a single
   ``mentions`` edge from the memory's own entity to each salient keyword, so
   the graph is never empty for real input.

The point is forensic transparency: a reader can look at a memory and predict
its edges. Determinism matters because the same input must always yield the
same graph (the CLI and tests rely on it).
"""
from __future__ import annotations

import logging
import re
from typing import Any

logger = logging.getLogger("hydrasentry.local_extractor")

# Predicate verbs the surface rules recognise, longest-first so multi-word
# predicates win over their single-word prefixes ("must approve" before
# "approve"). Each maps the raw phrase to a canonical relation label.
_PREDICATES: list[tuple[str, str]] = [
    ("requires approval from", "requires_approval_from"),
    ("should always receive", "should_receive"),
    ("should receive", "should_receive"),
    ("must escalate to", "must_escalate_to"),
    ("must be escalated to", "must_escalate_to"),
    ("requires approval", "requires_approval"),
    ("requires", "requires"),
    ("must approve", "must_approve"),
    ("must escalate", "must_escalate"),
    ("overrides", "overrides"),
    ("bypasses", "bypasses"),
    ("ignores", "ignores"),
    ("ignore", "ignores"),
    ("approves", "approves"),
    ("approve", "approves"),
    ("instructs", "instructs"),
    ("governs", "governs"),
    ("contradicts", "contradicts"),
    ("supersedes", "supersedes"),
    ("shadows", "shadows"),
    ("grants", "grants"),
    ("exposes", "exposes"),
    ("reads", "reads"),
    ("leaks", "leaks"),
    ("discloses", "discloses"),
    ("describes", "describes"),
    ("subject to", "subject_to"),
    ("applies to", "applies_to"),
    # NB: deliberately no bare "is"/"are" predicate -- a single common copula
    # verb would mine a spurious edge from almost every sentence and could
    # inject synthetic graph taint. Only meaningful domain verbs are listed.
]

# Words ignored when picking a salient keyword for the fallback ``mentions``
# edge. Kept deliberately small and obvious.
_STOPWORDS = frozenset({
    "the", "a", "an", "and", "or", "but", "to", "of", "for", "in", "on",
    "at", "by", "with", "from", "this", "that", "these", "those", "is",
    "are", "was", "were", "be", "been", "being", "it", "its", "as", "if",
    "then", "than", "so", "no", "not", "do", "does", "did", "should",
    "must", "can", "will", "would", "always", "never", "all", "any",
    "their", "they", "them", "you", "your", "i", "we", "he", "she",
})

_TRAILING_PUNCT = ".,;:!?\"'()[]"
_TOKEN_RE = re.compile(r"[a-z0-9][a-z0-9_£$%-]*", re.IGNORECASE)


def _slug(phrase: str) -> str:
    """Normalise a noun phrase into a stable node id (lowercase, underscores)."""
    cleaned = phrase.strip().strip(_TRAILING_PUNCT).lower()
    cleaned = re.sub(r"[^a-z0-9£$%]+", "_", cleaned)
    cleaned = cleaned.strip("_")
    return cleaned or "entity"


def _split_sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+", text.strip())
    return [p.strip() for p in parts if p.strip()]


def _salient_keywords(text: str, limit: int = 3) -> list[str]:
    """Pick up to ``limit`` salient keyword slugs from text (transparent rule:
    first non-stopword tokens, deduped, order-preserving)."""
    out: list[str] = []
    for tok in _TOKEN_RE.findall(text.lower()):
        if tok in _STOPWORDS or len(tok) < 3:
            continue
        slug = _slug(tok)
        if slug and slug not in out:
            out.append(slug)
        if len(out) >= limit:
            break
    return out


def _match_predicate(sentence: str) -> tuple[str, str, str] | None:
    """Find the first recognised predicate in a sentence and split it into
    (subject_phrase, relation_label, object_phrase). Returns None if no
    predicate verb is present or either side is empty."""
    low = sentence.lower()
    for phrase, label in _PREDICATES:
        idx = low.find(f" {phrase} ")
        if idx == -1:
            continue
        subject = sentence[:idx].strip()
        obj = sentence[idx + len(phrase) + 2:].strip()
        if subject and obj:
            return subject, label, obj
    return None


def _memory_entity(memory: dict[str, Any]) -> str:
    """Stable node id for a memory itself (its title/id, else first keywords)."""
    base = memory.get("title") or memory.get("id") or memory.get("chunk_id")
    if base:
        return _slug(str(base))
    kws = _salient_keywords(memory.get("text", ""), limit=2)
    return "_".join(kws) if kws else "memory"


def _triplet(source: str, relation: str, target: str, chunk_id: str | None,
             tainted: bool) -> dict[str, Any]:
    return {
        "source": source,
        "relation": relation,
        "target": target,
        "source_chunk_id": chunk_id,
        "tainted": tainted,
    }


def extract_paths(memories: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Build local-heuristic query_paths triplets from memory dicts.

    Each memory dict is expected to carry at least ``text``; ``chunk_id`` (or
    ``id``), ``trust``, and optional ``relations`` are honoured when present.
    A memory whose trust is poisoned/stale taints every triplet it produces, so
    the downstream taint-trace and risk engine fire exactly as they do for the
    demo and real adapters.

    The triplets are flat ``{source, relation, target, source_chunk_id,
    tainted}`` dicts, the same shape ``graph_extractor`` already consumes.
    """
    paths: list[dict[str, Any]] = []
    for mem in memories:
        # Defensive: arbitrary user input may contain non-dict items; skip them
        # rather than crash (this function is reachable from the API endpoint).
        if not isinstance(mem, dict):
            continue
        chunk_id = mem.get("chunk_id") or mem.get("id")
        tainted = mem.get("trust") in ("poisoned", "stale")
        rel_raw = mem.get("relations")
        explicit = rel_raw if isinstance(rel_raw, list) else []
        produced = False

        # 1. Explicit relations win: precise, predictable edges.
        for rel in explicit:
            if not isinstance(rel, dict):
                continue
            s = rel.get("source")
            r = rel.get("relation") or "related_to"
            t = rel.get("target")
            if s and t:
                paths.append(_triplet(_slug(s), r, _slug(t), chunk_id, tainted))
                produced = True

        if produced:
            continue

        # 2. Co-occurrence heuristic over the memory text. Coerce to str so a
        #    non-string ``text`` (int, etc.) cannot crash the sentence splitter.
        raw_text = mem.get("text", "")
        text = raw_text if isinstance(raw_text, str) else str(raw_text or "")
        for sentence in _split_sentences(text):
            match = _match_predicate(sentence)
            if match:
                subj, rel, obj = match
                paths.append(
                    _triplet(_slug(subj), rel, _slug(obj), chunk_id, tainted)
                )
                produced = True

        # 3. Fallback: never leave a real memory edgeless. Connect the memory's
        #    own entity to its salient keywords with a ``mentions`` edge.
        if not produced:
            entity = _memory_entity(mem)
            for kw in _salient_keywords(text):
                if kw != entity:
                    paths.append(
                        _triplet(entity, "mentions", kw, chunk_id, tainted)
                    )

    logger.info("local extractor produced %d triplets from %d memories",
                len(paths), len(memories))
    return paths
