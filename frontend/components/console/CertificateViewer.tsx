"use client";

/**
 * Certificate viewer with OFFLINE verify. Builds a digest-bound integrity
 * certificate from the incident (real SHA-256 over a canonical payload), then
 * lets the operator verify it offline. A live "Tamper" toggle mutates a payload
 * field and re-verifies, proving the check is real (VERIFIED -> TAMPERED) rather
 * than decorative. No secret is ever shipped; this is the unsigned tier and is
 * labelled exactly that way.
 */
import { useEffect, useState } from "react";
import { ShieldCheck, ShieldX, ShieldQuestion } from "lucide-react";
import type { Incident } from "@/lib/consoleTypes";
import {
  buildIncidentCertificate,
  verifyCertificate,
  type IncidentCertificate,
  type VerifyResult,
} from "@/lib/incidentCertificate";
import { C } from "@/lib/cockpit/derive";

const MONO = "var(--font-geist-mono), 'JetBrains Mono', monospace";

export function CertificateViewer({ incident }: { incident: Incident }) {
  const [cert, setCert] = useState<IncidentCertificate | null>(null);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [tampered, setTampered] = useState(false);

  // Build the certificate once from the incident.
  useEffect(() => {
    let active = true;
    void buildIncidentCertificate(incident).then((c) => {
      if (active) setCert(c);
    });
    return () => {
      active = false;
    };
  }, [incident]);

  async function runVerify(tamper: boolean) {
    if (!cert) return;
    setTampered(tamper);
    // Tamper: alter a payload field WITHOUT recomputing the digest, so the
    // offline check must catch the mismatch.
    const candidate: IncidentCertificate = tamper
      ? { ...cert, payload: { ...cert.payload, score: cert.payload.score + 1 } }
      : cert;
    setResult(await verifyCertificate(candidate));
  }

  const tone = result?.valid ? C.accent : result ? C.white : C.muted;
  const Icon = !result ? ShieldQuestion : result.valid ? ShieldCheck : ShieldX;

  return (
    <div className="cockpit-card" style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
        <h3 className="cockpit-display" style={{ fontSize: 15, fontWeight: 600, color: C.ink }}>
          Memory Integrity Certificate
        </h3>
        <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.1em", color: C.faint, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, padding: "2px 7px" }}>
          {cert?.algorithm ?? "…"}
        </span>
      </div>

      {/* Certificate field rows */}
      {cert && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
          <Row k="Subject" v={cert.payload.subject} />
          <Row k="Band / Score" v={`${cert.payload.band} · ${cert.payload.score}`} hot />
          <Row k="Decision" v={cert.payload.status} hot />
          <Row k="Attack Type" v={cert.payload.attack_type} />
          <Row k="Graph Source" v={cert.payload.graph_source} />
          <Row k="Mode / Provider" v={`${cert.payload.mode} · ${cert.payload.llm_provider}`} />
          <Row k="Digest" v={cert.digest} mono small />
        </div>
      )}

      {/* Verify control + verdict */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: result ? 12 : 0 }}>
        <button
          type="button"
          onClick={() => void runVerify(false)}
          className="hydra-button-secondary"
          disabled={!cert}
          style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 13px", borderRadius: 9, fontSize: 12, fontWeight: 500, cursor: cert ? "pointer" : "not-allowed" }}
        >
          <ShieldCheck size={14} />
          Verify offline
        </button>
        <button
          type="button"
          onClick={() => void runVerify(true)}
          className="hydra-button-ghost"
          disabled={!cert}
          style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 13px", borderRadius: 9, fontSize: 12, cursor: cert ? "pointer" : "not-allowed" }}
        >
          <ShieldX size={14} />
          Simulate tamper
        </button>
      </div>

      {result && (
        <div
          role="status"
          style={{
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
            padding: "12px 14px",
            borderRadius: 10,
            border: `1px solid ${result.valid ? "rgba(234,240,250,0.22)" : "rgba(255,255,255,0.3)"}`,
            background: "rgba(255,255,255,0.025)",
          }}
        >
          <Icon size={18} color={tone} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontFamily: MONO, fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", color: tone }}>
              {result.valid ? "VERIFIED" : "TAMPERED"}
              {tampered && result.valid === false ? " (simulated)" : ""}
            </div>
            <div style={{ fontSize: 11.5, lineHeight: 1.6, color: C.muted, marginTop: 5 }}>
              {result.reason}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ k, v, hot, mono, small }: { k: string; v: string; hot?: boolean; mono?: boolean; small?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 14 }}>
      <span style={{ fontFamily: MONO, fontSize: 10, color: C.faint }}>{k}</span>
      <span
        style={{
          fontFamily: mono ? MONO : "inherit",
          fontSize: small ? 9.5 : mono ? 11 : 12,
          color: hot ? C.ink : C.silver,
          textAlign: "right",
          wordBreak: small ? "break-all" : "normal",
          maxWidth: small ? 260 : 320,
        }}
      >
        {v}
      </span>
    </div>
  );
}
