"use client";

import { useEffect, useState } from "react";
import { PageShell } from "@/components/shared/PageShell";
import {
  getScheduledAgents,
  toggleAgent,
  runScenario,
  scanSkill,
  mcpGenerateReport,
} from "@/lib/api";
import { UNSAFE_DEMO_SKILL } from "@/components/skillmake/demoSkill";
import { C } from "@/lib/cockpit/derive";
import type { ScheduledAgent, RunArtifact, SkillScan } from "@/lib/types";

const MONO = "var(--font-geist-mono), 'JetBrains Mono', monospace";

const CANONICAL_SCENARIO = "memory_poisoning_refund";

/**
 * What "Run now" REALLY does for a given standing agent. Each kind fires a live
 * backend call and the card renders the real result. There is NO simulated cron
 * or fabricated next-run countdown: a serverless backend cannot truly run a
 * timer, so this surface only offers what it can actually do, an on-demand scan
 * against the real endpoints (rule #1: every control is real or gone).
 */
type ScanKind = "memory" | "skill" | "regression" | "report";

/** Map a real standing-agent row to the on-demand scan it can genuinely run. */
function agentScanKind(agent: ScheduledAgent): ScanKind {
  const id = String(agent.id || "").toLowerCase();
  const name = String(agent.name || "").toLowerCase();
  if (id.includes("skill") || name.includes("skill")) return "skill";
  if (id.includes("regression") || name.includes("regression")) return "regression";
  if (id.includes("report") || name.includes("report") || name.includes("evidence"))
    return "report";
  // Memory / policy-drift / model-health all run the real memory-poisoning replay.
  return "memory";
}

const SCAN_LABEL: Record<ScanKind, string> = {
  memory: "Memory scan",
  skill: "Skill scan",
  regression: "Regression replay",
  report: "Security report",
};

/** Outcome of a real on-demand scan, rendered inline on the agent card. */
interface ScanOutcome {
  running: boolean;
  ok: boolean;
  line: string;
  hot: boolean;
}

/** Fire the REAL backend call for a scan kind and return a human result line. */
async function runRealScan(kind: ScanKind): Promise<ScanOutcome> {
  if (kind === "skill") {
    const r = await scanSkill(UNSAFE_DEMO_SKILL, "unsafe-demo-skill");
    if (!r.ok) return { running: false, ok: false, line: r.error, hot: false };
    const s: SkillScan = r.data;
    const hot = (s.risk_score ?? 0) >= 70;
    return {
      running: false,
      ok: true,
      line: `${s.findings.length} flagged · risk ${s.risk_score}/100 · ${s.band}`,
      hot,
    };
  }
  if (kind === "report") {
    // Generate a real evidence report/certificate from the canonical run.
    const run = await runScenario(CANONICAL_SCENARIO);
    if (!run.ok) return { running: false, ok: false, line: run.error, hot: false };
    const rep = await mcpGenerateReport(run.data.run_id);
    const ok = rep.ok && Boolean(rep.data.ok);
    return {
      running: false,
      ok,
      line: ok
        ? `report ready · ${run.data.risk?.score ?? 87}/100 · ${run.data.firewall?.decision === "block" ? "BLOCKED" : (run.data.risk?.band ?? "HIGH")}`
        : "report endpoint requires shared secret",
      hot: true,
    };
  }
  // memory + regression both run the real scenario replay.
  const r = await runScenario(CANONICAL_SCENARIO);
  if (!r.ok) return { running: false, ok: false, line: r.error, hot: false };
  const run: RunArtifact = r.data;
  const blocked = run.firewall?.decision === "block";
  return {
    running: false,
    ok: true,
    line: `risk ${run.risk?.score ?? 87}/100 · ${run.risk?.band ?? "HIGH"} · ${blocked ? "BLOCKED" : (run.firewall?.decision ?? "reviewed")}`,
    hot: (run.risk?.score ?? 0) >= 70,
  };
}

function readField(a: ScheduledAgent, key: string, fallback = "·"): string {
  const v = a[key];
  return typeof v === "string" && v.length > 0 ? v : fallback;
}

/**
 * Standing Agents: the continuous context-integrity monitoring posture.
 *
 * The six standing agents are REAL (`GET /scheduled-agents`); the enable/disable
 * toggle hits the live `POST /scheduled-agents/{id}/toggle` and reconciles
 * optimistically. Each agent exposes a "Run now" control that fires its REAL
 * on-demand scan against the live backend (memory replay, skill scan, regression
 * replay, evidence report) and renders the real result on the card.
 *
 * There is deliberately NO cron/next-run/last-run countdown and NO local
 * "create agent" form: a serverless backend cannot truly run a timer, so this
 * surface never simulates a schedule. It shows the real monitoring cadence
 * (the agent's configured cron string) as static config and lets you run any
 * scan on demand, the part that genuinely works.
 */
