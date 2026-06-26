"use client";

import { useMemo, useState } from "react";
import { PageShell } from "@/components/shared/PageShell";
import { CockpitGraphFlow } from "@/components/shell/CockpitGraphFlow";
import { useRunDemo } from "@/hooks/useRunDemo";
import { C } from "@/lib/cockpit/derive";
import { buildGraphModel, type NodeProvenance } from "@/lib/cockpit/graphModel";

const MONO = "var(--font-geist-mono), 'JetBrains Mono', monospace";

/**
 * Context Graph — the evidence surface. Renders a deterministic, tiered,
 * left-to-right DIRECTED graph of the memory-poisoning attack flow (SVG, not a
 * free canvas), so the page always shows a clear logical graph on the deployed
 * standalone. When a live run is present its real graph drives the same tiered
 * layout, and the REAL/DERIVED badge is set honestly from `graph_source`. The
 * poisoned posture (which lights the tainted path) and node provenance are read
 * from the run; with no run we fall back to the canonical demo graph + posture.
 */
export default function GraphPage() {
  const { run, isRunning } = useRunDemo();

  // Single source of truth for nodes/edges AND inspector provenance: the same
  // tiered model the canvas renders. Real run graph when present, else demo.
  const model = useMemo(() => buildGraphModel(run?.graph ?? null), [run]);

  // Default selection: the poisoned memory if present, else the first node.
  const defaultId = useMemo(() => {
    const poison = model.nodes.find((n) => n.role === "poisoned_memory");
    return poison?.id ?? model.nodes[0]?.id ?? "";
  }, [model]);
  const [inspId, setInspId] = useState<string | null>(null);

  const activeId = inspId ?? defaultId;
  const selected = model.nodes.find((n) => n.id === activeId) ?? model.nodes[0];
  const insp: NodeProvenance | undefined = selected?.insp;
  // The canonical attack graph always shows its tainted path, so a node's
  // inspector styling follows its own taint flag (not the live posture).
  const taintNode = Boolean(selected?.tainted);
  const inspColor = taintNode ? "#fff" : C.ink;

  // Honest graph-source labelling: REAL only when the backend parsed real
  // HydraDB query_paths; otherwise DERIVED. Mirrors the guardrail.
  const isReal = run?.graph_source === "real_query_paths";

  const rows: { k: string; v: string; col?: string }[] = insp
    ? [
        { k: "TENANT", v: insp.tenant },
        { k: "SUBTENANT", v: insp.sub },
        { k: "SOURCE CHUNK", v: insp.chunk },
        { k: "POLICY VER", v: insp.ver },
        { k: "TRUST", v: insp.trust },
        { k: "STATUS", v: insp.status, col: taintNode ? "#fff" : C.silver },
      ]
    : [];

  return (
    <PageShell>
      <div
        data-page
        className="cockpit-graph-grid"
        style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 14, alignItems: "stretch" }}
      >
        {/* Canvas panel */}
        <div
          style={{
            position: "relative",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 18,
            overflow: "hidden",
            background:
              "radial-gradient(120% 100% at 50% 0%,rgba(16,20,26,0.7),rgba(2,3,4,0.97))",
            minHeight: 560,
          }}
        >
          <div style={{ position: "absolute", top: 14, left: 16, zIndex: 4, display: "flex", gap: 7 }}>
            <span
              style={{
                fontFamily: MONO,
                fontSize: "9.5px",
                letterSpacing: "0.1em",
                color: isReal ? C.accent : C.faint,
                border: `1px solid ${isReal ? "rgba(234,240,250,0.3)" : "rgba(255,255,255,0.1)"}`,
                borderRadius: 999,
                padding: "5px 10px",
                background: isReal ? "rgba(234,240,250,0.05)" : "transparent",
              }}
            >
              REAL HYDRADB QUERY_PATHS
            </span>
            <span
              style={{
                fontFamily: MONO,
                fontSize: "9.5px",
                letterSpacing: "0.1em",
                color: isReal ? C.faint : C.accent,
                border: `1px solid ${isReal ? "rgba(255,255,255,0.1)" : "rgba(234,240,250,0.3)"}`,
                borderRadius: 999,
                padding: "5px 10px",
                background: isReal ? "transparent" : "rgba(234,240,250,0.05)",
              }}
            >
              DERIVED SCENARIO GRAPH
            </span>
          </div>
          <div style={{ position: "absolute", inset: 0, padding: "52px 16px 16px" }}>
            <CockpitGraphFlow
              graph={run?.graph ?? null}
              selectedId={activeId}
              onInspect={setInspId}
            />
          </div>
          {/* Legend: clarifies the directed flow + tainted-path highlight. */}
          <div
            style={{
              position: "absolute",
              bottom: 12,
              left: 16,
              zIndex: 4,
              display: "flex",
              gap: 14,
              fontFamily: MONO,
              fontSize: "9px",
              letterSpacing: "0.08em",
              color: C.faint,
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 16, height: 2, background: "#fff", display: "inline-block" }} />
              TAINTED PATH
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 16, height: 2, background: "rgba(200,212,230,0.22)", display: "inline-block" }} />
              CLEAN / OTHER
            </span>
            <span>{isRunning ? "running…" : "left → right"}</span>
          </div>
        </div>

        {/* Node inspector */}
        <div
          style={{
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 18,
            background: "rgba(255,255,255,0.014)",
            padding: 18,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ fontFamily: MONO, fontSize: "9.5px", letterSpacing: "0.16em", color: C.faint }}>
            NODE INSPECTOR
          </div>
          <div style={{ marginTop: 10, fontSize: 17, fontWeight: 700, color: inspColor }}>
            {insp?.type ?? "—"}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 11, color: C.muted, marginTop: 2 }}>
            {insp && insp.chunk !== "—" ? insp.chunk : (selected?.id ?? "")}
          </div>
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 1, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
            {rows.map((r) => (
              <div
                key={r.k}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "9px 0",
                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", color: C.faint }}>{r.k}</span>
                <span style={{ fontFamily: MONO, fontSize: 11, color: r.col ?? C.muted, textAlign: "right" }}>{r.v}</span>
              </div>
            ))}
          </div>
          <div
            style={{
              marginTop: 14,
              padding: 12,
              border: `1px solid ${taintNode ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.1)"}`,
              borderRadius: 10,
              background: taintNode ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.012)",
            }}
          >
            <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.14em", color: C.faint }}>RISK REASON</div>
            <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.5, color: C.silver }}>{insp?.reason ?? "—"}</div>
          </div>
          <div style={{ marginTop: "auto", paddingTop: 14, fontSize: 11, color: C.faint }}>
            Click any node to inspect its provenance.
          </div>
        </div>
      </div>
    </PageShell>
  );
}
