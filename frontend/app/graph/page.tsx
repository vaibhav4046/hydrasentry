"use client";

import { useCallback, useState } from "react";
import { Loader2, Play } from "lucide-react";
import { PageShell } from "@/components/shared/PageShell";
import { EmptyState, InlineError } from "@/components/shared/StateNotice";
import { SegmentedControl } from "@/components/shared/SegmentedControl";
import { GlassPanel } from "@/components/noir/GlassPanel";
import { GlowButton } from "@/components/noir/GlowButton";
import { SectionHeader } from "@/components/noir/SectionHeader";
import { ArtifactTreeGraph } from "@/components/noir/ArtifactTreeGraph";
import { AnimatedRiskBadge } from "@/components/noir/AnimatedRiskBadge";
import { GraphKeyframeStrip } from "@/components/noir/GraphKeyframeStrip";
import {
  NodeInspectorPreview,
  type InspectorNode,
} from "@/components/noir/NodeInspectorPreview";
import { MAX_STAGE } from "@/components/noir/artifactTreeData";
import { LazyGraphCanvas } from "@/components/graph/LazyGraphCanvas";
import { GraphSourceBadge } from "@/components/graph/GraphSourceBadge";
import { TripletList } from "@/components/graph/TripletList";
import { useRunDemo } from "@/hooks/useRunDemo";
import { toInspectorNode } from "@/lib/inspector";
import type { GraphNode } from "@/lib/types";

type GraphView = "artifact" | "graph";

const VIEW_OPTIONS = [
  { value: "artifact", label: "Artifact view", hint: "The signature context tree" },
  { value: "graph", label: "Graph view", hint: "Detailed React Flow map" },
];

/**
 * Context Graph — the hero surface. It LEADS with the signature monochrome
 * ArtifactTreeGraph (full-width, scrubbable through its 8 stages) fed the current
 * run's real graph when present, the demo tree otherwise. A node click opens the
 * shared NodeInspectorPreview; selecting the tainted path lights the poison
 * branch. The same identity is offered two ways via a toggle: the artifact tree
 * and the detailed React Flow map (good for arbitrary real run graphs) — both
 * read as one design language (white/dim edges, white-hot tainted, glass nodes,
 * the same inspector + risk badge + graph_source badge). The raw query_paths
 * triplets sit below as the evidence behind the picture.
 */
export default function GraphPage() {
  const { run, isRunning, error, trigger } = useRunDemo();
  const [view, setView] = useState<GraphView>("artifact");
  const [inspect, setInspect] = useState<InspectorNode | null>(null);
  const [stage, setStage] = useState<number>(MAX_STAGE);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  // React Flow click feeds the SAME inspector via the shared adapter.
  const handleFlowSelect = useCallback((node: GraphNode) => {
    setInspect(toInspectorNode(node));
  }, []);

  const handlePathSelect = useCallback((id: string) => {
    setSelectedPath((prev) => (prev === id ? null : id));
  }, []);

  const riskScore = run?.risk.score ?? 87;
  const riskBand = run ? `${run.risk.band} RISK` : "HIGH RISK";

  return (
    <PageShell
      kicker="HYDRADB EVIDENCE"
      title="Context Graph"
      statusLabel={run ? "graph loaded" : "demo tree"}
      statusTone={run ? "active" : "neutral"}
      actions={
        <GraphSourceBadge
          source={run?.graph_source ?? "derived_scenario_graph"}
        />
      }
    >
      <div className="flex flex-col gap-5">
        {/* ===== HERO: artifact tree leads, risk + view toggle on top ===== */}
        <GlassPanel strong className="flex flex-col gap-5 p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <AnimatedRiskBadge to={riskScore} band={riskBand} />
            <div className="flex flex-wrap items-center gap-3">
              <GraphSourceBadge
                source={run?.graph_source ?? "derived_scenario_graph"}
              />
              <SegmentedControl
                ariaLabel="Graph view mode"
                options={VIEW_OPTIONS}
                value={view}
                onChange={(v) => setView(v as GraphView)}
              />
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-[1fr_auto]">
            <div className="flex min-w-0 flex-col gap-3">
              {view === "artifact" ? (
                <div className="relative w-full overflow-hidden rounded-xl2 border border-hairline bg-deep/40 p-2 sm:p-4">
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 -z-0"
                    style={{
                      background:
                        "radial-gradient(circle at 50% 38%, rgba(255,255,255,0.08), rgba(255,255,255,0.02) 42%, transparent 70%)",
                    }}
                  />
                  <ArtifactTreeGraph
                    stage={stage}
                    graph={run?.graph ?? null}
                    selectedPathId={selectedPath}
                    onNodeClick={setInspect}
                    onPathSelect={handlePathSelect}
                    className="mx-auto max-w-[760px]"
                  />
                </div>
              ) : (
                <div className="h-[420px] w-full sm:h-[560px]">
                  {run ? (
                    <LazyGraphCanvas
                      graph={run.graph}
                      firewall={run.firewall}
                      onNodeSelect={handleFlowSelect}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center rounded-xl2 border border-hairline bg-deep/40">
                      <p className="mono max-w-xs text-center text-[12px] leading-relaxed text-faint">
                        Detailed graph view renders a real run. Run the judge
                        demo to populate arbitrary HydraDB query_paths.
                      </p>
                    </div>
                  )}
                </div>
              )}
              <p className="mono text-[11px] leading-relaxed text-faint">
                {view === "artifact"
                  ? "Scrub the keyframes to replay how the tainted path surfaced. Click any node for its source_chunk_id, tenant, relevancy and status; select the risky path to light the poison branch."
                  : "Drag to pan, scroll to zoom. Tainted edges travel; the firewall node intercepts the unsafe action. Click any node to inspect its provenance."}
              </p>
            </div>

            <div className="w-full xl:w-[340px]">
              {inspect ? (
                <NodeInspectorPreview
                  node={inspect}
                  onClose={() => setInspect(null)}
                  onQuarantine={() => setInspect(null)}
                />
              ) : (
                <GlassPanel className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 p-6 text-center">
                  <div className="mono text-[11px] uppercase tracking-[0.18em] text-faint">
                    node inspector
                  </div>
                  <p className="text-sm text-muted">
                    Select a node to inspect its provenance.
                  </p>
                </GlassPanel>
              )}
            </div>
          </div>

          {/* keyframe scrubber drives the artifact tree */}
          {view === "artifact" && (
            <GraphKeyframeStrip
              activeStage={stage}
              onScrub={setStage}
              className="mx-auto w-full max-w-3xl"
            />
          )}
        </GlassPanel>

        {/* ===== cold-load CTA when no run yet ===== */}
        {!run && (
          <div className="flex flex-col gap-4">
            <EmptyState
              title="Showing the demo artifact tree"
              description="Run the judge demo to extract the live HydraDB context graph and replace the demo tree with the real tainted query_path that overrode the refund policy."
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
                  {isRunning ? "Running pipeline" : "Run Judge Demo"}
                </GlowButton>
              }
            />
            {error && <InlineError message={error} />}
          </div>
        )}

        {/* ===== raw query_paths evidence ===== */}
        {run && (
          <GlassPanel className="flex flex-col gap-4 p-6">
            <SectionHeader
              kicker="QUERY_PATHS"
              title="Tainted memory triplets"
              description="The raw source -> relation -> target paths returned for this run. Tainted paths originate from the poisoned source chunk."
            />
            <TripletList triplets={run.graph.query_paths} />
          </GlassPanel>
        )}
      </div>
    </PageShell>
  );
}
