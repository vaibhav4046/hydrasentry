"use client";

import { useState } from "react";
import {
  MemoryCortexCanvas,
  cortexVals,
  type CortexState,
} from "./MemoryCortexCanvas";

/**
 * #product section — the Memory Cortex canvas with its frame chrome (header
 * label, live risk chip), the canvas itself, and the control bar
 * (Inject / Block via MCP / Reset + decision + graph tag). Below it sits the
 * replay proof band (baseline vs poisoned cards). Owns the interactive cortex
 * state and animates the risk score with a cubic ease, exactly like the source's
 * _animRisk(). This is the design's own interactive graph — local to the page,
 * distinct from the backend judge-demo wired to the hero/nav CTAs.
 */
function ghov(e: React.MouseEvent<HTMLElement>) {
  e.currentTarget.style.borderColor = "rgba(255,255,255,0.32)";
  e.currentTarget.style.background = "rgba(255,255,255,0.06)";
}
function gunhov(e: React.MouseEvent<HTMLElement>) {
  e.currentTarget.style.borderColor = "rgba(255,255,255,0.16)";
  e.currentTarget.style.background = "rgba(255,255,255,0.03)";
}
function btnLift(e: React.MouseEvent<HTMLElement>) {
  e.currentTarget.style.transform = "translateY(-2px)";
}
function btnDrop(e: React.MouseEvent<HTMLElement>) {
  e.currentTarget.style.transform = "translateY(0)";
}

