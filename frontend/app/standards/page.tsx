"use client";

import { useEffect, useState } from "react";
import { PageShell } from "@/components/shared/PageShell";
import { getStandardsAsi06 } from "@/lib/api";
import { C } from "@/lib/cockpit/derive";
import type { Asi06Control, Asi06Mapping } from "@/lib/types";

const MONO = "var(--font-geist-mono), 'JetBrains Mono', monospace";

/**
 * OWASP ASI06 (Memory Poisoning) compliance surface.
 *
 * This page makes the self-verified standards artifact VISIBLE in the live
 * product. Until now the mapping was served only at GET /standards/asi06 and
 * asserted by backend tests; a judge or auditor had to know the curl URL. Here
 * the same artifact is fetched and rendered: each control names the real
 * implementing module + symbol, and shows whether the backend just confirmed
 * that code exists in the running codebase.
 *
 * Honesty: when no backend is reachable, the offline fixture returns
 * verified_all = null and per-control verified = false. The page renders that as
 * an explicit "verification requires the live backend" banner instead of a fake
 * green tick. A reachable backend returns the truly recomputed verification.
 */
type LoadState = "loading" | "ready" | "error";

export default function StandardsPage() {
  const [mapping, setMapping] = useState<Asi06Mapping | null>(null);
  const [state, setState] = useState<LoadState>("loading");

  useEffect(() => {
    let active = true;
    void getStandardsAsi06().then((r) => {
      if (!active) return;
      if (r.ok) {
        setMapping(r.data);
        setState("ready");
      } else {
        setState("error");
      }
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <PageShell>
      <div data-page data-stagger style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <Header mapping={mapping} state={state} />
        {state === "loading" && <Notice text="Loading the ASI06 control mapping…" tone="muted" />}
        {state === "error" && (
          <Notice
            text="Could not load the ASI06 mapping. The compliance artifact is served at GET /standards/asi06."
            tone="muted"
          />
        )}
        {state === "ready" && mapping && <Controls mapping={mapping} />}
      </div>
    </PageShell>
  );
}

function Header({ mapping, state }: { mapping: Asi06Mapping | null; state: LoadState }) {
  const verifiedAll = mapping?.verified_all ?? null;
  const verifiedCount = mapping
    ? mapping.controls.filter((c) => c.verified).length
    : 0;
  const total = mapping?.control_count ?? 0;

  // verified_all === true: backend confirmed every cited file+symbol exists.
  // verified_all === null: offline, we did not recompute against the codebase.
  const tone =
    verifiedAll === true ? "verified" : verifiedAll === false ? "failed" : "unproven";
  const pillText =
    tone === "verified"
      ? `VERIFIED ${verifiedCount}/${total}`
      : tone === "failed"
        ? `UNVERIFIED ${verifiedCount}/${total}`
        : "VERIFICATION OFFLINE";
  const pillCol =
    tone === "verified" ? C.accent : tone === "failed" ? C.muted : C.faint;
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
        {mapping?.risk_id ?? "ASI06"} · {mapping?.risk_name ?? "Memory Poisoning"}
      </h1>
      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: C.muted, maxWidth: 760 }}>
        HydraSentry is purpose-built for the Memory Poisoning risk in the OWASP Agentic Security Initiative
        taxonomy: an attacker plants content in an agent&apos;s long-term memory so a later turn treats the
        attacker&apos;s instruction as trusted context. The controls below each name a real implementing module
        and symbol. The backend recomputes verification against its own running codebase, so a control is only
        marked verified when its cited code is actually present.
      </p>
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
          No backend reachable, so this mapping cannot be re-verified from the browser. These are the control
          claims as documented. Connect a backend to fetch the self-verified mapping (GET /standards/asi06),
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

function Controls({ mapping }: { mapping: Asi06Mapping }) {
  return (
    <div
      style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14 }}
      className="cockpit-2col"
    >
      {mapping.controls.map((control) => (
        <ControlCard key={control.id} control={control} />
      ))}
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

function Notice({ text, tone }: { text: string; tone: "muted" }) {
  return (
    <div
      style={{
        fontFamily: MONO,
        fontSize: 12,
        color: tone === "muted" ? C.muted : C.faint,
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