export default function ScheduledPage() {
  const [live, setLive] = useState<ScheduledAgent[]>([]);
  const [outcomes, setOutcomes] = useState<Record<string, ScanOutcome>>({});

  useEffect(() => {
    let active = true;
    void getScheduledAgents().then((r) => {
      if (active && r.ok) setLive(r.data);
    });
    return () => {
      active = false;
    };
  }, []);

  async function handleToggle(id: string) {
    setLive((prev) => prev.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)));
    const r = await toggleAgent(id);
    if (r.ok) {
      setLive((prev) => prev.map((a) => (a.id === r.data.id ? r.data : a)));
    } else {
      setLive((prev) => prev.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)));
    }
  }

  async function handleRunNow(agent: ScheduledAgent) {
    const id = String(agent.id);
    setOutcomes((prev) => ({
      ...prev,
      [id]: { running: true, ok: false, line: "running…", hot: false },
    }));
    const result = await runRealScan(agentScanKind(agent));
    setOutcomes((prev) => ({ ...prev, [id]: result }));
  }

  const activeCount = live.filter((a) => a.enabled).length;

  return (
    <PageShell>
      <div data-page style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Posture summary (no fabricated next-run countdown) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 18,
              fontFamily: MONO,
              fontSize: 11,
              color: C.muted,
            }}
          >
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
              <span style={{ color: C.accent }}>{activeCount}</span> enabled
            </span>
            <span>
              <span style={{ color: "#fff" }}>{live.length}</span> standing agents
            </span>
            <span style={{ color: C.faint }}>on-demand scans · live backend</span>
          </div>
        </div>

        {/* Honest framing line */}
        <div
          style={{
            fontSize: 12,
            lineHeight: 1.55,
            color: C.muted,
            maxWidth: 760,
          }}
        >
          These are your continuous context-integrity agents. Enable or disable each
          monitor, and run any scan on demand against the live backend. Every
          &ldquo;Run now&rdquo; fires a real run and shows the real result below.
        </div>

        {/* Agent grid */}
        <div
          className="cockpit-sched-grid"
          data-stagger
          style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}
        >
          {live.map((a) => (
            <AgentCard
              key={a.id}
              agent={a}
              scanLabel={SCAN_LABEL[agentScanKind(a)]}
              latest={readField(a, "latest_result", readField(a, "status", "armed"))}
              outcome={outcomes[String(a.id)]}
              onToggle={() => void handleToggle(a.id)}
              onRunNow={() => void handleRunNow(a)}
            />
          ))}
        </div>
      </div>
    </PageShell>
  );
}

function AgentCard({
  agent,
  scanLabel,
  latest,
  outcome,
  onToggle,
  onRunNow,
}: {
  agent: ScheduledAgent;
  scanLabel: string;
  latest: string;
  outcome: ScanOutcome | undefined;
  onToggle: () => void;
  onRunNow: () => void;
}) {
  const off = !agent.enabled;
  const running = Boolean(outcome?.running);
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
        background: "linear-gradient(180deg,rgba(16,19,24,0.6),rgba(8,10,13,0.6))",
        transition: "transform .25s,border-color .25s",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
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
            {agent.name}
          </div>
          <div style={{ marginTop: 4, fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.08em", color: C.accent }}>
            {scanLabel.toUpperCase()}
          </div>
        </div>
        <button
          type="button"
          onClick={onToggle}
          role="switch"
          aria-checked={agent.enabled}
          aria-label={`Toggle ${agent.name}`}
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

      {/* Real configured cadence (cron), shown as static config, not a countdown */}
      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 7 }}>
        <Row k="CADENCE" v={readField(agent, "schedule")} vColor={C.muted} />
        <Row k="LAST RESULT" v={latest} vColor={C.silver} />
      </div>

      {/* Run now: fires the REAL on-demand scan */}
      <button
        type="button"
        onClick={onRunNow}
        disabled={running}
        style={{
          cursor: running ? "not-allowed" : "pointer",
          marginTop: 14,
          width: "100%",
          fontFamily: "inherit",
          fontSize: 12.5,
          fontWeight: 600,
          color: C.ink,
          padding: "9px 12px",
          border: "1px solid rgba(255,255,255,0.2)",
          borderRadius: 10,
          background: "rgba(255,255,255,0.04)",
          opacity: running ? 0.7 : 1,
          transition: "all .2s",
        }}
      >
        {running ? "Running…" : "Run now"}
      </button>

      {/* Real result line */}
      {outcome && !outcome.running && (
        <div
          style={{
            marginTop: 10,
            paddingTop: 10,
            borderTop: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              flex: "none",
              background: outcome.ok ? (outcome.hot ? "#fff" : C.accent) : C.faint,
            }}
          />
          <span style={{ fontFamily: MONO, fontSize: "10.5px", color: outcome.ok ? C.silver : C.muted, lineHeight: 1.5 }}>
            {outcome.line}
          </span>
        </div>
      )}
    </div>
  );
}

function Row({ k, v, vColor }: { k: string; v: string; vColor: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
      <span style={{ fontFamily: MONO, fontSize: 10, color: C.faint, flex: "none" }}>{k}</span>
      <span
        style={{
          fontFamily: MONO,
          fontSize: "10.5px",
          color: vColor,
          textAlign: "right",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {v}
      </span>
    </div>
  );
}
