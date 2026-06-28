"use client";

import { useEffect, useState } from "react";
import { PageShell } from "@/components/shared/PageShell";
import { getStandardsAsi, getStandardsAsi06 } from "@/lib/api";
import { C } from "@/lib/cockpit/derive";
import type {
  Asi06Control,
  Asi06Mapping,
  AsiCoverage,
  AsiMapping,
  AsiRisk,
} from "@/lib/types";

const MONO = "var(--font-geist-mono), 'JetBrains Mono', monospace";

/**
 * OWASP Agentic Security Initiative (ASI) compliance surface.
 *
 * This page makes the self-verified standards artifacts VISIBLE in the live
 * product. It leads with the full ASI Top-10 coverage map (GET /standards/asi):
 * each risk is honestly marked covered / partial / out-of-scope, covered rows
 * name the real implementing module + symbol, and the backend recomputes
 * verification against its own running codebase. Below it, the headline ASI06
 * (Memory Poisoning) control mapping is shown in full depth.
 *
 * Honesty: when no backend is reachable, the offline fixtures return
 * verified_all = null and per-row verified = false for covered/partial rows.
 * The page renders that as an explicit "verification offline" banner instead of
 * a fake green tick. A reachable backend returns the truly recomputed result,
 * including the check that out-of-scope risks carry no borrowed evidence.
 */
type LoadState = "loading" | "ready" | "error";

const COVERAGE_LABEL: Record<AsiCoverage, string> = {
  covered: "COVERED",
  partial: "PARTIAL",
  out_of_scope: "OUT OF SCOPE",
};

export default function StandardsPage() {
  const [asi, setAsi] = useState<AsiMapping | null>(null);
  const [asi06, setAsi06] = useState<Asi06Mapping | null>(null);
  const [state, setState] = useState<LoadState>("loading");

  useEffect(() => {
    let active = true;
    void Promise.all([getStandardsAsi(), getStandardsAsi06()]).then(
      ([topTen, headline]) => {
        if (!active) return;
        if (topTen.ok) setAsi(topTen.data);
        if (headline.ok) setAsi06(headline.data);
        setState(topTen.ok || headline.ok ? "ready" : "error");
      },
    );
    return () => {
      active = false;
    };
  }, []);

  return (
    <PageShell>
      <div data-page data-stagger style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <TopTenHeader mapping={asi} state={state} />
        {state === "loading" && <Notice text="Loading the OWASP ASI coverage map…" />}
        {state === "error" && (
          <Notice text="Could not load the ASI coverage map. It is served at GET /standards/asi and GET /standards/asi06." />
        )}
        {state === "ready" && asi && <TopTenGrid mapping={asi} />}
        {state === "ready" && asi06 && <Asi06Section mapping={asi06} />}
      </div>
    </PageShell>
  );
}

function coverageColor(coverage: AsiCoverage, verified: boolean): string {
  if (coverage === "out_of_scope") return C.faint;
  if (coverage === "partial") return verified ? C.silver : C.muted;
  return verified ? C.accent : C.muted;
}

