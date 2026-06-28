"use client";

/**
 * Console incident dashboard (Phase 3). NO LOGIN: GET /incidents (token-less)
 * shows the shared public DEMO tenant's REAL persisted incidents -- never
 * fabricated data. When the demo tenant has no incidents, a real empty state
 * ("run an attack or connect your agent") is shown, not fake rows.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { KeyRound, Activity, RefreshCw } from "lucide-react";
import { ConsoleShell } from "@/components/auth/ConsoleShell";
import { listIncidents } from "@/lib/consoleApi";
import { computeAnalytics } from "@/lib/incidentAnalytics";
import { AnalyticsBar } from "@/components/console/AnalyticsBar";
import { IncidentFeed } from "@/components/console/IncidentFeed";
import { TenantProvenanceBanner } from "@/components/console/TenantProvenanceBanner";
import type { Incident } from "@/lib/consoleTypes";
import { C } from "@/lib/cockpit/derive";

const MONO = "var(--font-geist-mono), 'JetBrains Mono', monospace";

function DashboardBody() {
  const [incidents, setIncidents] = useState<Incident[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Token-less read -> the shared public demo tenant's REAL rows. Apply a settled
  // result: setState only inside the .then callback, never synchronously in the
  // effect body (satisfies react-hooks/set-state-in-effect).
  const apply = useCallback((result: { ok: true; data: Incident[] } | { ok: false; error: string }) => {
    if (result.ok) {
      setIncidents(result.data);
      setError(null);
    } else {
      setError(result.error);
      setIncidents([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    void listIncidents().then((r) => {
      if (active) apply(r);
    });
    return () => {
      active = false;
    };
  }, [apply]);

  // Manual refresh from the button (an event handler may set state synchronously).
  function refresh() {
    setLoading(true);
    void listIncidents().then(apply);
  }

  const analytics = computeAnalytics(incidents ?? []);

  return (
    <div data-page>
      {/* Provenance banner: honest about whose data this is. */}
      <TenantProvenanceBanner
        subject="persisted incidents"
        action={
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="hydra-button-ghost"
            style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11.5, padding: "6px 11px", borderRadius: 8, cursor: loading ? "wait" : "pointer" }}
          >
            <RefreshCw size={13} strokeWidth={1.9} style={loading ? { animation: "spin 1s linear infinite" } : undefined} />
            Refresh
          </button>
        }
      />

      {error && (
        <div
          role="alert"
          className="cockpit-card"
          style={{ padding: 14, marginBottom: 16, fontFamily: MONO, fontSize: 11.5, color: C.silver }}
        >
          Incident store error: {error}. The dashboard fails closed — no fabricated rows are shown.
        </div>
      )}

      {incidents === null ? (
        <div style={{ display: "grid", placeItems: "center", minHeight: 200 }}>
          <span style={{ fontFamily: MONO, fontSize: 11, color: C.faint }}>loading incidents…</span>
        </div>
      ) : incidents.length === 0 && !error ? (
        <EmptyDashboard />
      ) : (
        <>
          <AnalyticsBar analytics={analytics} />
          <IncidentFeed incidents={incidents} />
        </>
      )}
    </div>
  );
}

function EmptyDashboard() {
  return (
    <div className="cockpit-card" style={{ padding: 36, textAlign: "center", maxWidth: 540, margin: "12px auto" }}>
      <div style={{ display: "grid", placeItems: "center", width: 48, height: 48, margin: "0 auto 14px", borderRadius: 14, border: "1px solid rgba(234,240,250,0.18)", background: "rgba(234,240,250,0.04)" }}>
        <Activity size={22} color={C.accent} strokeWidth={1.7} />
      </div>
      <h2 className="cockpit-display" style={{ fontSize: 19, fontWeight: 600, color: C.ink, marginBottom: 8 }}>
        This tenant has no incidents
      </h2>
      <p style={{ fontSize: 13, lineHeight: 1.65, color: C.muted, maxWidth: 380, margin: "0 auto 18px" }}>
        Run the live attack demo to seed a real incident, or connect your agent
        so its risky retrievals show up here as real, certified incidents.
      </p>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
        <Link href="/console/keys" className="hydra-button-primary" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
          <KeyRound size={15} strokeWidth={1.9} />
          Connect your agent
        </Link>
        <Link href="/mission" className="hydra-button-secondary" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 500, textDecoration: "none" }}>
          Run a live attack
        </Link>
      </div>
    </div>
  );
}

export default function ConsolePage() {
  return (
    <ConsoleShell>
      <DashboardBody />
    </ConsoleShell>
  );
}
