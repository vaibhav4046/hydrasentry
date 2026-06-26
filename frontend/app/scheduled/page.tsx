"use client";

import { useEffect, useState } from "react";
import { PageShell } from "@/components/shared/PageShell";
import { getScheduledAgents, toggleAgent } from "@/lib/api";
import { C } from "@/lib/cockpit/derive";
import type { ScheduledAgent } from "@/lib/types";

const MONO = "var(--font-geist-mono), 'JetBrains Mono', monospace";

/** A row in the grid (live agent or a locally-created custom agent). */
interface AgentRow {
  id: string;
  name: string;
  schedule: string;
  last: string;
  next: string;
  result: string;
  enabled: boolean;
  custom: boolean;
}

function readField(a: ScheduledAgent, key: string, fallback = "·"): string {
  const v = a[key];
  return typeof v === "string" && v.length > 0 ? v : fallback;
}

/**
 * Scheduled Agents, ported 1:1 from the Castellan source. A posture summary
 * row (active/total/next + Create agent), a slide-in create form (with the scan
 * sweep), and a three-column grid of agent cards (name + CUSTOM badge, on/off
 * toggle, schedule, LAST/NEXT, result + status dot). The six standing agents are
 * REAL (/scheduled-agents); toggling hits the live toggle endpoint and reconciles
 * optimistically. Scheduling is simulated server-side, so a newly created agent
 * is added locally (no fabricated cron), matching the guardrail.
 */
export default function ScheduledPage() {
  const [live, setLive] = useState<ScheduledAgent[]>([]);
  const [custom, setCustom] = useState<AgentRow[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [sched, setSched] = useState("Nightly 23:00");
  const [type, setType] = useState("Memory scan");

  useEffect(() => {
    void getScheduledAgents().then((r) => {
      if (r.ok) setLive(r.data);
    });
  }, []);

  async function handleToggle(id: string) {
    // Custom rows toggle locally; live rows reconcile with the backend.
    if (custom.some((c) => c.id === id)) {
      setCustom((prev) => prev.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c)));
      return;
    }
    setLive((prev) => prev.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)));
    const r = await toggleAgent(id);
    if (r.ok) {
      setLive((prev) => prev.map((a) => (a.id === r.data.id ? r.data : a)));
    } else {
      setLive((prev) => prev.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)));
    }
  }

  function addAgent() {
    const nx: Record<string, string> = {
      Hourly: "top of hour",
      "Every 6 hours": "in 6h",
      "Nightly 23:00": "tonight 23:00",
      "Weekly Mon 09:00": "next Mon 09:00",
      "On incident": "on next incident",
    };
    const row: AgentRow = {
      id: `c-${Date.now()}`,
      name: name.trim() || "Custom Agent",
      schedule: sched,
      last: "never",
      next: nx[sched] ?? "pending",
      result: `${type} · armed`,
      enabled: true,
      custom: true,
    };
    setCustom((prev) => [row, ...prev]);
    setCreating(false);
    setName("");
  }

  const rows: AgentRow[] = [
    ...custom,
    ...live.map((a) => ({
      id: a.id,
      name: a.name,
      schedule: a.schedule,
      last: readField(a, "last_run"),
      next: a.next_run || "·",
      result: readField(a, "latest_result", `${readField(a, "status", "armed")}`),
      enabled: a.enabled,
      custom: false,
    })),
  ];
  const activeCount = rows.filter((r) => r.enabled).length;

  return (
    <PageShell>
      <div data-page style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Posture summary */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18, fontFamily: MONO, fontSize: 11, color: C.muted }}>
            <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: C.accent,
                  boxShadow: `0 0 8px ${C.accent}`,
                  animation: "hsPulseDot 2.4s ease-in-out infinite",
                }}
              />
              <span style={{ color: C.accent }}>{activeCount}</span> active
            </span>
            <span>
              <span style={{ color: "#fff" }}>{rows.length}</span> agents
            </span>
            <span>
              next <span style={{ color: C.silver }}>23:00</span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => setCreating((c) => !c)}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
            style={{
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 13,
              fontWeight: 600,
              color: "#0A0A0A",
              padding: "10px 18px",
              border: "none",
              borderRadius: 11,
              background: "linear-gradient(180deg,#FFFFFF,#CDD3DC)",
              boxShadow: "0 8px 22px -10px rgba(220,228,240,0.55)",
              transition: "transform .2s",
            }}
          >
            {creating ? "Close" : "+ Create agent"}
          </button>
        </div>

        {/* Create form */}
        {creating && (
          <div
            className="hsEntry"
            style={{
              border: "1px solid rgba(234,240,250,0.2)",
              borderRadius: 16,
              background: "linear-gradient(180deg,rgba(20,24,30,0.8),rgba(6,8,10,0.7))",
              padding: 20,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                height: 2,
                width: "40%",
                background: "linear-gradient(90deg,transparent,rgba(234,240,250,0.7),transparent)",
                animation: "hsScan 2.6s linear infinite",
              }}
            />
            <div style={{ fontFamily: MONO, fontSize: "9.5px", letterSpacing: "0.16em", color: C.accent }}>
              NEW SCHEDULED AGENT
            </div>
            <div
              className="cockpit-sched-form"
              style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr auto", gap: 12, alignItems: "end" }}
            >
              <FormField label="NAME">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Cross-tenant Leak Scan"
                  style={fieldInputStyle}
                />
              </FormField>
              <FormField label="SCHEDULE">
                <select value={sched} onChange={(e) => setSched(e.target.value)} style={{ ...fieldInputStyle, cursor: "pointer" }}>
                  <option>Hourly</option>
                  <option>Every 6 hours</option>
                  <option>Nightly 23:00</option>
                  <option>Weekly Mon 09:00</option>
                  <option>On incident</option>
                </select>
              </FormField>
              <FormField label="TYPE">
                <select value={type} onChange={(e) => setType(e.target.value)} style={{ ...fieldInputStyle, cursor: "pointer" }}>
                  <option>Memory scan</option>
                  <option>Skill scan</option>
                  <option>Policy drift</option>
                  <option>Regression replay</option>
                  <option>Security report</option>
                </select>
              </FormField>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={addAgent}
                  style={{
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#0A0A0A",
                    padding: "10px 16px",
                    border: "none",
                    borderRadius: 10,
                    background: "linear-gradient(180deg,#FFFFFF,#CDD3DC)",
                  }}
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  style={{
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: 13,
                    color: C.muted,
                    padding: "10px 14px",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 10,
                    background: "transparent",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Agent grid */}
        <div className="cockpit-sched-grid" data-stagger style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
          {rows.map((s) => (
            <AgentCard key={s.id} row={s} onToggle={() => void handleToggle(s.id)} />
          ))}
        </div>
      </div>
    </PageShell>
  );
}

const fieldInputStyle: React.CSSProperties = {
  background: "#020304",
  color: "#E6ECF6",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 9,
  padding: "10px 12px",
  fontFamily: "inherit",
  fontSize: 13,
  outline: "none",
};

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.12em", color: C.faint }}>{label}</span>
      {children}
    </label>
  );
}