export function CastellanProduct() {
  const [state, setState] = useState<CortexState>({
    poisoned: false,
    firewall: false,
    risk: 12,
    running: false,
  });
  const [injectedAt, setInjectedAt] = useState<number | null>(null);

  function animRisk(to: number) {
    const from = state.risk;
    const dur = 1000;
    const start = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      setState((s) => ({
        ...s,
        risk: Math.round(from + (to - from) * e),
        running: k < 1,
      }));
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function runAttack() {
    setInjectedAt(performance.now());
    setState((s) => ({ ...s, poisoned: true, firewall: false }));
    animRisk(87);
  }
  function blockFirewall() {
    if (!state.poisoned) return;
    setState((s) => ({ ...s, firewall: true }));
    animRisk(9);
  }
  function reset() {
    setInjectedAt(null);
    setState((s) => ({ ...s, poisoned: false, firewall: false }));
    animRisk(12);
  }

  const v = cortexVals(state);
  const runLabel = state.running
    ? "Routing…"
    : state.poisoned
      ? "Re-run attack"
      : "Inject poisoned memory";
  const blockLabel = state.firewall ? "Firewall active" : "Block via MCP";

  return (
    <>
      {/* MEMORY CORTEX (canvas artifact) */}
      <section id="product" data-reveal style={{ marginTop: "14px", position: "relative" }}>
        <div
          style={{
            position: "relative",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "24px",
            overflow: "hidden",
            background: "#000000",
            boxShadow:
              "0 50px 130px -50px rgba(0,0,0,0.95),inset 0 1px 0 rgba(255,255,255,0.05)",
          }}
        >
          {/* top-left label */}
          <div
            style={{
              position: "absolute",
              top: "15px",
              left: "18px",
              zIndex: 4,
              display: "flex",
              alignItems: "center",
              gap: "9px",
            }}
          >
            <span
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: "#EAF0FA",
                boxShadow: "0 0 10px #EAF0FA",
                animation: "hsPulseDot 2.6s ease-in-out infinite",
              }}
            />
            <span
              className="mono"
              style={{ fontSize: "10.5px", letterSpacing: "0.2em", color: "#9BA3AF" }}
            >
              MEMORY CORTEX · NEURAL GRAPH
            </span>
          </div>

          {/* top-right risk chip */}
          <div
            style={{
              position: "absolute",
              top: "13px",
              right: "14px",
              zIndex: 4,
              display: "flex",
              alignItems: "center",
              gap: "9px",
              padding: "6px 11px",
              border: `1px solid ${v.chipBorder}`,
              borderRadius: "999px",
              background: v.chipBg,
              transition: "border-color .5s,background .5s",
            }}
          >
            <span
              className="mono"
              style={{ fontSize: "16px", fontWeight: 600, color: v.chipColor, transition: "color .5s" }}
            >
              {v.risk}
            </span>
            <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.05 }}>
              <span className="mono" style={{ fontSize: "8px", letterSpacing: "0.16em", color: "#5F6875" }}>
                RISK / 100
              </span>
              <span
                className="mono"
                style={{ fontSize: "9.5px", letterSpacing: "0.08em", color: v.chipColor, transition: "color .5s" }}
              >
                {v.riskState}
              </span>
            </span>
          </div>

          <MemoryCortexCanvas state={state} injectedAt={injectedAt} />

          {/* control bar */}
          <div
            style={{
              position: "relative",
              zIndex: 4,
              display: "flex",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
              padding: "14px 18px",
              borderTop: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(255,255,255,0.012)",
            }}
          >
            <button
              type="button"
              onClick={runAttack}
              style={{
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: "13px",
                fontWeight: 600,
                color: "#0A0A0A",
                padding: "10px 18px",
                border: "none",
                borderRadius: "11px",
                background: "linear-gradient(180deg,#FFFFFF,#CDD3DC)",
                boxShadow: "0 8px 22px -10px rgba(220,228,240,0.55)",
                transition: "transform .2s",
              }}
              onMouseEnter={btnLift}
              onMouseLeave={btnDrop}
            >
              {runLabel}
            </button>
            <button
              type="button"
              onClick={blockFirewall}
              style={{
                cursor: state.poisoned ? "pointer" : "not-allowed",
                opacity: state.poisoned ? 1 : 0.45,
                fontFamily: "inherit",
                fontSize: "12.5px",
                fontWeight: 600,
                color: "#F3F6FB",
                padding: "10px 16px",
                border: "1px solid rgba(255,255,255,0.22)",
                borderRadius: "11px",
                background: "rgba(255,255,255,0.04)",
                transition: "all .2s",
              }}
              onMouseEnter={ghov}
              onMouseLeave={gunhov}
            >
              {blockLabel}
            </button>
            <button
              type="button"
              onClick={reset}
              style={{
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: "12.5px",
                color: "#9BA3AF",
                padding: "10px 16px",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: "11px",
                background: "transparent",
                transition: "border-color .2s",
              }}
              onMouseEnter={ghov}
              onMouseLeave={gunhov}
            >
              Reset
            </button>
            <span
              className="mono"
              style={{
                marginLeft: "auto",
                fontSize: "10px",
                letterSpacing: "0.06em",
                color: v.decisionColor,
                transition: "color .4s",
              }}
            >
              decision: {v.decisionText}
            </span>
            <span
              className="mono"
              style={{
                fontSize: "10px",
                letterSpacing: "0.12em",
                color: v.graphTagColor,
                border: `1px solid ${v.graphTagBorder}`,
                borderRadius: "999px",
                padding: "5px 11px",
                transition: "all .5s",
              }}
            >
              {v.graphTag}
            </span>
          </div>
        </div>
      </section>

      {/* REPLAY PROOF BAND */}
      <section
        data-reveal
        className="castellan-replay-band"
        style={{ marginTop: "18px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}
      >
        <div
          style={{
            padding: "18px",
            border: "1px solid rgba(255,255,255,0.09)",
            borderRadius: "15px",
            background: "rgba(255,255,255,0.016)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span className="mono" style={{ fontSize: "10px", letterSpacing: "0.14em", color: "#5F6875" }}>
              BASELINE REPLAY
            </span>
            <span
              className="mono"
              style={{
                fontSize: "9.5px",
                color: "#D9DEE7",
                border: "1px solid rgba(255,255,255,0.16)",
                borderRadius: "999px",
                padding: "2px 8px",
              }}
            >
              SAFE
            </span>
          </div>
          <p style={{ marginTop: "12px", fontSize: "14px", lineHeight: 1.5, color: "#D9DEE7" }}>
            &quot;I need manager approval before processing this £900 refund.&quot;
          </p>
        </div>
        <div
          style={{
            padding: "18px",
            border: `1px solid ${v.poisonCardBorder}`,
            borderRadius: "15px",
            background: v.poisonCardBg,
            transition: "all .5s",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span className="mono" style={{ fontSize: "10px", letterSpacing: "0.14em", color: "#5F6875" }}>
              POISONED REPLAY
            </span>
            <span
              className="mono"
              style={{
                fontSize: "9.5px",
                color: v.poisonTag,
                border: `1px solid ${v.poisonCardBorder}`,
                borderRadius: "999px",
                padding: "2px 8px",
              }}
            >
              {v.poisonState}
            </span>
          </div>
          <p style={{ marginTop: "12px", fontSize: "14px", lineHeight: 1.5, color: v.poisonTextColor, transition: "color .5s" }}>
            {v.poisonText}
          </p>
        </div>
      </section>
    </>
  );
}
