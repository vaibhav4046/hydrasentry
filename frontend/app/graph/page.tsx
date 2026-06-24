"use client";

import { useState } from "react";
import { Loader2, Play } from "lucide-react";
import { PageShell } from "@/components/shared/PageShell";
import { EmptyState, InlineError } from "@/components/shared/StateNotice";
import { GlassPanel } from "@/components/noir/GlassPanel";
import { GlowButton } from "@/components/noir/GlowButton";
import { NodeInspector } from "@/components/noir/NodeInspector";
import { SectionHeader } from "@/components/noir/SectionHeader";
import { GraphCanvas } from "@/components/graph/GraphCanvas";
import { GraphSourceBadge } from "@/components/graph/GraphSourceBadge";
import { TripletList } from "@/components/graph/TripletList";
import { useRunDemo } from "@/hooks/useRunDemo";
import type { GraphNode } from "@/lib/types";

/**
 * Context Graph — the hero surface. Loads the graph from the current run; if no
 * run exists it offers to run the judge demo to populate it. The React Flow
 * canvas lays poison left to right and intercepts at the firewall; clicking any
 * node opens the inspector. The graph_source honesty badge and the raw
 * query_paths triplets sit beside it.
 */
export default function GraphPage() {
  const { run, isRunning, error, trigger } = useRunDemo();
  const [selected, setSelected] = useState<GraphNode | null>(null);

  return (
    <PageShell
      kicker="HYDRADB EVIDENCE"
      title="Context Graph"
      statusLabel={run ? "graph loaded" : "no run"}
      statusTone={run ? "active" : "neutral"}
      actions={
        run ? <GraphSourceBadge source={run.graph_source} /> : undefined
      }
    >
      {!run ? (
        <div className="flex flex-col gap-4">
          <EmptyState
            title="No graph to render yet"
            description="Run the judge demo to extract the HydraDB context graph and see the tainted query_path that overrode the refund policy."
            action={
              <GlowButton
                variant="primary"
                onClick={() => void trigger()}
                disabled={isRunning}
                iconLeft={
                  isRunning ? (
                    <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.8} />
                  ) : (
                    <Play className="h-4 w-4" strokeWidth={1.9} />
                  )
                }
              >
                {isRunning ? "Running pipeline" : "Run demo to populate"}
              </GlowButton>
            }
          />
          {error && <InlineError message={error} />}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="grid gap-5 xl:grid-cols-[1fr_auto]">
            <div className="flex flex-col gap-3">
              <div className="h-[560px] w-full">
                <GraphCanvas
                  graph={run.graph}
                  firewall={run.firewall}
                  onNodeSelect={setSelected}
                />
              </div>
              <p className="mono text-[11px] leading-relaxed text-faint">
                Drag to pan, scroll to zoom. Tainted edges travel; the firewall
                node intercepts the unsafe action. Click any node for its
                source_chunk_id, tenant, policy version, trust and status.
              </p>
            </div>
            <div className="w-full xl:w-[360px]">
              {selected ? (
                <NodeInspector
                  node={selected}
                  onClose={() => setSelected(null)}
                />
              ) : (
                <GlassPanel className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 p-6 text-center">
                  <div className="mono text-[11px] uppercase tracking-[0.18em] text-faint">
                    node inspector
                  </div>
                  <p className="text-sm text-muted">
                    Select a node in the graph to inspect its provenance.
                  </p>
                </GlassPanel>
              )}
            </div>
          </div>

          <GlassPanel className="flex flex-col gap-4 p-6">
            <SectionHeader
              kicker="QUERY_PATHS"
              title="Tainted memory triplets"
              description="The raw source -> relation -> target paths returned for this run. Tainted paths originate from the poisoned source chunk."
            />
            <TripletList triplets={run.graph.query_paths} />
          </GlassPanel>
        </div>
      )}
    </PageShell>
  );
}
