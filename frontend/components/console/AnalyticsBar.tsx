"use client";

/**
 * Analytics strip over the REAL incident list: total, blocked, criticals, avg
 * score, top tainted attack types, and a criticals-over-time sparkline. All
 * values are computed from the live data passed in — zero fabricated numbers.
 */
import type { IncidentAnalytics } from "@/lib/incidentAnalytics";
import { C } from "@/lib/cockpit/derive";

const MONO = "var(--font-geist-mono), 'JetBrains Mono', monospace";

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="cockpit-card" style={{ padding: "14px 16px", minWidth: 0 }}>
      <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.14em", color: C.faint }}>
        {label}
      </div>
      <div className="cockpit-display" style={{ fontSize: 26, fontWeight: 600, color: C.ink, marginTop: 4, lineHeight: 1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontFamily: MONO, fontSize: 10, color: C.muted, marginTop: 5 }}>{sub}</div>
      )}
    </div>
  );
}

/** Tiny inline bar sparkline of criticals over time (compositor-friendly). */
function Sparkline({ analytics }: { analytics: IncidentAnalytics }) {
  const days = analytics.perDay;
  const max = Math.max(1, ...days.map((d) => d.count));
  return (
    <div className="cockpit-card" style={{ padding: "14px 16px", gridColumn: "span 2", minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.14em", color: C.faint }}>
          CRITICALS OVER TIME
        </span>
        <span style={{ fontFamily: MONO, fontSize: 10, color: C.muted }}>
          {days.length} day{days.length === 1 ? "" : "s"}
        </span>
      </div>
      {days.length === 0 ? (
        <div style={{ fontFamily: MONO, fontSize: 11, color: C.ghost, marginTop: 14 }}>
          no dated incidents yet
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 46, marginTop: 12 }}>
          {days.map((d) => {
            const h = Math.max(3, Math.round((d.count / max) * 44));
            const critFrac = d.count > 0 ? d.criticals / d.count : 0;
            return (
              <div
                key={d.day}
                title={`${d.day}: ${d.count} incident(s), ${d.criticals} critical`}
                style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}
              >
                <div
                  style={{
                    height: h,
                    borderRadius: "3px 3px 0 0",
                    background: `linear-gradient(180deg, ${C.accent} 0%, rgba(234,240,250,${0.25 + critFrac * 0.5}) 100%)`,
                  }}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AnalyticsBar({ analytics }: { analytics: IncidentAnalytics }) {
  const topAttack = analytics.topAttackTypes[0];
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0,1fr))",
        gap: 12,
        marginBottom: 18,
      }}
      className="console-analytics-grid"
    >
      <Metric label="TOTAL INCIDENTS" value={String(analytics.total)} sub={`avg score ${analytics.avgScore}`} />
      <Metric label="BLOCKED" value={String(analytics.blocked)} sub={analytics.total > 0 ? `${Math.round((analytics.blocked / analytics.total) * 100)}% of total` : "—"} />
      <Metric label="CRITICALS" value={String(analytics.criticals)} sub={topAttack ? `top: ${topAttack.type}` : "—"} />
      <Sparkline analytics={analytics} />
    </div>
  );
}
