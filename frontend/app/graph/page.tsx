"use client";

import { useMemo, useState } from "react";
import { PageShell } from "@/components/shared/PageShell";
import { AtlasPlate } from "@/components/graph/AtlasPlate";
import { useRunDemo } from "@/hooks/useRunDemo";
import { C } from "@/lib/cockpit/derive";
import { buildAtlasGraph } from "@/lib/cockpit/atlasGraphModel";
import type { NodeProvenance } from "@/lib/cockpit/graphModel";

const MONO = "var(--font-geist-mono), 'JetBrains Mono', monospace";

/**
 * Memory Graph, the evidence surface, rendered as a detailed, logical
 * constellation star-atlas (the same observatory language as the homepage
 * star-chart, scaled up into a working observation plate). Every context entity
 * of the memory_poisoning_refund run is a star; thin constellation lines carry
 * the directed logical relations; the tainted path is the bright fallen
 * constellation severed at the MCP firewall guardian star. Always renders the
 * full demo constellation on the cold standalone; a live run's real graph is
 * mapped into the same star layout and the REAL/DERIVED badge is set honestly
 * from `graph_source`. Clicking a star updates the Node Inspector with that
 * entity's full provenance.
 */
export default function GraphPage() {
  const { run, isRunning } = useRunDemo();

  // Single source of truth for the constellation AND inspector provenance:
  // the real run graph when present, else the canonical demo atlas.
  const model = useMemo(() => buildAtlasGraph(run?.graph ?? null), [run]);

  // Default selection: the poisoned (extinction) memory if present, else first.
  const defaultId = useMemo(() => {
    const poison = model.stars.find((s) => s.extinct && s.tainted);
    return poison?.id ?? model.stars[0]?.id ?? "";
  }, [model]);
  const [selId, setSelId] = useState<string | null>(null);

  const activeId = selId ?? defaultId;
  const selected =
    model.stars.find((s) => s.id === activeId) ?? model.stars[0];
  const insp: NodeProvenance | undefined = selected?.insp;
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
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 300px",
          gap: 14,
          alignItems: "stretch",
        }}
      >
        {/* Constellation plate panel */}
        <div
          style={{
            position: "relative",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 18,
            overflow: "hidden",
            background:
              "radial-gradient(120% 100% at 50% 0%,rgba(16,20,26,0.6),rgba(2,3,4,0.97))",
            minHeight: 560,
            padding: 14,
            display: "flex",
          }}
        >
          <AtlasPlate
            model={model}
            selectedId={activeId}
            onSelect={setSelId}
            isReal={isReal}
            isRunning={isRunning}
          />
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
          <div
            style={{
              fontFamily: MONO,
              fontSize: "9.5px",
              letterSpacing: "0.16em",
              color: C.faint,
            }}
          >
            NODE INSPECTOR
          </div>
          <div
            className="cockpit-display"
            style={{ marginTop: 10, fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em", color: inspColor }}
          >
            {insp?.type ?? "·"}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 11, color: C.muted, marginTop: 2 }}>
            {insp && insp.chunk !== "·" ? insp.chunk : (selected?.id ?? "")}
          </div>
          <div
            style={{
              marginTop: 16,
              display: "flex",
              flexDirection: "column",
              gap: 1,
              borderTop: "1px solid rgba(255,255,255,0.07)",
            }}
          >
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
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 10,
                    letterSpacing: "0.08em",
                    color: C.faint,
                  }}
                >
                  {r.k}
                </span>
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 11,
                    color: r.col ?? C.muted,
                    textAlign: "right",
                  }}
                >
                  {r.v}
                </span>
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
            <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.14em", color: C.faint }}>
              RISK REASON
            </div>
            <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.5, color: C.silver }}>
              {insp?.reason ?? "·"}
            </div>
          </div>
          <div style={{ marginTop: "auto", paddingTop: 14, fontSize: 11, color: C.faint }}>
            Click any star to inspect its provenance.
          </div>
        </div>
      </div>
    </PageShell>
  );
}