function TopTenHeader({ mapping, state }: { mapping: AsiMapping | null; state: LoadState }) {
  const verifiedAll = mapping?.verified_all ?? null;
  const counts = mapping?.coverage_counts;
  const tone =
    verifiedAll === true ? "verified" : verifiedAll === false ? "failed" : "unproven";
  const pillText =
    tone === "verified"
      ? "SELF-VERIFIED"
      : tone === "failed"
        ? "UNVERIFIED"
        : "VERIFICATION OFFLINE";
  const pillCol = tone === "verified" ? C.accent : tone === "failed" ? C.muted : C.faint;
  const dot = tone === "verified" ? C.accent : C.faint;

  return (
    <div
      style={{
        padding: 20,
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16,
        background: "rgba(255,255,255,0.012)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: dot, boxShadow: `0 0 8px ${dot}` }} />
          <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.14em", color: C.faint }}>
            {mapping?.taxonomy ?? "OWASP Agentic Security Initiative (ASI)"}
          </span>
        </div>
        <span
          style={{
            fontFamily: MONO,
            fontSize: "9.5px",
            letterSpacing: "0.1em",
            color: pillCol,
            border: `1px solid ${tone === "verified" ? "rgba(234,240,250,0.3)" : "rgba(255,255,255,0.12)"}`,
            borderRadius: 999,
            padding: "3px 9px",
            whiteSpace: "nowrap",
          }}
        >
          {state === "loading" ? "…" : pillText}
        </span>
      </div>
      <h1 style={{ margin: "14px 0 6px", fontSize: 22, fontWeight: 600, color: C.accent, letterSpacing: "-0.01em" }}>
        OWASP ASI Top-10 · Coverage Map
      </h1>
      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: C.muted, maxWidth: 780 }}>
        HydraSentry is built for the Agentic Security Initiative threat taxonomy. This map states, honestly,
        which of the ten risks it covers, partially addresses, or leaves out of scope. Every covered control
        names a real implementing module and symbol; the backend recomputes verification against its own running
        codebase, and out-of-scope risks carry no borrowed evidence. The headline risk, ASI06 (Memory Poisoning),
        is detailed in full below.
      </p>
      {counts && (
        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          <CountChip label="Covered" n={counts.covered} col={C.accent} />
          <CountChip label="Partial" n={counts.partial} col={C.silver} />
          <CountChip label="Out of scope" n={counts.out_of_scope} col={C.faint} />
        </div>
      )}
      {verifiedAll === null && state === "ready" && (
        <div
          style={{
            marginTop: 14,
            padding: "10px 13px",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 10,
            background: "rgba(255,255,255,0.02)",
            fontFamily: MONO,
            fontSize: 11,
            lineHeight: 1.6,
            color: C.faint,
          }}
        >
          No backend reachable, so covered/partial controls cannot be re-verified from the browser. These are the
          coverage claims as documented. Connect a backend (GET /standards/asi) to fetch the self-verified map,
          where verified_all is recomputed against the running code.
        </div>
      )}
      {mapping?.reference && (
        <div style={{ marginTop: 12 }}>
          <a
            href={mapping.reference}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontFamily: MONO, fontSize: 11, color: C.silver, textDecoration: "none" }}
          >
            OWASP ASI reference ↗
          </a>
        </div>
      )}
    </div>
  );
}

function CountChip({ label, n, col }: { label: string; n: number; col: string }) {
  return (
    <span
      style={{
        fontFamily: MONO,
        fontSize: 10,
        letterSpacing: "0.06em",
        color: col,
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 999,
        padding: "4px 10px",
      }}
    >
      {n} {label}
    </span>
  );
}

function TopTenGrid({ mapping }: { mapping: AsiMapping }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }} className="cockpit-2col">
      {mapping.risks.map((risk) => (
        <RiskCard key={risk.id} risk={risk} />
      ))}
    </div>
  );
}

function RiskCard({ risk }: { risk: AsiRisk }) {
  const isScope = risk.coverage !== "out_of_scope";
  const col = coverageColor(risk.coverage, risk.verified);
  const dot = risk.verified && isScope ? C.accent : C.faint;

  return (
    <div
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-3px)";
        e.currentTarget.style.borderColor = "rgba(234,240,250,0.24)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
      }}
      style={{
        padding: 16,
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 14,
        background: "rgba(255,255,255,0.012)",
        opacity: isScope ? 1 : 0.72,
        transition: "transform .25s cubic-bezier(.22,.61,.36,1),border-color .25s,opacity .25s",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot, boxShadow: `0 0 8px ${dot}` }} />
          <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", color: C.faint }}>{risk.id}</span>
        </div>
        <span
          style={{
            fontFamily: MONO,
            fontSize: "8.5px",
            letterSpacing: "0.1em",
            color: col,
            border: `1px solid ${risk.coverage === "covered" && risk.verified ? "rgba(234,240,250,0.3)" : "rgba(255,255,255,0.12)"}`,
            borderRadius: 999,
            padding: "3px 8px",
            whiteSpace: "nowrap",
          }}
        >
          {COVERAGE_LABEL[risk.coverage]}
        </span>
      </div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: C.silver, lineHeight: 1.35 }}>{risk.name}</div>
      <p style={{ margin: 0, fontSize: 12, lineHeight: 1.55, color: C.muted }}>{risk.summary}</p>
      {isScope && risk.evidence_file ? (
        <div
          style={{
            marginTop: 2,
            paddingTop: 10,
            borderTop: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <KV k="EVIDENCE" v={risk.evidence_file} />
          {risk.evidence_symbol && <KV k="SYMBOL" v={risk.evidence_symbol} mono />}
          <KV
            k="CODE PRESENT"
            v={risk.file_exists ? (risk.symbol_present ? "file + symbol" : "file only") : "not checked"}
            vColor={risk.file_exists && risk.symbol_present ? C.silver : C.faint}
          />
        </div>
      ) : (
        <div
          style={{
            marginTop: 2,
            paddingTop: 10,
            borderTop: "1px solid rgba(255,255,255,0.06)",
            fontFamily: MONO,
            fontSize: 10,
            color: C.faint,
            letterSpacing: "0.04em",
          }}
        >
          No evidence claimed — honestly out of scope.
        </div>
      )}
    </div>
  );
}

