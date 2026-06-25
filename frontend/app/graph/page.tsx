"use client";

import { useCallback, useState } from "react";
import { Loader2, Play } from "lucide-react";
import { PageShell } from "@/components/shared/PageShell";
import { EmptyState, InlineError } from "@/components/shared/StateNotice";
import { SegmentedControl } from "@/components/shared/SegmentedControl";
import {
  CockpitCard,
  CockpitSectionLabel,
} from "@/components/shell/CockpitCard";
import { GlowButton } from "@/components/noir/GlowButton";
import { ArtifactTreeGraph } from "@/components/noir/ArtifactTreeGraph";
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
 * Memory Graph — the evidence surface. It LEADS with the signature monochrome
 * ArtifactTreeGraph (full-width, scrubbable through its 8 stages) fed the current
 * run's real graph when present, the demo tree otherwise. A node click opens the
 * shared NodeInspectorPreview (a flat cockpit side panel); selecting the tainted
 * path lights the poison branch. The same identity is offered two ways via a
 * toggle: the artifact tree and the detailed React Flow map. The raw query_paths
 * triplets sit below as the evidence behind the picture. Reskinned to the
 * flat-cockpit system to match Command — the graph viz stays, the chrome flattens.
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
  const riskBand = run ? run.risk.band : "HIGH";

  return (
    <PageShell
      actions={
        <GraphSourceBadge
          source={run?.graph_source ?? "derived_scenario_graph"}
        />
      }
    >
      <div className="flex flex-col gap-5">
        {/* ===== HERO: flat toolbar + hairline graph panel + inspector ===== */}
        <CockpitCard className="flex flex-col gap-5 p-5 sm:p-6">
          {/* toolbar */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-baseline gap-4">
              <div>
                <div className="cockpit-eyebrow">Risk Score</div>
                <div className="mt-2 text-[2.4rem] font-semibold leading-none tracking-tight text-ink tabular-nums">
                  {riskScore}
                  <span className="ml-2 align-middle text-[11px] font-medium uppercase tracking-[0.16em] text-faint">
                    {riskBand}
                  </span>
                </div>
              </div>
            </div>
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
                <div className="relative w-full overflow-hidden rounded-lg border border-hairline bg-deep/40 p-2 sm:p-4">
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
                    <div className="flex h-full items-center justify-center rounded-lg border border-hairline bg-deep/40">
                      <p className="mono max-w-xs text-center text-[12px] leading-relaxed text-faint">
                        Detailed graph view renders a real run. Run the judge demo
                        to populate arbitrary HydraDB query_paths.
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
                <CockpitCard className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 p-6 text-center">
                  <div className="cockpit-eyebrow">node inspector</div>
                  <p className="text-sm text-muted">
                    Select a node to inspect its provenance.
                  </p>
                </CockpitCard>
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
        </CockpitCard>

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
          <CockpitCard className="flex flex-col gap-4 p-6">
            <div>
              <CockpitSectionLabel>Query_Paths</CockpitSectionLabel>
              <h2 className="mt-2 text-[1.3rem] font-semibold tracking-tight text-ink">
                Tainted memory triplets
              </h2>
              <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted">
                The raw source -&gt; relation -&gt; target paths returned for this
                run. Tainted paths originate from the poisoned source chunk.
              </p>
            </div>
            <TripletList triplets={run.graph.query_paths} />
          </CockpitCard>
        )}
      </div>
    </PageShell>
  );
}
