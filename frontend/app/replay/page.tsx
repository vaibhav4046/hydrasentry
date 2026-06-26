"use client";

import { useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/shared/PageShell";
import { useRunDemo } from "@/hooks/useRunDemo";
import { getScenarios } from "@/lib/api";
import { deriveCockpit, C } from "@/lib/cockpit/derive";
import type { ScenarioSummary } from "@/lib/types";

const MONO = "var(--font-geist-mono), 'JetBrains Mono', monospace";

const SCENARIO_IDS = [
  "memory_poisoning_refund",
  "indirect_prompt_injection_doc",
  "cross_subtenant_leak",
  "unsafe_skillmake_skill",
  "stale_memory_override",
];

const STAGE_NAMES = [
  "provision",
  "seed_clean",
  "baseline",
  "inject",
  "poisoned",
  "extract_graph",
  "score",
  "firewall",
  "report",
];

/**
 * Replay Lab, ported 1:1 from the Castellan source. Scenario chips, a
 * baseline-vs-poisoned answer comparison, a three-card row (risk gauge ring,
 * attack type + confidence, behavior diff), and the replay stage timeline.
 * Scenario chips come from the REAL /scenarios; the baseline/poisoned text,
 * risk, attack type, confidence, behavior diff and the completed stages are all
 * driven by the live run via deriveCockpit (idle = nominal baseline).
 */
export default function ReplayPage() {
  const { run, isRunning } = useRunDemo();
  const v = useMemo(() => deriveCockpit(run, { isRunning }), [run, isRunning]);
  const p = v.poisoned;
  const [scenario, setScenario] = useState("memory_poisoning_refund");
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);

  // Real scenario list (falls back to the bundled fixture in the API layer).
  useEffect(() => {
    void getScenarios().then((r) => {
      if (r.ok && r.data.length) setScenarios(r.data);
    });
  }, []);

  const scIds = scenarios.length ? scenarios.map((s) => s.id) : SCENARIO_IDS;

  // Completed stages: from the live run's real stage list when present,
  // else the source's "first three done" idle posture.
  const doneCount = run ? run.stages.length : 3;

  return (
    <PageShell>
      <div data-page style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {/* Scenario chips */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {scIds.map((id) => {
            const on = scenario === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setScenario(id)}
                style={{
                  cursor: "pointer",
                  fontFamily: MONO,
                  fontSize: 11,
                  padding: "8px 13px",
                  border: `1px solid ${on ? "rgba(234,240,250,0.24)" : "rgba(255,255,255,0.1)"}`,
                  borderRadius: 999,
                  background: on ? "rgba(234,240,250,0.08)" : "transparent",
                  color: on ? C.accent : C.muted,
                  transition: "all .2s",
                }}
              >
                {id}
              </button>
            );
          })}
        </div>

        {/* Baseline vs poisoned */}
        <div className="cockpit-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div
            style={{
              padding: 20,
              border: "1px solid rgba(255,255,255,0.09)",
              borderRadius: 16,
              background: "rgba(255,255,255,0.016)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em", color: C.faint }}>
                BASELINE · CLEAN CONTEXT
              </span>
              <span
                style={{
                  fontSize: "9.5px",
                  fontFamily: MONO,
                  color: C.silver,
                  border: "1px solid rgba(255,255,255,0.16)",
                  borderRadius: 999,
                  padding: "2px 8px",
                }}
              >
                SAFE
              </span>
            </div>
            <p style={{ marginTop: 14, fontSize: 15, lineHeight: 1.55, color: C.silver }}>
              &ldquo;{v.baselineText}&rdquo;
            </p>
          </div>
          <div
            style={{
              padding: 20,
              border: `1px solid ${v.poisonCardBorder}`,
              borderRadius: 16,
              background: v.poisonCardBg,
              transition: "all .5s",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em", color: C.faint }}>
                POISONED · INJECTED CONTEXT
              </span>
              <span
                style={{
                  fontSize: "9.5px",
                  fontFamily: MONO,
                  color: v.poisonTag,
                  border: `1px solid ${v.poisonCardBorder}`,
                  borderRadius: 999,
                  padding: "2px 8px",
                }}
              >
                {v.poisonState}
              </span>
            </div>
            <p style={{ marginTop: 14, fontSize: 15, lineHeight: 1.55, color: v.poisonTextColor, transition: "color .5s" }}>
              {p ? `“${v.poisonText}”` : v.poisonText}
            </p>
          </div>
        </div>

        {/* Three-card row */}
        <div className="cockpit-3col" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
          {/* Risk gauge ring */}
          <div
            style={{
              padding: 18,
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 14,
              background: "rgba(255,255,255,0.012)",
              display: "flex",
              alignItems: "center",
              gap: 16,
            }}
          >
            <div style={{ position: "relative", width: 64, height: 64, flex: "none" }}>
              <svg width="64" height="64" viewBox="0 0 64 64" style={{ transform: "rotate(-90deg)" }}>
                <circle cx="32" cy="32" r="27" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
                <circle
                  cx="32"
                  cy="32"
                  r="27"
                  fill="none"
                  stroke={v.chipColor}
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray="170"
                  strokeDashoffset={v.gaugeDash}
                  style={{ transition: "stroke-dashoffset .25s linear,stroke .5s" }}
                />
              </svg>
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "grid",
                  placeItems: "center",
                  fontFamily: MONO,
                  fontSize: 17,
                  fontWeight: 600,
                  color: v.chipColor,
                }}
              >
                {v.risk}
              </div>
            </div>
            <div>
              <div style={{ fontFamily: MONO, fontSize: "9.5px", letterSpacing: "0.14em", color: C.faint }}>
                RISK / 100
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, marginTop: 3, color: C.ink }}>{v.riskState}</div>
            </div>
          </div>

          {/* Attack type */}
          <div
            style={{
              padding: 18,
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 14,
              background: "rgba(255,255,255,0.012)",
            }}
          >
            <div style={{ fontFamily: MONO, fontSize: "9.5px", letterSpacing: "0.14em", color: C.faint }}>
              ATTACK TYPE
            </div>
            <div style={{ fontFamily: MONO, fontSize: 14, color: C.silver, marginTop: 8 }}>{v.attackType}</div>
            <div style={{ marginTop: 8, fontSize: 12, color: C.muted }}>Confidence {v.conf}</div>
          </div>

          {/* Behavior diff */}
          <div
            style={{
              padding: 18,
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 14,
              background: "rgba(255,255,255,0.012)",
            }}
          >
            <div style={{ fontFamily: MONO, fontSize: "9.5px", letterSpacing: "0.14em", color: C.faint }}>
              BEHAVIOR DIFF
            </div>
            <div style={{ marginTop: 8, fontSize: "12.5px", lineHeight: 1.5, color: C.muted }}>
              {v.behaviorDiff}
            </div>
          </div>
        </div>

        {/* Replay stage timeline */}
        <div
          style={{
            padding: "18px 20px",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 14,
            background: "rgba(255,255,255,0.012)",
          }}
        >
          <div style={{ fontFamily: MONO, fontSize: "9.5px", letterSpacing: "0.14em", color: C.faint, marginBottom: 14 }}>
            REPLAY STAGE TIMELINE
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {STAGE_NAMES.map((name, i) => {
              const done = p || i < doneCount;
              return (
                <span key={name} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      fontFamily: MONO,
                      fontSize: "10.5px",
                      padding: "6px 11px",
                      border: `1px solid ${done ? "rgba(234,240,250,0.2)" : "rgba(255,255,255,0.08)"}`,
                      borderRadius: 8,
                      background: done ? "rgba(234,240,250,0.06)" : "transparent",
                      color: done ? C.silver : C.faint,
                    }}
                  >
                    {name}
                  </span>
                  {i < STAGE_NAMES.length - 1 && <span style={{ color: "#3a4250" }}>›</span>}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
