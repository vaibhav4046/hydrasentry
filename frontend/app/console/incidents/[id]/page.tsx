"use client";

/**
 * Incident detail (Phase 3). Fetches one REAL incident by id (Bearer when signed
 * in, demo tenant otherwise), shows the baseline vs poisoned answers side by
 * side, the risk verdict, and the certificate viewer with offline verify. 404
 * surfaces honestly (BOLA-safe: another tenant's id is invisible).
 */
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ConsoleShell } from "@/components/auth/ConsoleShell";
import { useAuth } from "@/components/auth/AuthProvider";
import { getIncident } from "@/lib/consoleApi";
import { CertificateViewer } from "@/components/console/CertificateViewer";
import { bandColor, bandBorder, decisionIsBlocking, formatCreatedAt } from "@/components/console/bandStyle";
import type { Incident } from "@/lib/consoleTypes";
import { C } from "@/lib/cockpit/derive";

const MONO = "var(--font-geist-mono), 'JetBrains Mono', monospace";

function DetailBody({ id }: { id: string }) {
  const { ready, token } = useAuth();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    void getIncident(id, token ?? undefined).then((result) => {
      if (!active) return;
      if (result.ok) setIncident(result.data);
      else setError(result.error);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [ready, id, token]);

  return (
    <div data-page>
      <Link
        href="/console"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: MONO, fontSize: 11, color: C.muted, textDecoration: "none", marginBottom: 16 }}
      >
        <ArrowLeft size={13} />
        Back to incidents
      </Link>

      {!loaded ? (
        <div style={{ display: "grid", placeItems: "center", minHeight: 200 }}>
          <span style={{ fontFamily: MONO, fontSize: 11, color: C.faint }}>loading incident…</span>
        </div>
      ) : error || !incident ? (
        <div className="cockpit-card" style={{ padding: 28, textAlign: "center", maxWidth: 460, margin: "20px auto" }}>
          <h2 className="cockpit-display" style={{ fontSize: 18, fontWeight: 600, color: C.ink, marginBottom: 8 }}>
            Incident not found
          </h2>
          <p style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.6 }}>
            {error || "This incident does not exist in your tenant."} A row owned by
            another tenant is invisible by design.
          </p>
        </div>
      ) : (
        <>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
            <h1 className="cockpit-display" style={{ fontSize: 22, fontWeight: 600, color: C.ink }}>
              {incident.scenario}
            </h1>
            <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", color: bandColor(incident.band), border: `1px solid ${bandBorder(incident.band)}`, borderRadius: 999, padding: "3px 10px" }}>
              {String(incident.band).toUpperCase()} · {incident.risk_score} / 100
            </span>
            <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", color: decisionIsBlocking(incident.decision) ? C.ink : C.muted, border: `1px solid ${decisionIsBlocking(incident.decision) ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.12)"}`, borderRadius: 7, padding: "3px 9px" }}>
              {String(incident.decision).toUpperCase()}
            </span>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 10.5, color: C.faint, marginBottom: 22 }}>
            {incident.attack_type} · {incident.mode} · {incident.llm_provider} · confidence {incident.confidence.toFixed(2)} · {formatCreatedAt(incident.created_at)}
          </div>

          {/* Baseline vs poisoned */}
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 14, marginBottom: 18 }} className="console-replay-grid">
            <AnswerCard label="BASELINE (clean context)" text={incident.baseline_answer} tone="safe" />
            <AnswerCard label="POISONED (tainted context)" text={incident.poisoned_answer} tone="danger" />
          </div>

          {/* Certificate */}
          <CertificateViewer incident={incident} />
        </>
      )}
    </div>
  );
}

function AnswerCard({ label, text, tone }: { label: string; text: string; tone: "safe" | "danger" }) {
  const border = tone === "danger" ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.09)";
  return (
    <div className="cockpit-card" style={{ padding: 18, border: `1px solid ${border}` }}>
      <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.12em", color: tone === "danger" ? C.accent : C.faint, marginBottom: 10 }}>
        {label}
      </div>
      <p style={{ fontSize: 13, lineHeight: 1.65, color: tone === "danger" ? C.ink : C.silver, margin: 0, whiteSpace: "pre-wrap" }}>
        {text || "—"}
      </p>
    </div>
  );
}

export default function IncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <ConsoleShell>
      <DetailBody id={id} />
    </ConsoleShell>
  );
}