function AgentCard({ row, onToggle }: { row: AgentRow; onToggle: () => void }) {
  const off = !row.enabled;
  return (
    <div
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-3px)";
        e.currentTarget.style.borderColor = "rgba(234,240,250,0.28)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.borderColor = row.custom ? "rgba(234,240,250,0.18)" : "rgba(255,255,255,0.08)";
      }}
      style={{
        padding: 18,
        border: `1px solid ${row.custom ? "rgba(234,240,250,0.18)" : "rgba(255,255,255,0.08)"}`,
        borderRadius: 16,
        background: "linear-gradient(180deg,rgba(16,19,24,0.6),rgba(8,10,13,0.6))",
        transition: "transform .25s,border-color .25s",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: C.ink,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {row.name}
          </div>
          {row.custom && (
            <span
              style={{
                fontFamily: MONO,
                fontSize: 8,
                letterSpacing: "0.1em",
                color: C.accent,
                border: "1px solid rgba(234,240,250,0.3)",
                borderRadius: 999,
                padding: "1px 6px",
              }}
            >
              CUSTOM
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-label={`Toggle ${row.name}`}
          style={{
            cursor: "pointer",
            flex: "none",
            width: 38,
            height: 22,
            borderRadius: 999,
            border: `1px solid ${off ? "rgba(255,255,255,0.12)" : "rgba(234,240,250,0.4)"}`,
            background: off ? "rgba(255,255,255,0.04)" : "rgba(234,240,250,0.18)",
            position: "relative",
            transition: "all .2s",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 2,
              left: off ? 2 : 18,
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: off ? C.faint : "#fff",
              transition: "all .2s",
            }}
          />
        </button>
      </div>
      <div style={{ marginTop: 6, fontFamily: MONO, fontSize: "10.5px", color: C.muted }}>{row.schedule}</div>
      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 7 }}>
        <Row k="LAST" v={row.last} vColor={C.muted} />
        <Row k="NEXT" v={off ? "paused" : row.next} vColor={C.silver} />
      </div>
      <div
        style={{
          marginTop: 14,
          paddingTop: 12,
          borderTop: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: off ? C.faint : C.accent, transition: "background .2s" }} />
        <span style={{ fontSize: "11.5px", color: C.muted }}>{row.result}</span>
      </div>
    </div>
  );
}

function Row({ k, v, vColor }: { k: string; v: string; vColor: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ fontFamily: MONO, fontSize: 10, color: C.faint }}>{k}</span>
      <span style={{ fontFamily: MONO, fontSize: "10.5px", color: vColor, whiteSpace: "nowrap" }}>{v}</span>
    </div>
  );
}
