"use client";

/**
 * Console incident dashboard (Phase 3). When signed in, GET /incidents (Bearer)
 * shows the USER's own real persisted incidents. When signed out, it shows the
 * DEMO tenant's real rows with an honest "sign in to see your own" prompt — never
 * fabricated data. A brand-new user with zero incidents gets a real empty state
 * ("run an attack or connect your agent"), not fake rows.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { KeyRound, Activity, RefreshCw } from "lucide-react";
import { ConsoleShell } from "@/components/auth/ConsoleShell";
import { useAuth } from "@/components/auth/AuthProvider";
import { listIncidents } from "@/lib/consoleApi";
import { computeAnalytics } from "@/lib/incidentAnalytics";
import { AnalyticsBar } from "@/components/console/AnalyticsBar";
import { IncidentFeed } from "@/components/console/IncidentFeed";
import type { Incident } from "@/lib/consoleTypes";
import { C } from "@/lib/cockpit/derive";

const MONO = "var(--font-geist-mono), 'JetBrains Mono', monospace";

function DashboardBody() {
  const { ready, token, user } = useAuth();
  const [incidents, setIncidents] = useState<Incident[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // token present -> the user's own tenant; absent -> the demo tenant (real rows).
  // Apply a settled result: setState only inside the .then callback, never
  // synchronously in the effect body (satisfies react-hooks/set-state-in-effect).
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
    if (!ready) return;
    let active = true;
    void listIncidents(token ?? undefined).then((r) => {
      if (active) apply(r);
    });
    return () => {
      active = false;
    };
  }, [ready, token, apply]);

  // Manual refresh from the button (an event handler may set state synchronously).
  function refresh() {
    setLoading(true);
    void listIncidents(token ?? undefined).then(apply);
  }

  const analytics = computeAnalytics(incidents ?? []);
  const isSignedIn = Boolean(user);

  return (
    <div data-page>
      {/* Provenance banner: honest about whose data this is. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 16,
          padding: "11px 14px",
          borderRadius: 12,
          border: `1px solid ${isSignedIn ? "rgba(234,240,250,0.18)" : "rgba(255,255,255,0.1)"}`,
          background: "rgba(255,255,255,0.018)",
        }}
      >
        <div style={{ fontFamily: MONO, fontSize: 11, color: C.muted, lineHeight: 1.6 }}>
          {isSignedIn ? (
            <>
              Showing <span style={{ color: C.ink }}>your tenant&apos;s</span> real persisted incidents.
            </>
          ) : (
            <>
              Showing the <span style={{ color: C.ink }}>demo tenant&apos;s</span> real incidents.{" "}
              <Link href="/console/keys" style={{ color: C.accent, textDecoration: "underline" }}>
                Sign in
              </Link>{" "}
              to see your own.
            </>
          )}
        </div>
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
      </div>

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
        <EmptyDashboard isSignedIn={isSignedIn} />
      ) : (
        <>
          <AnalyticsBar analytics={analytics} />
          <IncidentFeed incidents={incidents} />
        </>
      )}
    </div>
  );
}

function EmptyDashboard({ isSignedIn }: { isSignedIn: boolean }) {
  return (
    <div className="cockpit-card" style={{ padding: 36, textAlign: "center", maxWidth: 540, margin: "12px auto" }}>
      <div style={{ display: "grid", placeItems: "center", width: 48, height: 48, margin: "0 auto 14px", borderRadius: 14, border: "1px solid rgba(234,240,250,0.18)", background: "rgba(234,240,250,0.04)" }}>
        <Activity size={22} color={C.accent} strokeWidth={1.7} />
      </div>
      <h2 className="cockpit-display" style={{ fontSize: 19, fontWeight: 600, color: C.ink, marginBottom: 8 }}>
        {isSignedIn ? "No incidents yet" : "This tenant has no incidents"}
      </h2>
      <p style={{ fontSize: 13, lineHeight: 1.65, color: C.muted, maxWidth: 380, margin: "0 auto 18px" }}>
        {isSignedIn
          ? "Connect your agent or run a live attack. Every risky memory your agent retrieves shows up here as a real, certified incident."
          : "Run the live attack demo to seed a real incident, or sign in to start your own tenant."}
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
