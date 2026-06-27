"use client";

/**
 * Searchable feed of REAL persisted incidents. Each row links to the incident
 * detail. Filters client-side over scenario / attack_type / band / decision.
 * Honest empty state when there are zero incidents.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, ChevronRight } from "lucide-react";
import type { Incident } from "@/lib/consoleTypes";
import { C } from "@/lib/cockpit/derive";
import { bandColor, bandBorder, decisionIsBlocking, formatCreatedAt } from "./bandStyle";

const MONO = "var(--font-geist-mono), 'JetBrains Mono', monospace";

function matches(inc: Incident, q: string): boolean {
  if (!q) return true;
  const hay = `${inc.scenario} ${inc.attack_type} ${inc.band} ${inc.decision} ${inc.mode} ${inc.llm_provider}`.toLowerCase();
  return hay.includes(q.toLowerCase());
}

export function IncidentFeed({ incidents }: { incidents: Incident[] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () => incidents.filter((i) => matches(i, query)),
    [incidents, query],
  );

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
        <h2 className="cockpit-display" style={{ fontSize: 15, fontWeight: 600, color: C.ink }}>
          Incident history
        </h2>
        <div style={{ position: "relative", minWidth: 220 }}>
          <Search size={14} color={C.faint} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search incidents"
            style={{
              width: "100%",
              fontFamily: MONO,
              fontSize: 12,
              color: C.ink,
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 9,
              padding: "8px 10px 8px 30px",
              outline: "none",
            }}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="cockpit-card" style={{ padding: 16, fontFamily: MONO, fontSize: 12, color: C.faint }}>
          {incidents.length === 0
            ? "No incidents in this tenant yet."
            : `No incidents match "${query}".`}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((inc) => {
            const blocking = decisionIsBlocking(inc.decision);
            return (
              <Link
                key={inc.id}
                href={`/console/incidents/${encodeURIComponent(inc.id)}`}
                className="cockpit-card-hover"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 12,
                  alignItems: "center",
                  padding: "13px 16px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.07)",
                  background: "rgba(255,255,255,0.012)",
                  textDecoration: "none",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: C.ink }}>{inc.scenario}</span>
                    <span
                      style={{
                        fontFamily: MONO,
                        fontSize: 9,
                        letterSpacing: "0.1em",
                        color: bandColor(inc.band),
                        border: `1px solid ${bandBorder(inc.band)}`,
                        borderRadius: 999,
                        padding: "2px 8px",
                      }}
                    >
                      {String(inc.band).toUpperCase()} · {inc.risk_score}
                    </span>
                    <span
                      style={{
                        fontFamily: MONO,
                        fontSize: 9,
                        letterSpacing: "0.08em",
                        color: blocking ? C.ink : C.muted,
                        border: `1px solid ${blocking ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.1)"}`,
                        borderRadius: 6,
                        padding: "2px 7px",
                      }}
                    >
                      {String(inc.decision).toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 10.5, color: C.faint, marginTop: 6 }}>
                    {inc.attack_type} · {inc.mode} · {inc.llm_provider} · {formatCreatedAt(inc.created_at)}
                  </div>
                </div>
                <ChevronRight size={16} color={C.faint} />
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