function Asi06Section({ mapping }: { mapping: Asi06Mapping }) {
  const verifiedCount = mapping.controls.filter((c) => c.verified).length;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 6 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: C.accent, letterSpacing: "-0.01em" }}>
          {mapping.risk_id} · {mapping.risk_name} — control detail
        </h2>
        <span style={{ fontFamily: MONO, fontSize: 10.5, color: C.faint, letterSpacing: "0.08em" }}>
          {mapping.verified_all === null
            ? "verification offline"
            : `${verifiedCount}/${mapping.control_count} controls verified`}
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14 }} className="cockpit-2col">
        {mapping.controls.map((control) => (
          <ControlCard key={control.id} control={control} />
        ))}
      </div>
    </div>
  );
}

function ControlCard({ control }: { control: Asi06Control }) {
  const verified = control.verified;
  const dot = verified ? C.accent : C.faint;
  const badge = verified ? "VERIFIED" : control.file_exists ? "SYMBOL MISSING" : "UNPROVEN";
  const badgeCol = verified ? C.accent : C.muted;

  return (
    <div
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-3px)";
        e.currentTarget.style.borderColor = "rgba(234,240,250,0.28)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
      }}
      style={{
        padding: 18,
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16,
        background: "rgba(255,255,255,0.012)",
        transition: "transform .25s cubic-bezier(.22,.61,.36,1),border-color .25s",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot, boxShadow: `0 0 8px ${dot}` }} />
          <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", color: C.faint }}>
            {control.id}
          </span>
        </div>
        <span
          style={{
            fontFamily: MONO,
            fontSize: "9px",
            letterSpacing: "0.1em",
            color: badgeCol,
            border: `1px solid ${verified ? "rgba(234,240,250,0.3)" : "rgba(255,255,255,0.12)"}`,
            borderRadius: 999,
            padding: "3px 8px",
            whiteSpace: "nowrap",
          }}
        >
          {badge}
        </span>
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.silver, lineHeight: 1.35 }}>{control.title}</div>
      <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, color: C.muted }}>{control.summary}</p>
      <div
        style={{
          marginTop: 2,
          paddingTop: 12,
          borderTop: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          flexDirection: "column",
          gap: 7,
        }}
      >
        <KV k="EVIDENCE FILE" v={control.evidence_file} />
        <KV k="EVIDENCE SYMBOL" v={control.evidence_symbol} mono />
        <KV
          k="CODE PRESENT"
          v={control.file_exists ? (control.symbol_present ? "file + symbol" : "file only") : "not checked"}
          vColor={control.file_exists && control.symbol_present ? C.silver : C.faint}
        />
      </div>
    </div>
  );
}

function KV({
  k,
  v,
  vColor,
  mono,
}: {
  k: string;
  v: string;
  vColor?: string;
  mono?: boolean;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <span style={{ fontFamily: MONO, fontSize: 9.5, color: C.faint, letterSpacing: "0.06em" }}>{k}</span>
      <span
        style={{
          fontFamily: mono ? MONO : "inherit",
          fontSize: "10.5px",
          color: vColor ?? C.silver,
          textAlign: "right",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: 220,
        }}
      >
        {v}
      </span>
    </div>
  );
}

function Notice({ text }: { text: string }) {
  return (
    <div
      style={{
        fontFamily: MONO,
        fontSize: 12,
        color: C.muted,
        padding: 16,
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 12,
        background: "rgba(255,255,255,0.01)",
      }}
    >
      {text}
    </div>
  );
}
