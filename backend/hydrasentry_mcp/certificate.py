"""Memory Integrity Certificate (MIC) record for HydraSentry.

A certificate is a small, deterministic, tamper-evident attestation that a
specific scan result (a SKILL.md scan or a local memory/context scan) was
produced by HydraSentry, what verdict it carried, and that the certified payload
has not been altered since. It is NOT a claim of trust in an external authority:
it is a self-contained, locally verifiable record.

How it is real (not a mock):

* The certificate binds the actual scan result. We compute a SHA-256 digest over
  a canonical JSON serialisation of the verdict fields (subject, kind, band,
  score, status, finding count, the per-line finding digests). Changing any of
  those fields changes the digest.
* The digest is signed with HMAC-SHA256 using a secret from the environment
  (``HYDRASENTRY_CERT_SECRET``). ``verify_certificate`` recomputes the HMAC over
  the embedded payload and constant-time compares it. A tampered payload, a
  wrong secret, or a truncated signature all fail verification with an honest
  reason. There is no "always valid" path.
* If no signing secret is configured we still issue a certificate, but mark it
  ``signed: false`` and emit an honest ``warning`` that it is an unsigned
  integrity record (digest-only, tamper-evident but not authenticated). We never
  pretend an unsigned record is signed.

This module has no network or service dependency, so the certificate tools work
with or without HydraDB / LLM keys.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
from datetime import datetime, timezone
from typing import Any

CERT_VERSION = "mic/1"
ISSUER = "hydrasentry-mcp"
_SECRET_ENV = "HYDRASENTRY_CERT_SECRET"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _secret() -> str:
    return os.getenv(_SECRET_ENV, "")


def _finding_digests(findings: list[dict[str, Any]]) -> list[str]:
    """Stable per-finding digests so the certificate binds the exact findings."""
    digests: list[str] = []
    for f in findings or []:
        canon = json.dumps(
            {
                "line_no": f.get("line_no"),
                "category": f.get("category"),
                "severity": f.get("severity"),
                "text": (f.get("text") or "")[:200],
            },
            sort_keys=True,
            ensure_ascii=False,
        )
        digests.append(hashlib.sha256(canon.encode("utf-8")).hexdigest()[:16])
    return digests


def _payload_from_scan(scan: dict[str, Any]) -> dict[str, Any]:
    """Extract the certified verdict fields from a real scan result.

    Accepts either a SKILL.md scan (``skillmake_scanner.scan_skill`` output:
    band/risk_score/status/findings) or a local memory scan
    (``run_local_scan`` output: risk.band/risk.score/firewall.decision).
    """
    if "risk_score" in scan or "band" in scan:
        # SKILL.md scan shape.
        return {
            "kind": "skill_scan",
            "subject": scan.get("name") or scan.get("skill_hash") or "unknown-skill",
            "subject_hash": scan.get("skill_hash"),
            "band": scan.get("band"),
            "score": scan.get("risk_score"),
            "status": scan.get("status"),
            "finding_count": len(scan.get("findings") or []),
            "finding_digests": _finding_digests(scan.get("findings") or []),
        }
    risk = scan.get("risk") or {}
    firewall = scan.get("firewall") or {}
    return {
        "kind": "context_scan",
        "subject": scan.get("scenario_title") or scan.get("task") or "memory_scan",
        "subject_hash": None,
        "band": risk.get("band"),
        "score": risk.get("score"),
        "status": firewall.get("decision"),
        "finding_count": len(scan.get("findings") or []),
        "finding_digests": [
            hashlib.sha256(str(f).encode("utf-8")).hexdigest()[:16]
            for f in (scan.get("findings") or [])
        ],
    }


def _canonical(payload: dict[str, Any]) -> str:
    return json.dumps(payload, sort_keys=True, ensure_ascii=False, separators=(",", ":"))


def _digest(payload: dict[str, Any]) -> str:
    return hashlib.sha256(_canonical(payload).encode("utf-8")).hexdigest()


def _sign(digest: str, secret: str) -> str:
    return hmac.new(secret.encode("utf-8"), digest.encode("utf-8"), hashlib.sha256).hexdigest()


def generate_certificate(scan: dict[str, Any]) -> dict[str, Any]:
    """Issue a Memory Integrity Certificate for a real scan result.

    Returns a self-contained record:
      { version, issuer, issued_at, payload, digest, signed, algorithm,
        signature?, warning? }
    The record is verifiable offline by ``verify_certificate``.
    """
    payload = _payload_from_scan(scan)
    payload["issued_at"] = _now_iso()
    digest = _digest(payload)
    secret = _secret()

    cert: dict[str, Any] = {
        "version": CERT_VERSION,
        "issuer": ISSUER,
        "issued_at": payload["issued_at"],
        "payload": payload,
        "digest": f"sha256:{digest}",
    }
    if secret:
        cert["signed"] = True
        cert["algorithm"] = "HMAC-SHA256"
        cert["signature"] = _sign(digest, secret)
    else:
        cert["signed"] = False
        cert["algorithm"] = "sha256-digest-only"
        cert["warning"] = (
            "No HYDRASENTRY_CERT_SECRET configured: this is an UNSIGNED integrity "
            "record. The digest still makes it tamper-evident, but it is not "
            "cryptographically authenticated. Set HYDRASENTRY_CERT_SECRET to sign."
        )
    return cert


def verify_certificate(cert: dict[str, Any]) -> dict[str, Any]:
    """Verify a Memory Integrity Certificate. Honest, fail-closed.

    Recomputes the digest over the embedded payload and (when signed) the HMAC
    over that digest, constant-time comparing both. Returns
    ``{valid, reason, signed, digest_ok, signature_ok?, subject, band}``.
    Any tampering, wrong secret, or missing field yields ``valid: false`` with a
    concrete reason. There is no path that returns valid without a real match.
    """
    if not isinstance(cert, dict) or "payload" not in cert or "digest" not in cert:
        return {"valid": False, "reason": "malformed certificate (missing payload/digest)"}

    payload = cert.get("payload") or {}
    claimed_digest = str(cert.get("digest", "")).removeprefix("sha256:")
    recomputed = _digest(payload)
    digest_ok = hmac.compare_digest(claimed_digest, recomputed)

    result: dict[str, Any] = {
        "signed": bool(cert.get("signed")),
        "digest_ok": digest_ok,
        "subject": payload.get("subject"),
        "band": payload.get("band"),
    }

    if not digest_ok:
        result["valid"] = False
        result["reason"] = "digest mismatch: the certified payload has been altered"
        return result

    if not cert.get("signed"):
        result["valid"] = True
        result["signature_ok"] = None
        result["reason"] = (
            "digest verified (tamper-evident). Certificate is UNSIGNED; configure "
            "HYDRASENTRY_CERT_SECRET on both issue and verify for authentication."
        )
        return result

    secret = _secret()
    if not secret:
        result["valid"] = False
        result["signature_ok"] = False
        result["reason"] = (
            "certificate is signed but no HYDRASENTRY_CERT_SECRET is configured "
            "here to verify the signature"
        )
        return result

    expected = _sign(recomputed, secret)
    signature_ok = hmac.compare_digest(str(cert.get("signature", "")), expected)
    result["signature_ok"] = signature_ok
    result["valid"] = signature_ok
    result["reason"] = (
        "digest and HMAC signature verified" if signature_ok
        else "signature mismatch: wrong secret or tampered signature"
    )
    return result
