/**
 * Incident integrity certificate — a tamper-evident attestation built over a
 * persisted incident, verifiable OFFLINE in the browser with zero secrets.
 *
 * HONESTY CONTRACT (mirrors backend/hydrasentry_mcp/certificate.py):
 *  - The certified payload is a canonical JSON over the incident's verdict
 *    fields (subject, kind, band, score, status, finding metadata). We compute a
 *    SHA-256 digest over the SAME canonicalisation the backend uses
 *    (sort_keys=True, separators (",", ":")). Changing any field changes the
 *    digest.
 *  - Verification recomputes the digest from the embedded payload and constant-
 *    compares. A match -> VERIFIED (tamper-evident). A mismatch -> TAMPERED.
 *    There is NO "always valid" path: `verifyCertificate` returns false the
 *    instant a single byte of the payload is altered.
 *  - This is the UNSIGNED (digest-only) tier. The HMAC signature requires the
 *    server-side HYDRASENTRY_CERT_SECRET, which is NEVER shipped to the client,
 *    so the browser proves tamper-evidence, not authenticity. We label it
 *    exactly that way — no signed-claim theater.
 *
 * Web Crypto (crypto.subtle.digest) does the real SHA-256; there is no mocked
 * hash. The whole module is pure + offline (no network), so verification works
 * with the backend down.
 */
import type { Incident } from "./consoleTypes";

export interface CertificatePayload {
  kind: "incident_attestation";
  subject: string;
  band: string;
  score: number;
  status: string;
  attack_type: string;
  graph_source: string;
  mode: string;
  llm_provider: string;
  created_at: string | null;
}

export interface IncidentCertificate {
  version: string;
  issuer: string;
  algorithm: string;
  signed: false;
  payload: CertificatePayload;
  /** "sha256:<hex>" over the canonical payload. */
  digest: string;
}

const CERT_VERSION = "mic-incident/1";
const ISSUER = "hydrasentry-console";

/**
 * Canonical JSON matching the backend's
 * `json.dumps(payload, sort_keys=True, separators=(",", ":"))`. Keys sorted
 * lexicographically; no whitespace; null renders as `null`. JS JSON.stringify
 * already matches Python's number/string/null encoding for these field types.
 */
function canonical(payload: CertificatePayload): string {
  const record = payload as unknown as Record<string, unknown>;
  const ordered: Record<string, unknown> = {};
  for (const key of Object.keys(record).sort()) {
    ordered[key] = record[key];
  }
  return JSON.stringify(ordered);
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const buffer = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Build the certified payload from a persisted incident. */
export function incidentPayload(incident: Incident): CertificatePayload {
  return {
    kind: "incident_attestation",
    subject: incident.scenario || "unknown",
    band: incident.band,
    score: incident.risk_score,
    status: incident.decision,
    attack_type: incident.attack_type,
    graph_source: incident.graph_source,
    mode: incident.mode,
    llm_provider: incident.llm_provider,
    created_at: incident.created_at,
  };
}

/** Issue a digest-bound integrity certificate for an incident (real SHA-256). */
export async function buildIncidentCertificate(
  incident: Incident,
): Promise<IncidentCertificate> {
  const payload = incidentPayload(incident);
  const digest = await sha256Hex(canonical(payload));
  return {
    version: CERT_VERSION,
    issuer: ISSUER,
    algorithm: "sha256-digest-only",
    signed: false,
    payload,
    digest: `sha256:${digest}`,
  };
}

export interface VerifyResult {
  valid: boolean;
  digestOk: boolean;
  signed: boolean;
  reason: string;
}

/**
 * Verify a certificate offline. Recomputes the digest over the embedded payload
 * and compares to the claimed digest. Fail-closed and honest: any mismatch
 * yields valid:false with a concrete reason. There is no shortcut to valid:true.
 */
export async function verifyCertificate(
  cert: IncidentCertificate,
): Promise<VerifyResult> {
  if (!cert || !cert.payload || !cert.digest) {
    return {
      valid: false,
      digestOk: false,
      signed: false,
      reason: "malformed certificate (missing payload or digest)",
    };
  }
  const claimed = cert.digest.replace(/^sha256:/, "");
  const recomputed = await sha256Hex(canonical(cert.payload));
  const digestOk = timingSafeEqualHex(claimed, recomputed);
  if (!digestOk) {
    return {
      valid: false,
      digestOk: false,
      signed: false,
      reason: "digest mismatch: the certified payload has been altered",
    };
  }
  return {
    valid: true,
    digestOk: true,
    signed: false,
    reason:
      "digest verified offline (tamper-evident). Unsigned tier: the HMAC " +
      "signature is verified server-side with HYDRASENTRY_CERT_SECRET, which is " +
      "never shipped to the browser.",
  };
}

/** Length-checked, constant-time-ish hex compare (defense in depth). */
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
